import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ValuationChatMsg } from '../types';
import { notificationService } from '../services/notificationService';
import {
    uploadChatAttachment,
    supabase
} from '../services/supabaseClient';
import { getBitrixUsers, BitrixUser, sendBitrixMessage, getBitrixMessages } from '../services/bitrixService';

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
    const [bitrixUsers, setBitrixUsers] = useState<BitrixUser[]>([]);
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
    // Obtención Inicial de Datos
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Cargar Usuarios de Bitrix (Empleados/Usuarios Internos - "Bitrix Contacts")
                console.log("🔄 [Valuations] Fetching Bitrix Users...");
                const bUsers = await getBitrixUsers();
                console.log("📥 [Valuations] Raw users received:", bUsers?.length || 0);

                if (!bUsers || !Array.isArray(bUsers)) {
                    console.warn("⚠️ [Valuations] Invalid response format for users");
                    setBitrixUsers([]);
                    return;
                }

                // Filtrar usuarios y ordenar alfabéticamente
                // Mostramos todos los usuarios activos (ACTIVE: true)
                const sortedUsers = bUsers
                    .filter(u => {
                        // Robust check for active status (Boolean or 'Y' string)
                        return u && (u.ACTIVE === true || (u.ACTIVE as any) === 'Y');
                    })
                    .sort((a, b) => {
                        const nameA = a.NAME || '';
                        const nameB = b.NAME || '';
                        return nameA.localeCompare(nameB);
                    });

                console.log("✅ [Valuations] Displaying active users:", sortedUsers.length);
                setBitrixUsers(sortedUsers);
            } catch (error) {
                console.error("❌ [Valuations] Failed to load user list:", error);
                setBitrixUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- CARGA DE CHAT DE BITRIX (Directo desde API) ---
    useEffect(() => {
        let interval: any;

        const fetchBitrixChat = async () => {
            if (!selectedUser) {
                setActiveMessages([]);
                return;
            }

            // Solo mostrar indicador de carga en la primera carga o cambio de selección
            if (!interval) setIsLoadingChat(true);

            try {
                // Obtener directamente de la API de Bitrix
                const messages = await getBitrixMessages(selectedUser.ID);
                setPollingError(false);

                if (messages && Array.isArray(messages)) {
                    const mappedMessages: ValuationChatMsg[] = messages.map((bxMsg: any) => {
                        // Determinar Remitente si el mensaje es del usuario seleccionado
                        const isFromContact = String(bxMsg.author_id) === String(selectedUser.ID);

                        return {
                            id: String(bxMsg.id),
                            sender: isFromContact ? 'Expert' : 'Workshop', // 'Expert' en este contexto es el contacto remoto
                            text: bxMsg.text || '',
                            timestamp: formatMessageTime(bxMsg.date),
                            rawDate: bxMsg.date,
                            deliveryStatus: 'delivered',
                            isEmail: false,
                            files: []
                        };
                    });

                    // Ordenar por fecha ascendente
                    mappedMessages.sort((a, b) => new Date(a.rawDate || 0).getTime() - new Date(b.rawDate || 0).getTime());

                    setActiveMessages(mappedMessages);
                } else {
                    setActiveMessages([]);
                }
            } catch (e) {
                console.error("Error al cargar chat de Bitrix:", e);
                setPollingError(true);
            } finally {
                setIsLoadingChat(false);
            }
        };

        if (selectedUser) {
            fetchBitrixChat();
            // Poll cada 5 segundos para nuevos mensajes
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

            // 1. Subir Adjuntos
            if (tempAttachments.length > 0) {
                try {
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
                } catch (e) {
                    console.error("Error al procesar archivos", e);
                    setIsSending(false);
                    return;
                }
            }

            if (uploadFailed) {
                notificationService.add({ type: 'alert', title: 'Problema de Subida', message: 'Algunos archivos se enviaron como enlaces de texto.' });
            }

            // 2. Preparar Mensaje para Bitrix
            let fullMsg = chatInput;
            if (fileLinks.length > 0) {
                fullMsg += `\n\nAdjuntos:\n${fileLinks.map((link, i) => link.startsWith('data:') ? `(Archivo ${i + 1})` : link).join('\n')}`;
            }

            // 3. Enviar Directamente a Bitrix usando el ID del usuario seleccionado
            const success = await sendBitrixMessage(selectedUser.ID, fullMsg);

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
                alert("Fallo al enviar mensaje a Bitrix. Por favor, compruebe la conexión.");
            }

        } catch (e) {
            console.error("Fallo al enviar mensaje", e);
            alert("Error al enviar mensaje.");
        } finally {
            setIsSending(false);
        }
    };

    const renderMessageContent = (text: string, files: string[] | undefined, isIncoming: boolean) => {
        const safeText = text || "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        const allLinksInText = safeText.match(urlRegex) || [];
        const explicitFiles = Array.isArray(files) ? files : [];
        const uniqueLinks = [...new Set([...explicitFiles, ...allLinksInText])];

        return (
            <div>
                {safeText && <p className="whitespace-pre-wrap mb-1 text-sm">{safeText}</p>}
                {uniqueLinks.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                        {uniqueLinks.map((link, idx) => {
                            if (!isIncoming) {
                                return (
                                    <div key={`res-${idx}`} className="bg-white/50 border border-blue-200 rounded p-2 text-xs">
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            Adjunto / Enlace {idx + 1}
                                        </a>
                                    </div>
                                );
                            }
                            // Renderizado simple para enlaces entrantes
                            return (
                                <div key={`res-${idx}`} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 truncate block hover:underline flex items-center gap-2">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        Recurso Externo {idx + 1}
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const getInitials = (name: string) => {
        return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    };

    const filteredUsers = bitrixUsers.filter(u =>
        `${u.NAME} ${u.LAST_NAME}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-4rem)] md:h-screen bg-white overflow-hidden font-sans">

            {/* BARRA LATERAL (LISTA DE CONTACTOS) */}
            <div className={`w-full md:w-[360px] flex-col bg-white border-r border-slate-200 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {/* Cabecera Sidebar */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#2FC6F6] text-white p-1 rounded font-bold text-xs">b24</div>
                        <span className="font-bold text-xl text-slate-800 tracking-tight">Contactos</span>
                        <span className="bg-[#E5F9ED] text-[#55D080] text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide">ONLINE</span>
                    </div>
                </div>

                {/* Búsqueda */}
                <div className="px-4 pb-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar contacto..."
                            className="w-full bg-[#F5F7F8] border-none rounded-lg px-4 pl-9 py-2 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-300"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Lista de Usuarios */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading && (
                        <div className="p-8 text-center text-slate-400 text-sm">Cargando contactos...</div>
                    )}
                    {!isLoading && filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            No se encontraron contactos.
                        </div>
                    )}
                    {filteredUsers.map(u => {
                        const isSelected = selectedUser?.ID === u.ID;
                        const fullName = `${u.NAME} ${u.LAST_NAME}`;

                        return (
                            <div
                                key={u.ID}
                                onClick={() => setSelectedUser(u)}
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative ${isSelected ? 'bg-[#EBF9FF]' : 'hover:bg-slate-50'}`}
                            >
                                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2FC6F6]"></div>}

                                <div className="relative flex-shrink-0">
                                    {u.PERSONAL_PHOTO ? (
                                        <img src={u.PERSONAL_PHOTO} alt={u.NAME} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                            {getInitials(u.NAME)}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#20C962] border-2 border-white rounded-full"></div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h4 className={`text-sm truncate ${isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{fullName}</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{u.WORK_POSITION || 'Usuario Bitrix'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ÁREA PRINCIPAL (CHAT) */}
            <div className={`flex-1 flex-col h-full bg-[#F5F7F8] relative min-w-0 ${selectedUser ? 'flex' : 'hidden md:flex'}`}>

                {selectedUser ? (
                    <>
                        {/* CABECERA DEL CHAT */}
                        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-3 md:gap-4">
                                <button onClick={() => setSelectedUser(null)} className="md:hidden text-slate-500 hover:text-slate-700">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <div className="relative">
                                    {selectedUser.PERSONAL_PHOTO ? (
                                        <img src={selectedUser.PERSONAL_PHOTO} alt={selectedUser.NAME} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                            {getInitials(selectedUser.NAME)}
                                        </div>
                                    )}
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${pollingError ? 'bg-red-500' : 'bg-[#20C962]'} border-2 border-white rounded-full`}></div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">{selectedUser.NAME} {selectedUser.LAST_NAME}</h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 ${pollingError ? 'bg-red-500' : 'bg-[#20C962]'} rounded-full`}></span>
                                        {pollingError ? 'Error de Conexión' : 'En Vivo'} <span className="text-slate-300">|</span> {selectedUser.WORK_POSITION || 'Usuario'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* MENSAJES */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 z-0">
                            {isLoadingChat && (
                                <div className="flex justify-center p-4">
                                    <svg className="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                            )}
                            {!isLoadingChat && activeMessages.length === 0 && (
                                <div className="text-center text-slate-400 text-sm mt-10">No hay mensajes previos con este contacto.</div>
                            )}
                            {activeMessages.map((msg, idx) => {
                                const isOutgoing = msg.sender === 'Workshop'; // Workshop = Nosotros (El usuario actual de la app)
                                const alignRight = isOutgoing;

                                return (
                                    <div key={idx} className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] text-sm rounded-xl px-4 py-2.5 shadow-sm relative ${alignRight
                                            ? 'bg-[#E3F2FD] text-slate-800 rounded-tr-none'
                                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                                            }`}>
                                            {renderMessageContent(msg.text, msg.files, !isOutgoing)}
                                            <span className="text-[10px] text-slate-400 block text-right mt-1">{msg.timestamp}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* ÁREA DE ENTRADA */}
                        <div className="bg-white p-4 border-t border-slate-200 z-10">
                            {/* Previsualización de Adjuntos */}
                            {tempAttachments.length > 0 && (
                                <div className="flex gap-3 overflow-x-auto mb-3 pb-2">
                                    {tempAttachments.map((att, idx) => (
                                        <div key={idx} className="relative group w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {att.type === 'image' ? (
                                                <img src={att.preview} alt="previsualización" className="w-full h-full object-cover" />
                                            ) : (
                                                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                                            )}
                                            <button
                                                onClick={() => removeAttachment(idx)}
                                                className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-3 max-w-5xl mx-auto">
                                {/* Clip de papel */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSending}
                                    className="p-2.5 text-slate-400 hover:text-slate-600 bg-transparent rounded-full hover:bg-slate-100 transition-colors mb-0.5 disabled:opacity-50"
                                >
                                    <svg className="w-6 h-6 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />

                                {/* Campo de Entrada */}
                                <div className="flex-1 border border-slate-200 bg-white rounded-xl shadow-sm flex items-center px-4 py-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder={isSending ? "Enviando..." : "Escribe un mensaje..."}
                                        value={chatInput}
                                        disabled={isSending}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    />
                                </div>

                                {/* Botón de Envío */}
                                <button
                                    onClick={handleSendMessage}
                                    disabled={(!chatInput.trim() && tempAttachments.length === 0) || isSending}
                                    className={`p-3.5 rounded-lg shadow-sm mb-0.5 transition-all flex items-center justify-center ${(chatInput.trim() || tempAttachments.length > 0) && !isSending
                                        ? 'bg-[#E3F2FD] text-[#00AEEF] hover:bg-[#d0ebfc]'
                                        : 'bg-slate-100 text-slate-300'
                                        }`}
                                >
                                    {isSending ? (
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 ml-0.5" viewBox="0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="w-24 h-24 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                        </div>
                        <h3 className="text-lg font-medium text-slate-600 mb-1">Selecciona un Contacto</h3>
                        <p className="text-sm">Elige un usuario de la lista para empezar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Valuations;
