import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const EmailConfig: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
      email: '',
      host: '',
      port: '587',
      password: '',
      senderName: 'Taller Manolo Workshop'
  });
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  useEffect(() => {
    const saved = localStorage.getItem('vp_email_config');
    if (saved) {
      setConfig(JSON.parse(saved));
      setStatus('connected');
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleConnect = () => {
    setStatus('checking');
    
    // Simulate SMTP Connection Check
    setTimeout(() => {
      if (config.email && config.host) {
        localStorage.setItem('vp_email_config', JSON.stringify({ 
            ...config,
            connectedAt: new Date().toISOString() 
        }));
        setStatus('connected');
      } else {
        setStatus('error');
      }
    }, 1500);
  };

  const handleDemoSetup = () => {
      const demoConfig = {
          email: 'workshop@tallermanolo.com',
          host: 'smtp.gmail.com',
          port: '587',
          password: 'demo_app_password',
          senderName: 'Taller Manolo'
      };
      setConfig(demoConfig);
      setStatus('checking');
      setTimeout(() => {
          localStorage.setItem('vp_email_config', JSON.stringify({ 
              ...demoConfig,
              connectedAt: new Date().toISOString() 
          }));
          setStatus('connected');
      }, 1000);
  };

  const handleDisconnect = () => {
    if(window.confirm('Remove email configuration?')) {
        localStorage.removeItem('vp_email_config');
        setConfig({ email: '', host: '', port: '', password: '', senderName: '' });
        setStatus('idle');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <span className="bg-blue-600 text-white p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Email Integration
        </h1>
        <p className="text-slate-500">Configure your workshop's email to communicate with experts directly from the chat.</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-8 relative overflow-hidden">
        
        {status === 'connected' ? (
             <div className="text-center py-8 animate-fade-in-up">
                 <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-2">Email Connected</h3>
                 <p className="text-slate-500 mb-1">Account: <strong>{config.email}</strong></p>
                 <p className="text-xs text-slate-400 mb-8">Server: {config.host}:{config.port}</p>
                 
                 <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded mb-6 max-w-sm mx-auto">
                     <strong>Simulation Mode Active:</strong> Emails will be simulated via Toast notifications and auto-replies. No real emails will be sent in this demo environment.
                 </div>

                 <div className="flex justify-center gap-4">
                     <button onClick={() => navigate('/valuations')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md">
                         Go to Chats
                     </button>
                     <button onClick={handleDisconnect} className="bg-white text-red-500 border border-red-200 px-6 py-2 rounded-lg font-medium hover:bg-red-50">
                         Disconnect
                     </button>
                 </div>
             </div>
        ) : (
            <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Workshop Email Address</label>
                        <input 
                            type="email" 
                            name="email"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={config.email}
                            onChange={handleChange}
                            placeholder="workshop@example.com"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Sender Name</label>
                        <input 
                            type="text" 
                            name="senderName"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={config.senderName}
                            onChange={handleChange}
                            placeholder="Taller Manolo"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">SMTP Host</label>
                        <input 
                            type="text" 
                            name="host"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={config.host}
                            onChange={handleChange}
                            placeholder="smtp.gmail.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">SMTP Port</label>
                        <input 
                            type="text" 
                            name="port"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={config.port}
                            onChange={handleChange}
                            placeholder="587"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">App Password / API Key</label>
                        <input 
                            type="password" 
                            name="password"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                            value={config.password}
                            onChange={handleChange}
                            placeholder="••••••••••••"
                        />
                        <p className="text-xs text-slate-400 mt-1">We recommend using an App Password for security.</p>
                    </div>
                </div>
                
                {status === 'error' && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Connection failed. Please check your settings.
                    </div>
                )}

                <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                    <button 
                        onClick={handleDemoSetup}
                        className="px-4 py-3 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors text-sm"
                    >
                        Use Demo Settings
                    </button>
                    <button 
                        onClick={handleConnect}
                        disabled={status === 'checking'}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition-all disabled:opacity-70 flex items-center gap-2"
                    >
                        {status === 'checking' ? 'Connecting...' : 'Save & Connect'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default EmailConfig;