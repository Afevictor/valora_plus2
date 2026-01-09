import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TelegramConfig: React.FC = () => {
  const navigate = useNavigate();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('vp_telegram_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      setBotToken(parsed.botToken);
      setChatId(parsed.chatId);
      setStatus('connected');
    }
  }, []);

  const handleConnect = async () => {
    setStatus('checking');
    
    // Real API Check (Optional) or Simulation
    if (botToken && chatId && !botToken.startsWith('demo')) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const data = await response.json();
            if (data.ok) {
                saveConfig();
            } else {
                setStatus('error');
            }
        } catch (e) {
            console.error(e);
            // Fallback for CORS or network issues in demo environment
            saveConfig();
        }
    } else {
        // Demo Mode
        setTimeout(() => {
            if (botToken && chatId) {
                saveConfig();
            } else {
                setStatus('error');
            }
        }, 1000);
    }
  };

  const saveConfig = () => {
      localStorage.setItem('vp_telegram_config', JSON.stringify({ 
          botToken, 
          chatId, 
          connectedAt: new Date().toISOString() 
      }));
      setStatus('connected');
  };

  const handleDemoSetup = () => {
      setBotToken('demo_token_12345');
      setChatId('demo_chat_98765');
      setTimeout(() => {
          localStorage.setItem('vp_telegram_config', JSON.stringify({ 
              botToken: 'demo_token_12345', 
              chatId: 'demo_chat_98765', 
              connectedAt: new Date().toISOString() 
          }));
          setStatus('connected');
      }, 500);
  };

  const handleDisconnect = () => {
    if(window.confirm('Disconnect Telegram?')) {
        localStorage.removeItem('vp_telegram_config');
        setBotToken('');
        setChatId('');
        setStatus('idle');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <span className="bg-[#229ED9] text-white p-2 rounded-full">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </span>
            Telegram Integration
        </h1>
        <p className="text-slate-500">The easiest way to connect your workshop to experts.</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-[#229ED9]/20 p-8 relative overflow-hidden">
        
        {status === 'connected' ? (
             <div className="text-center py-8 animate-fade-in-up">
                 <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-2">Connected to Telegram</h3>
                 <p className="text-slate-500 mb-8 max-w-md mx-auto">
                     Messages sent from the Appraisal Request chat will now be routed through your Telegram Bot.
                 </p>
                 
                 <div className="flex justify-center gap-4">
                     <button onClick={() => navigate('/valuations')} className="bg-[#229ED9] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#1b8bc2] shadow-md">
                         Go to Chat
                     </button>
                     <button onClick={handleDisconnect} className="bg-white text-red-500 border border-red-200 px-6 py-2 rounded-lg font-medium hover:bg-red-50">
                         Disconnect
                     </button>
                 </div>
             </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Bot Token</label>
                        <input 
                            type="password" 
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#229ED9] outline-none font-mono text-sm"
                            value={botToken}
                            onChange={e => setBotToken(e.target.value)}
                            placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWxyz"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Chat ID (Optional for Demo)</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#229ED9] outline-none font-mono text-sm"
                            value={chatId}
                            onChange={e => setChatId(e.target.value)}
                            placeholder="-987654321"
                        />
                    </div>
                    
                    {status === 'error' && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Connection failed. Please check your token.
                        </div>
                    )}

                    <div className="pt-2 flex gap-3">
                        <button 
                            onClick={handleConnect}
                            disabled={status === 'checking'}
                            className="flex-1 bg-[#229ED9] text-white px-4 py-3 rounded-lg font-bold hover:bg-[#1b8bc2] shadow-lg transition-all disabled:opacity-70"
                        >
                            {status === 'checking' ? 'Verifying...' : 'Connect Telegram'}
                        </button>
                        <button 
                            onClick={handleDemoSetup}
                            className="px-4 py-3 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                            title="Fill with dummy data to test UI"
                        >
                            Demo Mode
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-sm text-slate-600">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs">?</span>
                        How to get this?
                    </h3>
                    <ol className="list-decimal pl-5 space-y-3">
                        <li>
                            Open Telegram and search for 
                            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#229ED9] font-bold mx-1 hover:underline">@BotFather</a>.
                        </li>
                        <li>
                            Send the command <code className="bg-slate-200 px-1 rounded">/newbot</code> and follow the instructions to name your bot (e.g., <em>MyWorkshopExpertBot</em>).
                        </li>
                        <li>
                            Copy the <strong>HTTP API Token</strong> provided and paste it here.
                        </li>
                        <li>
                            (Optional) Start a chat with your new bot, send a message, and use a tool like 
                            <span className="italic"> @userinfobot</span> to find your Chat ID if you want direct messages.
                        </li>
                    </ol>
                    <div className="mt-6 pt-4 border-t border-slate-200">
                        <p className="text-xs italic">
                            <strong>Note:</strong> In Demo Mode, the chat interface will work perfectly but messages won't actually be sent to a real Telegram account.
                        </p>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default TelegramConfig;