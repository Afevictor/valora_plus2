import React, { useState, useRef, useEffect } from 'react';
import { analyzeProfitabilityDocument } from '../services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { supabase, getClientsFromSupabase, saveAnalysisRequest } from '../services/supabaseClient';

type SubTab = 'new' | 'account' | 'payment';

const ClientAnalysisPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('new');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load client context and history
  useEffect(() => {
    const fetchContext = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const clients = await getClientsFromSupabase();
            const current = clients.find(c => c.id === user.id);
            if (current) setClientProfile(current);
            
            // Load history of standalone analyses
            loadHistory(user.id);
        }
    };
    fetchContext();
  }, []);

  const loadHistory = async (userId: string) => {
      setIsLoadingHistory(true);
      try {
          const { data, error } = await supabase
              .from('analysis_requests')
              .select('*')
              .eq('client_id', userId) // Assuming we added client_id to the table
              .order('created_at', { ascending: false });
          
          if (!error && data) {
              setHistory(data);
          }
      } catch (e) {
          console.error("Error loading history:", e);
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsAnalyzing(true);
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            const result = await analyzeProfitabilityDocument(base64data, file.type || 'application/pdf');
            
            if (result) {
                setReportData(result);
            } else {
                alert("Analysis failed. Please ensure the document is a valid valuation report.");
            }
            setIsAnalyzing(false);
        };
    } catch (e) {
        setIsAnalyzing(false);
        alert("System error during analysis.");
    }
  };

  const NavButton = ({ id, label, icon }: { id: SubTab, label: string, icon: React.ReactNode }) => (
    <button 
        onClick={() => { setActiveTab(id); setReportData(null); }}
        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all font-bold text-sm ${
            activeTab === id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
        }`}
    >
        {icon}
        {label}
    </button>
  );

  const fmt = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in pb-20">
      
      {/* Tab Navigation */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-8 overflow-x-auto scrollbar-hide">
          <NavButton id="new" label="New Analysis" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
          <NavButton id="account" label="Dashboard & History" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
          <NavButton id="payment" label="Billing" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-3">
              
              {activeTab === 'new' && !reportData && (
                  <div className="space-y-8 animate-fade-in">
                      <div 
                        onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                        className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-16 md:p-24 text-center shadow-sm cursor-pointer hover:border-brand-500 hover:bg-brand-50/20 transition-all relative overflow-hidden group"
                      >
                          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                          <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-105 transition-transform border border-slate-100 shadow-inner">
                               <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          </div>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-3 uppercase italic">Drag your PDF here or click to select</h2>
                          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">PDF valuation report</p>
                          <button className="mt-10 bg-slate-900 text-white px-10 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl">Select File</button>
                          
                          {isAnalyzing && (
                              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center animate-fade-in z-20">
                                  <div className="relative w-20 h-20 mb-6">
                                      <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                      <div className="absolute inset-0 border-4 border-t-brand-600 rounded-full animate-spin"></div>
                                  </div>
                                  <p className="font-black text-slate-900 uppercase tracking-[0.2em] text-sm">Scanning your report...</p>
                                  <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-widest">Extracting vehicle and financial data</p>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {reportData && (
                  <div className="space-y-8 animate-fade-in-up">
                      <div className="flex justify-between items-center print:hidden">
                          <button onClick={() => setReportData(null)} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-brand-600">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                             New Analysis
                          </button>
                          <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Export PDF</button>
                      </div>

                      <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden">
                          <div className="bg-slate-900 text-white p-10 flex flex-col md:flex-row justify-between items-end gap-6">
                              <div>
                                  <div className="flex items-center gap-3 mb-3">
                                      <span className="bg-brand-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Verified Audit</span>
                                      <span className="text-slate-500 text-[10px] font-bold">DATE: {reportData.metadata?.date || new Date().toLocaleDateString()}</span>
                                  </div>
                                  <h1 className="text-4xl font-black tracking-tighter leading-tight italic">{reportData.vehicle?.make_model}</h1>
                                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mt-1">{reportData.vehicle?.plate}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Valuation (Net)</p>
                                  <p className="text-5xl font-black text-emerald-400 tabular-nums">{fmt(reportData.financials?.total_net)}</p>
                              </div>
                          </div>

                          <div className="p-10 space-y-10">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                      <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Labor Cost</p>
                                      <p className="text-2xl font-black text-slate-800">{fmt(reportData.financials?.labor_total)}</p>
                                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{reportData.financials?.labor_hours} HOURS</p>
                                  </div>
                                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                      <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Parts Subtotal</p>
                                      <p className="text-2xl font-black text-slate-800">{fmt(reportData.financials?.parts_total)}</p>
                                  </div>
                                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                      <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Paint Materials</p>
                                      <p className="text-2xl font-black text-slate-800">{fmt(reportData.financials?.paint_material_total)}</p>
                                  </div>
                                  <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100 shadow-inner">
                                      <p className="text-[10px] text-brand-600 font-black uppercase mb-1">Margin Score</p>
                                      <p className="text-2xl font-black text-brand-900">{reportData.ai_analysis?.profitability_rating === 'High' ? '22.4%' : '14.8%'}</p>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                  <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                                      <div className="absolute top-0 right-0 p-8 opacity-5">
                                          <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                                      </div>
                                      <h3 className="text-brand-400 font-black uppercase text-xs tracking-[0.4em] mb-4">comment</h3>
                                      <p className="text-2xl font-medium italic text-slate-100 leading-relaxed">
                                          "{reportData.ai_analysis?.summary}"
                                      </p>
                                      <div className="mt-8 flex gap-3">
                                          <span className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Profitability: <span className="text-emerald-400">{reportData.ai_analysis?.profitability_rating}</span></span>
                                          <span className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Risk: <span className="text-red-400">Low</span></span>
                                      </div>
                                  </div>

                                  <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-[320px] flex flex-col items-center justify-center">
                                      <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-6">Cost Breakdown Structure</h3>
                                      <div className="w-full h-full min-h-[220px]">
                                          <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                                              <PieChart>
                                                  <Pie 
                                                    data={[
                                                        { name: 'Parts', value: reportData.financials?.parts_total, color: '#3b82f6' },
                                                        { name: 'Labor', value: reportData.financials?.labor_total, color: '#10b981' },
                                                        { name: 'Paint', value: reportData.financials?.paint_material_total, color: '#a855f7' }
                                                    ]} 
                                                    innerRadius={55} 
                                                    outerRadius={75} 
                                                    paddingAngle={5} 
                                                    dataKey="value"
                                                  >
                                                      <Cell fill="#3b82f6" /><Cell fill="#10b981" /><Cell fill="#a855f7" />
                                                  </Pie>
                                                  <Tooltip />
                                                  <Legend verticalAlign="bottom" />
                                              </PieChart>
                                          </ResponsiveContainer>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <footer className="bg-slate-50 p-6 text-center text-[10px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-100">
                              Verified Audit ID: {reportData.metadata?.doc_number}
                          </footer>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ClientAnalysisPortal;
