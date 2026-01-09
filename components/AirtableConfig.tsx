import React, { useState, useEffect } from 'react';
import { airtableService } from '../services/airtableService';

const AirtableConfig: React.FC = () => {
  const [config, setConfig] = useState({
      apiKey: '',
      baseId: '',
      tableName: 'Valuations'
  });
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const saved = airtableService.getConfig();
    if (saved) {
      setConfig(saved);
      setStatus('connected');
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfig({ ...config, [e.target.name]: e.target.value });
      setStatus('idle');
  };

  const handleConnect = async () => {
    setStatus('checking');
    setErrorMsg('');
    
    try {
        const success = await airtableService.testConnection(config);
        if (success) {
            airtableService.saveConfig(config);
            setStatus('connected');
        } else {
            setStatus('error');
            setErrorMsg('Could not connect. Check Base ID and Table Name.');
        }
    } catch (e) {
        setStatus('error');
        setErrorMsg('Connection failed. Check your Personal Access Token.');
    }
  };

  const handleDisconnect = () => {
      localStorage.removeItem('vp_airtable_config');
      setConfig({ apiKey: '', baseId: '', tableName: 'Valuations' });
      setStatus('idle');
  };

  return (
    <div className="max-w-3xl mx-auto p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <span className="bg-yellow-400 text-white p-2 rounded-full">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12.63 21.95L21.57 15.65C22.14 15.25 22.14 14.39 21.57 13.99L12.63 7.69C12.24 7.42 11.76 7.42 11.37 7.69L2.43 13.99C1.86 14.39 1.86 15.25 2.43 15.65L11.37 21.95C11.76 22.23 12.24 22.23 12.63 21.95Z" opacity="0.5"/><path d="M11.37 2.05L2.43 8.35C1.86 8.75 1.86 9.61 2.43 10.01L11.37 16.31C11.76 16.58 12.24 16.58 12.63 16.31L21.57 10.01C22.14 9.61 22.14 8.75 21.57 8.35L12.63 2.05C12.24 1.77 11.76 1.77 11.37 2.05Z"/></svg>
            </span>
            Airtable Integration
        </h1>
        <p className="text-slate-500">Sync your claims and valuations directly to an Airtable Base.</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-yellow-100 p-8 relative overflow-hidden">
        
        {status === 'connected' ? (
             <div className="text-center py-8 animate-fade-in-up">
                 <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-2">Connected to Airtable</h3>
                 <p className="text-slate-500 mb-1">Base: <strong>{config.baseId}</strong></p>
                 <p className="text-slate-500 mb-8">Table: <strong>{config.tableName}</strong></p>
                 
                 <div className="flex justify-center gap-4">
                     <button onClick={handleDisconnect} className="bg-white text-red-500 border border-red-200 px-6 py-2 rounded-lg font-medium hover:bg-red-50">
                         Disconnect
                     </button>
                 </div>
             </div>
        ) : (
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-600 mb-6">
                    <p className="font-bold mb-2">Prerequisites:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Create a Table in Airtable with these columns (Case Sensitive):</li>
                        <li className="font-mono text-xs bg-slate-200 inline-block px-1 rounded">ID, Date, Status, Vehicle, Plate, Insured, Company</li>
                        <li>Generate a <strong>Personal Access Token</strong> with <code>data.records:write</code> scope.</li>
                    </ul>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Personal Access Token (PAT)</label>
                    <input 
                        type="password" 
                        name="apiKey"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-mono"
                        value={config.apiKey}
                        onChange={handleChange}
                        placeholder="pat....."
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Base ID</label>
                        <input 
                            type="text" 
                            name="baseId"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-mono"
                            value={config.baseId}
                            onChange={handleChange}
                            placeholder="app....."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Table Name</label>
                        <input 
                            type="text" 
                            name="tableName"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
                            value={config.tableName}
                            onChange={handleChange}
                            placeholder="Valuations"
                        />
                    </div>
                </div>
                
                {status === 'error' && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {errorMsg || 'Connection failed. Check credentials.'}
                    </div>
                )}

                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={handleConnect}
                        disabled={status === 'checking'}
                        className="bg-slate-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-black shadow-lg transition-all disabled:opacity-70 flex items-center gap-2"
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

export default AirtableConfig;