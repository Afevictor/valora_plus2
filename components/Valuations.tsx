
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ValuationChatMsg, ValuationRequest } from '../types';
import { notificationService } from '../services/notificationService';
import {
    uploadChatAttachment,
    getValuationById,
    getValuationsFromSupabase,
    supabase
} from '../services/supabaseClient';
import { getBitrixUsers, getBitrixContacts, BitrixUser, sendBitrixMessage, getBitrixMessages } from '../services/bitrixService';

// Ayudante para convertir archivo a Base64 para respaldo
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Formateador de Fecha Robusto
const formatMessageTime = (dateStr?: string | Date, fallback?: string) => {
    if (!dateStr) return fallback || '';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback || '';

    const now = new Date();
    const isToday = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return `${date.getDate()}/${date.getMonth() + 1} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
};

const Valuations: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Logic changed to be Claim-centric
    const [assignedClaims, setAssignedClaims] = useState<{ valuation: ValuationRequest, expert: BitrixUser }[]>([]);
    const [selectedUser, setSelectedUser] = useState<BitrixUser | null>(null);
    const [activeMessages, setActiveMessages] = useState<ValuationChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingChat, setIsLoadingChat] = useState(false);

    // Estado de Adjuntos
    const [tempAttachments, setTempAttachments] = useState<{ file: File, preview: string, type: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Estado de Envío para Feedback de UI
    const [isSending, setIsSending] = useState(false);
    const [pollingError, setPollingError] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Obtención Inicial de Datos
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [bUsers, bContacts, valuations] = await Promise.all([
                    getBitrixUsers(),
                    getBitrixContacts(),
                    getValuationsFromSupabase()
                ]);

                // Map contacts to match DB storage format
                const mappedContacts = bContacts.map((c: any) => ({
                    ID: `contact_${c.ID}`,
                    NAME: c.NAME,
                    LAST_NAME: c.LAST_NAME,
                    WORK_POSITION: c.WORK_POSITION || 'Contacto Externo',
                    ACTIVE: true,
                    IS_CONTACT: true
                } as BitrixUser));

                const allUsers = [...bUsers, ...mappedContacts];

                // Build assigned claims list: only valuations that have an expert
                const claimsWithExperts = (valuations || [])
                    .filter(v => !!v.assignedExpertId)
                    .map(v => {
                        const expert = allUsers.find(u => u.ID === v.assignedExpertId);
                        return { valuation: v, expert };
                    })
                    .filter(item => !!item.expert) as { valuation: ValuationRequest, expert: BitrixUser }[];

                // Sort by request date (newest first)
                claimsWithExperts.sort((a, b) =>
                    new Date(b.valuation.requestDate || 0).getTime() - new Date(a.valuation.requestDate || 0).getTime()
                );

                setAssignedClaims(claimsWithExperts);

                // Handle incoming selection from state
                const state = location.state as { selectedId?: string };
                if (state?.selectedId) {
                    const valuation = await getValuationById(state.selectedId);
                    if (valuation?.assignedExpertId) {
                        const expert = allUsers.find(u => u.ID === valuation.assignedExpertId);
                        if (expert) setSelectedUser(expert);
                    }
                }
            } catch (error) {
                console.error("❌ [Valuations] Failed to load chat data:", error);
                setAssignedClaims([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [location.state]);

    // --- CARGA DE CHAT DE BITRIX ---
    useEffect(() => {
        let interval: any;

        const fetchBitrixChat = async () => {
            if (!selectedUser) {
                setActiveMessages([]);
                return;
            }

            if (!interval) setIsLoadingChat(true);

            try {
                // Remove contact_ prefix for API call if it's a contact
                const apiId = selectedUser.ID.replace('contact_', '');
                // Note: For CRM Contacts, Bitrix IM DIALOG_ID often needs a prefix like 'C_' 
                // but let's see how the current service handles it.
                const messages = await getBitrixMessages(apiId);
                setPollingError(false);

                if (messages && Array.isArray(messages)) {
                    const mappedMessages: ValuationChatMsg[] = messages.map((bxMsg: any) => {
                        const isFromContact = String(bxMsg.author_id) === String(apiId);
                        return {
                            id: String(bxMsg.id),
                            sender: isFromContact ? 'Expert' : 'Workshop',
                            text: bxMsg.text || '',
                            timestamp: formatMessageTime(bxMsg.date),
                            rawDate: bxMsg.date,
                            deliveryStatus: 'delivered',
                            isEmail: false,
                            files: []
                        };
                    });
                    mappedMessages.sort((a, b) => new Date(a.rawDate || 0).getTime() - new Date(b.rawDate || 0).getTime());
                    setActiveMessages(mappedMessages);
                } else {
                    setActiveMessages([]);
                }
            } catch (e) {
                console.error("Error al cargar chat:", e);
                setPollingError(true);
            } finally {
                setIsLoadingChat(false);
            }
        };

        if (selectedUser) {
            fetchBitrixChat();
            interval = setInterval(fetchBitrixChat, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [selectedUser]);

    useEffect(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }, [activeMessages, tempAttachments]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files: File[] = Array.from(e.target.files);
            const newAttachments = files.map(file => ({
                file,
                preview: URL.createObjectURL(file),
                type: file.type.startsWith('image/') ? 'image' : 'file'
            }));
            setTempAttachments(prev => [...prev, ...newAttachments]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setTempAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async () => {
        if (!selectedUser || (!chatInput.trim() && tempAttachments.length === 0) || isSending) return;

        setIsSending(true);

        try {
            const fileLinks: string[] = [];
            let uploadFailed = false;

            if (tempAttachments.length > 0) {
                for (const att of tempAttachments) {
                    const publicUrl = await uploadChatAttachment(att.file);
                    if (publicUrl) {
                        fileLinks.push(publicUrl);
                    } else {
                        uploadFailed = true;
                        const b64 = await fileToBase64(att.file);
                        fileLinks.push(b64);
                    }
                }
            }

            if (uploadFailed) {
                notificationService.add({ type: 'alert', title: 'Problema de Subida', message: 'Algunos archivos se enviaron como enlaces.' });
            }

            let fullMsg = chatInput;
            if (fileLinks.length > 0) {
                fullMsg += `\n\nAdjuntos:\n${fileLinks.map((link, i) => link.startsWith('data:') ? `(Archivo ${i + 1})` : link).join('\n')}`;
            }

            const apiId = selectedUser.ID.replace('contact_', '');
            const success = await sendBitrixMessage(apiId, fullMsg);

            if (success) {
                const now = new Date();
                const optimisticMsg: ValuationChatMsg = {
                    id: `temp-${Date.now()}`,
                    sender: 'Workshop',
                    text: fullMsg,
                    timestamp: formatMessageTime(now),
                    rawDate: now.toISOString(),
                    deliveryStatus: 'sent',
                    files: fileLinks
                };
                setActiveMessages(prev => [...prev, optimisticMsg]);
                setChatInput('');
                setTempAttachments([]);
            } else {
                alert("Fallo al enviar mensaje a Bitrix.");
            }
        } catch (e) {
            console.error("Fallo al enviar mensaje", e);
            alert("Error al enviar mensaje.");
        } finally {
            setIsSending(false);
        }
    };

    const filteredClaims = assignedClaims.filter(item =>
        `${item.expert.NAME} ${item.expert.LAST_NAME} ${item.valuation.vehicle?.plate} ${item.valuation.vehicle?.model}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden">
            {/* Sidebar Usuarios */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800 mb-3">Chats de Peritos</h2>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar perito..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-10 gap-3 opacity-50">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando...</span>
                        </div>
                    ) : filteredClaims.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm italic">No hay peritaciones con perito asignado</div>
                    ) : (
                        filteredClaims.map(({ valuation, expert }) => (
                            <div
                                key={valuation.id}
                                onClick={() => setSelectedUser(expert)}
                                className={`flex items-center gap-3 p-4 cursor-pointer transition-all border-l-4 ${selectedUser?.ID === expert.ID
                                    ? 'bg-blue-50 border-blue-500'
                                    : 'hover:bg-slate-50 border-transparent'}`}
                            >
                                <div className="relative">
                                    {expert.PERSONAL_PHOTO ? (
                                        <img src={expert.PERSONAL_PHOTO} alt={expert.NAME} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${expert.IS_CONTACT ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                                            {(expert.NAME || '?').substring(0, 1)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h4 className="text-xs font-black text-slate-800 truncate uppercase tracking-tight">{expert.NAME} {expert.LAST_NAME}</h4>
                                        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{valuation.vehicle?.plate}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate tracking-tight">{valuation.vehicle?.model || 'Sin Modelo'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Area de Chat */}
            <div className="flex-1 flex flex-col bg-[#F8FAFC]">
                {selectedUser ? (
                    <>
                        {/* Header Chat */}
                        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${selectedUser.IS_CONTACT ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                                    {selectedUser.NAME.substring(0, 1)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 leading-tight">{selectedUser.NAME} {selectedUser.LAST_NAME}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En línea (Bitrix)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mensajes */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin flex flex-col gap-4">
                            {isLoadingChat ? (
                                <div className="flex-1 flex items-center justify-center flex-col gap-4 opacity-40">
                                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Sincronizando con Bitrix...</p>
                                </div>
                            ) : activeMessages.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center flex-col gap-4 opacity-30">
                                    <svg className="w-16 h-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    <p className="text-sm font-bold text-slate-400">No hay mensajes anteriores</p>
                                </div>
                            ) : (
                                activeMessages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender === 'Workshop' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${msg.sender === 'Workshop'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                            <div className={`text-[10px] mt-2 flex items-center gap-1 ${msg.sender === 'Workshop' ? 'text-blue-100 justify-end' : 'text-slate-400'}`}>
                                                {msg.timestamp}
                                                {msg.sender === 'Workshop' && (
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-200">
                            {tempAttachments.length > 0 && (
                                <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
                                    {tempAttachments.map((att, idx) => (
                                        <div key={idx} className="relative group flex-shrink-0">
                                            {att.type === 'image' ? (
                                                <img src={att.preview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                </div>
                                            )}
                                            <button onClick={() => removeAttachment(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md group-hover:scale-110 transition-transform">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-3 max-w-5xl mx-auto">
                                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-blue-500 bg-slate-50 rounded-full transition-all">
                                    <svg className="w-6 h-6 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />

                                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center focus-within:bg-white focus-within:border-blue-400 transition-all">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder-slate-400"
                                        placeholder={isSending ? "Enviando..." : "Escribe un mensaje..."}
                                        value={chatInput}
                                        disabled={isSending}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                </div>

                                <button
                                    onClick={handleSendMessage}
                                    disabled={(!chatInput.trim() && tempAttachments.length === 0) || isSending}
                                    className={`p-3.5 rounded-xl shadow-lg transition-all ${(!chatInput.trim() && tempAttachments.length === 0) || isSending ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                                >
                                    {isSending ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-5 h-5 ml-0.5" viewBox="0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 text-center">
                        <div className="w-24 h-24 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <svg className="w-10 h-10 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-600 mb-2">Bandeja de Peritaciones</h3>
                        <p className="max-w-xs leading-relaxed">Selecciona un perito de la lista para ver la conversación o pulsa en una peritación desde el Planificador.</p>
                    </div>
                )}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
            `}} />
        </div>
    );
};

export default Valuations;
