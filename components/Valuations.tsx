
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ValuationRequest, ValuationChatMsg, Employee } from '../types';
import { notificationService } from '../services/notificationService';
import { 
    getValuationsFromSupabase, 
    getEmployeesFromSupabase, 
    getCompanyProfileFromSupabase,
    uploadChatAttachment,
    deleteValuation, 
    saveAnalysisRequest,
    supabase
} from '../services/supabaseClient';
import { emailService } from '../services/emailService';
import { getBitrixUsers, BitrixUser, sendBitrixMessage, getBitrixMessages } from '../services/bitrixService';

// Helper to convert file to Base64 for fallback
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Robust Date Formatter
const formatMessageTime = (dateStr?: string | Date, fallback?: string) => {
    if (!dateStr) return fallback || '';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback || '';
    
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    
    if (isToday) {
        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } else {
        return `${date.getDate()}/${date.getMonth()+1} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
};

const Valuations: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [valuations, setValuations] = useState<ValuationRequest[]>([]);
  const [contacts, setContacts] = useState<Employee[]>([]);
  const [bitrixUsers, setBitrixUsers] = useState<BitrixUser[]>([]);
  const [selectedValuation, setSelectedValuation] = useState<ValuationRequest | null>(null);
  const [activeMessages, setActiveMessages] = useState<ValuationChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  
  // Track analyzed items to toggle button state
  const [analyzedItems, setAnalyzedItems] = useState<Set<string>>(new Set());

  // Attachments State
  const [tempAttachments, setTempAttachments] = useState<{file: File, preview: string, type: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sending State for UI Feedback
  const [isSending, setIsSending] = useState(false);
  const [pollingError, setPollingError] = useState(false); 

  // New State for Company Email
  const [companyEmail, setCompanyEmail] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        
        // Load Company Profile
        const profile = await getCompanyProfileFromSupabase();
        if (profile && profile.email) {
            setCompanyEmail(profile.email);
        }

        // Load Employees
        const allEmployees = await getEmployeesFromSupabase();
        // Fixed: Updated comparison to use 'Expert / Appraiser' to match EmployeeRole type in types.ts.
        const expertContacts = allEmployees.filter(e => e.role === 'Expert / Appraiser');
        setContacts(expertContacts);

        // Load Bitrix Users
        const bUsers = await getBitrixUsers();
        setBitrixUsers(bUsers);

        // Load Valuations - STRICT DB ONLY
        const dbData = await getValuationsFromSupabase();
        
        if (dbData && dbData.length > 0) {
            const processed = dbData.map(v => ({
                 ...v,
                 claimsStage: v.claimsStage || 'draft'
            }));
            setValuations(processed);
        } else {
            setValuations([]);
        }

        setIsLoading(false);
    };

    fetchData();
  }, []);

  // Separate effect for Auto-Selection from Navigation State
  useEffect(() => {
      if (location.state?.selectedId && valuations.length > 0) {
          const target = valuations.find(v => v.id === location.state.selectedId);
          if (target) {
              setSelectedValuation(target);
          }
      }
  }, [valuations, location.state]);

  const getValuationId = (v: ValuationRequest) => v.id;

  // --- BITRIX CHAT LOADING (Direct from API, No DB) ---
  useEffect(() => {
      let interval: any;

      const fetchBitrixChat = async () => {
          if (!selectedValuation || !selectedValuation.assignedExpertId) {
              setActiveMessages([]);
              return;
          }

          // Only show loading indicator on first load or selection change, not polling
          if (!interval) setIsLoadingChat(true);

          try {
              // Fetch directly from Bitrix API
              const messages = await getBitrixMessages(selectedValuation.assignedExpertId);
              setPollingError(false);
              
              if (messages && Array.isArray(messages)) {
                  const mappedMessages: ValuationChatMsg[] = messages.map((bxMsg: any) => {
                      // Determine Sender: If Author ID matches Expert ID, it's Expert. Otherwise Workshop.
                      const isExpert = String(bxMsg.author_id) === String(selectedValuation.assignedExpertId);
                      
                      return {
                          id: String(bxMsg.id),
                          sender: isExpert ? 'Expert' : 'Workshop',
                          text: bxMsg.text || '',
                          timestamp: formatMessageTime(bxMsg.date),
                          rawDate: bxMsg.date,
                          deliveryStatus: 'delivered', // Assume delivered if returned by API
                          isEmail: false,
                          files: [] // Bitrix API basic fetch might not include file details easily in this endpoint without extra parsing
                      };
                  });

                  // Sort by date ascending
                  mappedMessages.sort((a, b) => new Date(a.rawDate || 0).getTime() - new Date(b.rawDate || 0).getTime());
                  
                  setActiveMessages(mappedMessages);
              } else {
                  setActiveMessages([]);
              }
          } catch (e) {
              console.error("Error loading Bitrix chat:", e);
              setPollingError(true);
          } finally {
              setIsLoadingChat(false);
          }
      };

      if (selectedValuation) {
          fetchBitrixChat();
          // Poll every 5 seconds for new messages from Bitrix
          interval = setInterval(fetchBitrixChat, 5000);
      }

      return () => {
          if (interval) clearInterval(interval);
      };
  }, [selectedValuation]);

  useEffect(() => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
  }, [activeMessages, tempAttachments]); 

  // ... (Attachment & Send Message Handlers)
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
      if (!selectedValuation || (!chatInput.trim() && tempAttachments.length === 0) || isSending) return;
      
      // Check if Bitrix Expert is assigned
      if (!selectedValuation.assignedExpertId) {
          alert("No Bitrix Expert assigned to this valuation. Cannot send message.");
          return;
      }

      setIsSending(true);
      
      try {
        const fileLinks: string[] = [];
        let uploadFailed = false;
        
        // 1. Upload Attachments to Cloud (Supabase Storage)
        if (tempAttachments.length > 0) {
            try {
                for (const att of tempAttachments) {
                    const publicUrl = await uploadChatAttachment(att.file);
                    if (publicUrl) {
                        fileLinks.push(publicUrl);
                    } else {
                        console.warn("Bucket upload failed, falling back to Base64");
                        uploadFailed = true;
                        const b64 = await fileToBase64(att.file);
                        fileLinks.push(b64);
                    }
                }
            } catch (e) {
                console.error("Error processing files", e);
                setIsSending(false);
                return;
            }
        }
        
        if (uploadFailed) {
            notificationService.add({ type: 'alert', title: 'Upload Issue', message: 'Some files sent as text links.' });
        }
        
        // 2. Prepare Message for Bitrix
        let fullMsg = chatInput;
        if (fileLinks.length > 0) {
            fullMsg += `\n\nAttachments:\n${fileLinks.map(link => link.startsWith('data:') ? '(Image Data)' : link).join('\n')}`;
        }

        // 3. Send Directly to Bitrix
        const success = await sendBitrixMessage(selectedValuation.assignedExpertId, fullMsg);

        if (success) {
            // Optimistic UI Update
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
            alert("Failed to send message to Bitrix. Please check connection.");
        }

      } catch (e) {
          console.error("Failed to send message", e);
          alert("Error sending message.");
      } finally {
          setIsSending(false);
      }
  };

  // --- DELETE VALUATION (DB) ---
  const handleDeleteValuation = async () => {
      if (!selectedValuation) return;
      if (window.confirm("WARNING: Delete this valuation request permanently?")) {
          const targetId = getValuationId(selectedValuation);
          
          deleteValuation(targetId).then(success => {
              if (success) {
                  setValuations(prev => prev.filter(v => v.id !== targetId));
                  setSelectedValuation(null);
                  notificationService.add({ type: 'success', title: 'Deleted', message: 'Valuation removed.' });
              } else {
                  alert("Failed to delete valuation from database.");
              }
          });
      }
  };

  const handleAnalyze = async (url: string) => {
      if (!selectedValuation) return;
      const valuationId = getValuationId(selectedValuation);
      notificationService.add({ type: 'info', title: 'Sending to Analysis', message: 'Requesting AI analysis for document...' });
      const result = await saveAnalysisRequest(valuationId, url);
      if (result) {
          notificationService.add({ type: 'success', title: 'Analysis Requested', message: 'Document queued for processing.' });
          setAnalyzedItems(prev => new Set(prev).add(url));
      } else {
          notificationService.add({ type: 'alert', title: 'Error', message: 'Could not queue analysis. Check database connection.' });
      }
  };

  // ... (Render Helpers)
  const renderMessageContent = (text: string, files: string[] | undefined, isIncoming: boolean) => {
      const safeText = text || "";
      // Regular expression to find URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      
      const allLinksInText = safeText.match(urlRegex) || [];
      const explicitFiles = Array.isArray(files) ? files : [];
      
      // Combine and deduplicate URLs from text and explicit files
      const uniqueLinks = [...new Set([...explicitFiles, ...allLinksInText])];

      return (
          <div>
              {safeText && <p className="whitespace-pre-wrap mb-1 text-sm">{safeText}</p>}
              
              {uniqueLinks.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                      {uniqueLinks.map((link, idx) => {
                          
                          // Simplified view for Outgoing (Sender)
                          if (!isIncoming) {
                              return (
                                  <div key={`res-${idx}`} className="bg-white/50 border border-blue-200 rounded p-2 text-xs">
                                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                          Attachment/Link {idx + 1}
                                      </a>
                                  </div>
                              );
                          }

                          // Rich Card view for Incoming (Recipient)
                          // Simple file type detection based on extension or URL pattern
                          const isImage = link.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || link.startsWith('data:image');
                          const isPdf = link.match(/\.pdf($|\?)/i);
                          const isDocs = link.includes('docs.google.com') || link.includes('drive.google.com');
                          
                          let icon = 'DOC';
                          let bg = 'bg-gray-100 text-gray-600';
                          
                          if (isImage) { icon = 'IMG'; bg = 'bg-blue-100 text-blue-600'; }
                          else if (isPdf) { icon = 'PDF'; bg = 'bg-red-100 text-red-600'; }
                          else if (isDocs) { icon = 'CLD'; bg = 'bg-green-100 text-green-600'; }

                          return (
                              <div key={`res-${idx}`} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                  <div className="flex items-center gap-3 mb-2">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${bg}`}>
                                          {icon}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-700 truncate">Resource Detected</p>
                                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 truncate block hover:underline">
                                              {link}
                                          </a>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button 
                                          onClick={() => window.open(link, '_blank')}
                                          className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs py-1.5 rounded hover:bg-slate-50 font-medium transition-colors"
                                      >
                                          Download / Open
                                      </button>
                                      
                                      {analyzedItems.has(link) ? (
                                          <button disabled className="flex-1 bg-green-100 border border-green-200 text-green-700 text-xs py-1.5 rounded font-medium flex items-center justify-center gap-1 cursor-default">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                              Sent to Analysis
                                          </button>
                                      ) : (
                                          <button 
                                              onClick={() => handleAnalyze(link)}
                                              className="flex-1 bg-indigo-600 border border-indigo-600 text-white text-xs py-1.5 rounded hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-1"
                                          >
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                              Analyze
                                          </button>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      );
  };

  const getChatName = (v: ValuationRequest) => {
      const ticketId = v.ticketNumber || v.id;
      if (v.assignedExpertId) {
          const bitrixExpert = bitrixUsers.find(u => u.ID === v.assignedExpertId);
          if (bitrixExpert) return `${bitrixExpert.NAME} ${bitrixExpert.LAST_NAME}`;
          const expert = contacts.find(c => c.id === v.assignedExpertId);
          if (expert) return expert.fullName;
      }
      return v.insuredName || `Ticket ${ticketId}`;
  };

  const getChatSubtext = (v: ValuationRequest) => {
      if (v.assignedExpertId) {
          const bitrixExpert = bitrixUsers.find(u => u.ID === v.assignedExpertId);
          if (bitrixExpert) return bitrixExpert.WORK_POSITION || 'Expert';
      }
      return v.vehicle.plate;
  };

  const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const filteredValuations = valuations.filter(v => 
      getChatName(v).toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh)] bg-white overflow-hidden font-sans">
        
        {/* SIDEBAR */}
        <div className="w-80 md:w-[360px] flex flex-col bg-white border-r border-slate-200">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-[#2FC6F6] text-white p-1 rounded font-bold text-xs">b24</div>
                    <span className="font-bold text-xl text-slate-800 tracking-tight">Chats</span>
                    <span className="bg-[#E5F9ED] text-[#55D080] text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide">LIVE</span>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 pb-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="w-full bg-[#F5F7F8] border-none rounded-lg px-4 pl-9 py-2 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-300"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filteredValuations.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        No active chats found.
                    </div>
                )}
                {filteredValuations.map(v => {
                    const isSelected = selectedValuation?.id === v.id;
                    const name = getChatName(v);
                    const subtext = getChatSubtext(v);
                    const hasBitrix = bitrixUsers.some(u => u.ID === v.assignedExpertId);

                    return (
                        <div 
                            key={v.id}
                            onClick={() => setSelectedValuation(v)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative ${isSelected ? 'bg-[#EBF9FF]' : 'hover:bg-slate-50'}`}
                        >
                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2FC6F6]"></div>}
                            
                            <div className="relative flex-shrink-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${hasBitrix ? 'bg-blue-600' : 'bg-slate-400'}`}>
                                    {getInitials(name)}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#20C962] border-2 border-white rounded-full"></div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className={`text-sm truncate ${isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{name}</h4>
                                    <span className="text-[10px] text-slate-400">{v.requestDate}</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                                    {subtext}
                                    {hasBitrix && <svg className="w-3 h-3 text-[#2FC6F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col h-full bg-[#F5F7F8] relative min-w-0">
            
            {selectedValuation ? (
                <>
                    {/* CHAT HEADER */}
                    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm z-10">
                        <div className="flex items-center gap-4">
                             <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                    {getInitials(getChatName(selectedValuation))}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${pollingError ? 'bg-red-500' : 'bg-[#20C962]'} border-2 border-white rounded-full`}></div>
                             </div>
                             <div>
                                 <h3 className="font-bold text-slate-800 text-base">{getChatName(selectedValuation)}</h3>
                                 <p className="text-xs text-slate-500 flex items-center gap-1">
                                     <span className={`w-1.5 h-1.5 ${pollingError ? 'bg-red-500' : 'bg-[#20C962]'} rounded-full`}></span>
                                     {pollingError ? 'Connection Issue' : 'Bitrix24 Live'} <span className="text-slate-300">|</span> Expert
                                 </p>
                             </div>
                        </div>
                        
                        <div className="flex gap-2 text-slate-400 items-center">
                            {/* DELETE VALUATION (Trash) */}
                            <button onClick={handleDeleteValuation} className="hover:text-red-600 text-slate-300 transition-colors p-2" title="Delete Valuation Request">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* MESSAGES */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 z-0">
                        {isLoadingChat && (
                            <div className="flex justify-center p-4">
                                <svg className="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        )}
                        {!isLoadingChat && activeMessages.length === 0 && (
                            <div className="text-center text-slate-400 text-sm mt-10">No messages found in Bitrix24 yet.</div>
                        )}
                        {activeMessages.map((msg, idx) => {
                            const isOutgoing = msg.sender === 'Workshop';
                            
                            const alignRight = isOutgoing;

                            return (
                                <div key={idx} className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] text-sm rounded-xl px-4 py-2.5 shadow-sm relative ${
                                        alignRight 
                                        ? 'bg-[#E3F2FD] text-slate-800 rounded-tr-none' 
                                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                                    }`}>
                                        {/* Pass !isOutgoing to indicate if message is incoming */}
                                        {renderMessageContent(msg.text, msg.files, !isOutgoing)}
                                        <span className="text-[10px] text-slate-400 block text-right mt-1">{msg.timestamp}</span>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* INPUT AREA */}
                    <div className="bg-white p-4 border-t border-slate-200 z-10">
                        {/* Attachments Preview */}
                        {tempAttachments.length > 0 && (
                            <div className="flex gap-3 overflow-x-auto mb-3 pb-2">
                                {tempAttachments.map((att, idx) => (
                                    <div key={idx} className="relative group w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                        {att.type === 'image' ? (
                                            <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
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
                            {/* Paperclip */}
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSending}
                                className="p-2.5 text-slate-400 hover:text-slate-600 bg-transparent rounded-full hover:bg-slate-100 transition-colors mb-0.5 disabled:opacity-50"
                            >
                                <svg className="w-6 h-6 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />

                            {/* Input Field */}
                            <div className="flex-1 border border-slate-200 bg-white rounded-xl shadow-sm flex items-center px-4 py-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder={isSending ? "Sending to Bitrix..." : "Type a message..."}
                                    value={chatInput}
                                    disabled={isSending}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                />
                            </div>

                            {/* Send Button */}
                            <button 
                                onClick={handleSendMessage}
                                disabled={(!chatInput.trim() && tempAttachments.length === 0) || isSending}
                                className={`p-3.5 rounded-lg shadow-sm mb-0.5 transition-all flex items-center justify-center ${
                                    (chatInput.trim() || tempAttachments.length > 0) && !isSending
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
                        <div className="text-center mt-2">
                            <span className="text-[10px] text-slate-400">Press Enter to send. Shift+Enter for new line.</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="w-24 h-24 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-600 mb-1">Select a Chat</h3>
                    <p className="text-sm">Choose a contact from the list to start messaging via Bitrix24.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default Valuations;
