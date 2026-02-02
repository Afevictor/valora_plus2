
import React, { useState, useEffect, useRef } from 'react';
import {
    supabase,
    getInternalMessages,
    sendInternalMessage,
    getValuationMessages,
    sendMessageToValuation,
    uploadChatAttachment,
    getValuationById
} from '../services/supabaseClient';
import { getBitrixMessages, sendBitrixMessage, getBitrixContacts } from '../services/bitrixService';
import { RepairJob } from '../types';

interface DualChatProps {
    workOrder: RepairJob;
    onClose?: () => void;
}

const DualChat: React.FC<DualChatProps> = ({ workOrder, onClose }) => {
    const [activeTab, setActiveTab] = useState<'internal' | 'expert'>('internal');
    const [internalMessages, setInternalMessages] = useState<any[]>([]);
    const [expertMessages, setExpertMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [unreadInternal, setUnreadInternal] = useState(0);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeRole, setActiveRole] = useState<string>('');
    const [isAttaching, setIsAttaching] = useState(false);
    const [expertId, setExpertId] = useState<string | null>(null);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
    const [availableExperts, setAvailableExperts] = useState<any[]>([]);
    const [isLoadingExperts, setIsLoadingExperts] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        loadUserAndData();

        // Supabase Realtime for Internal Chat
        const internalChan = supabase
            .channel('internal-chat')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'internal_messages',
                filter: `work_order_id=eq.${workOrder.id}`
            }, payload => {
                setInternalMessages(prev => [...prev, payload.new]);
                if (activeTab !== 'internal') setUnreadInternal(u => u + 1);
            })
            .subscribe();

        // Supabase Realtime for Expert Chat (Backup/Sync)
        const expertChan = supabase
            .channel('expert-chat')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'valuation_messages',
                filter: `valuation_id=eq.${workOrder.valuationId}`
            }, payload => {
                // Determine if we should add it (avoid dupes from Bitrix poll)
                setExpertMessages(prev => {
                    if (prev.find(m => m.id === payload.new.id)) return prev;
                    return [...prev, payload.new];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(internalChan);
            supabase.removeChannel(expertChan);
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [workOrder.id, workOrder.valuationId]);

    // Handle Active Tab & Polling
    useEffect(() => {
        scrollToBottom();
        if (activeTab === 'internal') {
            setUnreadInternal(0);
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
        } else if (activeTab === 'expert' && expertId) {
            // Poll Bitrix immediately and then every 10s
            fetchBitrixMessages();
            const interval = setInterval(fetchBitrixMessages, 10000);
            setPollingInterval(interval);
        }
    }, [internalMessages, expertMessages, activeTab, expertId]);

    const loadUserAndData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        const role = sessionStorage.getItem('vp_active_role') || user?.user_metadata?.role || 'Service Advisor';
        setActiveRole(role);

        const iMsgs = await getInternalMessages(workOrder.id);
        setInternalMessages(iMsgs);

        if (workOrder.valuationId) {
            // Load local Expert Messages first
            const eMsgs = await getValuationMessages(workOrder.valuationId);
            setExpertMessages(eMsgs);


            // Fetch Valuation to get Expert ID
            const val = await getValuationById(workOrder.valuationId);
            if (val && val.assignedExpertId) {
                setExpertId(val.assignedExpertId);
            } else {
                // If missing, load available contacts for manual selection
                loadAvailableExperts();
            }
        }
    };

    const loadAvailableExperts = async () => {
        setIsLoadingExperts(true);
        try {
            const contacts = await getBitrixContacts();
            const mapped = contacts.map((c: any) => ({
                id: `contact_${c.ID}`,
                name: `${c.NAME} ${c.LAST_NAME}`.trim(),
                role: c.WORK_POSITION || 'Contacto Externo'
            }));
            setAvailableExperts(mapped);
        } catch (e) {
            console.error("Failed to load experts:", e);
        } finally {
            setIsLoadingExperts(false);
        }
    };

    const handleSelectExpert = async (selectedId: string) => {
        if (!selectedId) return;

        // 1. Update State
        setExpertId(selectedId);

        // 2. Update Database (Persistent Link)
        try {
            const val = await getValuationById(workOrder.valuationId!);
            if (val) {
                const updatedVal = {
                    ...val,
                    assignedExpertId: selectedId
                };
                // Upsert back to Supabase
                // Note: We use existing saveValuationToSupabase which handles the raw_data JSONB update
                await sendMessageToValuation({
                    valuation_id: workOrder.valuationId,
                    message: `[SISTEMA] Se ha vinculado manualmente al contacto: ${selectedId}`,
                    sender_name: 'Sistema',
                    sender_role: 'System',
                    sender_id: 'system'
                });

                // We need to fetch the workshopId to save correctly if we are not the owner (e.g. admin staff)
                // But saveValuationToSupabase defaults to current user if not provided.
                // ideally we pass val.workshop_id if available.
                const { saveValuationToSupabase } = await import('../services/supabaseClient');
                await saveValuationToSupabase(updatedVal, val.workshop_id);
            }
        } catch (e) {
            console.error("Failed to link expert:", e);
        }
    };

    const fetchBitrixMessages = async () => {
        if (!expertId) return;
        try {
            const bMsgs = await getBitrixMessages(expertId);
            // Map Bitrix messages to our format
            const mapped = bMsgs.map((m: any) => ({
                id: `bx_${m.id}`,
                message: m.text,
                created_at: m.date,
                sender_name: m.author_id.toString() === expertId ? 'Perito (Bitrix)' : 'Taller (Bitrix)',
                sender_id: m.author_id.toString() === expertId ? 'expert_remote' : 'me_remote',
                is_bitrix: true,
                attachments: [] // Bitrix attachments require complex handling, skipping for simple text now
            }));

            setExpertMessages(prev => {
                const combined = [...prev];
                mapped.forEach(bx => {
                    const exists = combined.find(lx =>
                        lx.id === bx.id ||
                        (lx.message === bx.message && Math.abs(new Date(lx.created_at).getTime() - new Date(bx.created_at).getTime()) < 2000)
                    );
                    if (!exists) combined.push(bx);
                });
                return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
        } catch (e) {
            console.error("Bitrix poll failed:", e);
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        const senderName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Usuario';

        try {
            if (activeTab === 'internal') {
                await sendInternalMessage({
                    work_order_id: workOrder.id,
                    message: newMessage,
                    sender_name: `${senderName} (${activeRole})`,
                    sender_id: currentUser.id
                });
            } else if (workOrder.valuationId) {
                // 1. Save to Supabase (Local Record)
                await sendMessageToValuation({
                    valuation_id: workOrder.valuationId,
                    message: newMessage,
                    sender_name: senderName,
                    sender_role: 'Workshop',
                    sender_id: currentUser.id
                });

                // 2. Send to Bitrix (Integration)
                if (expertId) {
                    await sendBitrixMessage(expertId, newMessage);
                }
            }
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAttaching(true);
        try {
            const url = await uploadChatAttachment(file);
            if (url) {
                const senderName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Usuario';
                const attachmentMsg = {
                    attachments: [url],
                    message: `Envió una foto: ${file.name}`,
                    sender_name: activeTab === 'internal' ? `${senderName} (${activeRole})` : senderName
                };

                if (activeTab === 'internal') {
                    await sendInternalMessage({ ...attachmentMsg, work_order_id: workOrder.id });
                } else if (workOrder.valuationId) {
                    await sendMessageToValuation({
                        ...attachmentMsg,
                        valuation_id: workOrder.valuationId,
                        sender_role: 'Workshop'
                    });

                    if (expertId) {
                        await sendBitrixMessage(expertId, `[ARCHIVO ADJUNTO]: ${url}`);
                    }
                }
            }
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setIsAttaching(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const renderMessage = (msg: any) => {
        const isMe = msg.sender_id === currentUser?.id || msg.sender_id === 'me_remote';
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <div key={msg.id || Math.random()} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-slide-up`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{msg.sender_name || 'Desconocido'}</span>
                    <span className="text-[10px] text-slate-300">{time}</span>
                </div>

                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isMe
                    ? 'bg-brand-600 text-white rounded-tr-none'
                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                    {msg.message && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>}

                    {msg.attachments?.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 gap-2">
                            {msg.attachments.map((url: string, idx: number) => (
                                <img
                                    key={idx}
                                    src={url}
                                    alt="adjunto"
                                    className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(url, '_blank')}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Role Visibility Logic
    const canSeeExpertChat = (workOrder.requestAppraisal || !!workOrder.valuationId) &&
        !activeRole.toLowerCase().includes('mechanic') &&
        !activeRole.toLowerCase().includes('painter') &&
        !activeRole.toLowerCase().includes('técnico') &&
        !activeRole.toLowerCase().includes('operario');

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-2xl animate-fade-in overflow-hidden">
            {/* Header / Tabs */}
            <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-10 shadow-sm">
                <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                    <button
                        onClick={() => setActiveTab('internal')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${activeTab === 'internal'
                            ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                        Chat Interno
                        {unreadInternal > 0 && (
                            <span className="bg-brand-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                                {unreadInternal}
                            </span>
                        )}
                    </button>

                    {canSeeExpertChat && (
                        <button
                            onClick={() => setActiveTab('expert')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${activeTab === 'expert'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Chat Perito
                        </button>
                    )}
                </div>

                <div className="mt-3 px-2 flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {activeTab === 'internal' ? '🏠 Comunicación de Taller' : '📋 Enlace con Perito'}
                    </p>
                    {activeTab === 'internal' && (
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                    {i === 1 ? 'JA' : i === 2 ? 'VP' : 'ME'}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 scroll-smooth bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
            >
                <div className="text-center mb-8">
                    <span className="bg-slate-100 text-slate-400 px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
                        Hoy - {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                    </span>
                </div>

                {activeTab === 'internal' ? (
                    internalMessages.length > 0 ? (
                        internalMessages.map(renderMessage)
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale">
                            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <p className="text-sm font-bold uppercase tracking-widest">Inicia la conversación...</p>
                        </div>
                    )
                ) : (
                    expertMessages.length > 0 ? (
                        expertMessages.map(renderMessage)
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale text-center">
                            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-sm font-bold uppercase tracking-widest">Canal con peritacion activa</p>
                            <p className="text-[10px] tracking-tight mt-1">Sincronizado con Bitrix24</p>
                            {!expertId && (
                                <div className="mt-4 w-full max-w-xs bg-red-50 p-4 rounded-2xl border border-red-100">
                                    <p className="text-xs text-red-500 font-bold mb-2">⚠️ No se detectó Perito Asignado</p>
                                    <p className="text-[10px] text-red-400 mb-3">Selecciona un contacto de Bitrix para iniciar el chat:</p>

                                    {isLoadingExperts ? (
                                        <div className="animate-spin h-5 w-5 border-2 border-red-400 border-t-transparent rounded-full mx-auto"></div>
                                    ) : (
                                        <select
                                            className="w-full text-xs p-2 rounded-lg border border-red-200 text-slate-700 font-bold outline-none"
                                            onChange={(e) => handleSelectExpert(e.target.value)}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>-- Seleccionar Contacto --</option>
                                            {availableExperts.map(ex => (
                                                <option key={ex.id} value={ex.id}>{ex.name} ({ex.role})</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100">
                <form onSubmit={handleSendMessage} className="relative">
                    <div className="flex items-end gap-3 bg-slate-50 rounded-[24px] p-2 border border-slate-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                        <button
                            type="button"
                            disabled={isAttaching}
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-slate-400 hover:text-brand-600 hover:bg-white rounded-2xl transition-all disabled:opacity-50"
                        >
                            {isAttaching ? (
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            )}
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*"
                        />

                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder={activeTab === 'internal' ? 'Escribe a tu equipo...' : 'Mensaje para el perito...'}
                            className="flex-1 bg-transparent border-none focus:ring-0 py-3 text-sm font-medium text-slate-700 placeholder-slate-400 resize-none max-h-32 min-h-[44px]"
                            rows={1}
                        />

                        <button
                            type="submit"
                            disabled={!newMessage.trim() || isSending}
                            className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:shadow-xl hover:bg-black transition-all disabled:opacity-20 active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </form>
                <p className="text-[9px] text-slate-400 mt-3 px-4 font-bold uppercase tracking-widest text-center">
                    {activeTab === 'internal' ? '🔒 Privado: Solo visible para el personal del taller' : '🌍 Visible para el perito asignado'}
                </p>
            </div>
        </div>
    );
};

export default DualChat;
