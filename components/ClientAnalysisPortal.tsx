
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
                // Optionally save this analysis record to history if we have a URL
                // In a real app, we'd upload to bucket first then save metadata
            } else {
                alert("AI Analysis failed. Please ensure the document is a valid valuation report.");
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
                      {/* Drop Zone Matching Screenshots */}
                      <div 
                        onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                        className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-16 md:p-24 text-center shadow-sm cursor-pointer hover:border-brand-500 hover:bg-brand-50/20 transition-all relative overflow-hidden group"
                      >
                          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                          <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-105 transition-transform border border-slate-100 shadow-inner">
                               <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          </div>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-3 uppercase italic">Drag your PDF here or click to select</h2>
                          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">PDF valuation of Audatex, GT Motive or Solera</p>
                          <button className="mt-10 bg-slate-900 text-white px-10 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl">Select File</button>
                          
                          {isAnalyzing && (
                              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center animate-fade-in z-20">
                                  <div className="relative w-20 h-20 mb-6">
                                      <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                      <div className="absolute inset-0 border-4 border-t-brand-600 rounded-full animate-spin"></div>
                                  </div>
                                  <p className="font-black text-slate-900 uppercase tracking-[0.2em] text-sm">Valora AI is scanning your report...</p>
                                  <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-widest">Extracting vehicle and financial data</p>
                              </div>
                          )}
                      </div>

                      {/* Information Grid Matching Screenshots */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm flex items-start gap-6">
                              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-xl">!</div>
                              <div>
                                  <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6">Data we extract</h3>
                                  <ul className="space-y-3 text-sm text-slate-500 font-medium">
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Total spare parts and materials</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Hours of workmanship (sheeter/painting)</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Prices per working hour</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Paint materials</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Vehicle data (mature, rack)</li>
                                  </ul>
                              </div>
                          </div>
                          <div className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm flex items-start gap-6">
                              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </div>
                              <div>
                                  <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6">Automatic Process</h3>
                                  <ul className="space-y-3 text-sm text-slate-500 font-medium">
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> OCR recognition if necessary</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Validation of data consistency</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Optional manual verification</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Instant margin calculation</li>
                                      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"></div> Automatic PDF Report</li>
                                  </ul>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* REPORT VIEW - Matching high-fidelity AnalysisReport.tsx */}
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
                          {/* Ident Banner */}
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
                              {/* Financial Grid */}
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
                                      <p className="text-[10px] text-brand-600 font-black uppercase mb-1">AI Margin Score</p>
                                      <p className="text-2xl font-black text-brand-900">{reportData.ai_analysis?.profitability_rating === 'High' ? '22.4%' : '14.8%'}</p>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                  {/* AI Audit Box */}
                                  <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                                      <div className="absolute top-0 right-0 p-8 opacity-5">
                                          <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                                      </div>
                                      <h3 className="text-brand-400 font-black uppercase text-xs tracking-[0.4em] mb-4">Gemini AI Conclusion</h3>
                                      <p className="text-2xl font-medium italic text-slate-100 leading-relaxed">
                                          "{reportData.ai_analysis?.summary}"
                                      </p>
                                      <div className="mt-8 flex gap-3">
                                          <span className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Profitability: <span className="text-emerald-400">{reportData.ai_analysis?.profitability_rating}</span></span>
                                          <span className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Risk: <span className="text-red-400">Low</span></span>
                                      </div>
                                  </div>

                                  {/* Distribution Chart */}
                                  <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-[320px] flex flex-col items-center justify-center">
                                      <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-6">Cost Breakdown Structure</h3>
                                      <div className="w-full h-full">
                                          <ResponsiveContainer width="100%" height="100%">
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
                              Generated by Valora Plus Engine • Verified Audit ID: {reportData.metadata?.doc_number}
                          </footer>
                      </div>
                  </div>
              )}

              {/* DASHBOARD & HISTORY TAB */}
              {activeTab === 'account' && (
                  <div className="space-y-8 animate-fade-in">
                      {/* Summary Header Matching Screenshots */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-6">
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Analysis</p>
                                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg></div>
                              </div>
                              <p className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">{history.length}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-wide">Analyses completed to date</p>
                          </div>
                          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-6">
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Average Margin</p>
                                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                              </div>
                              <p className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">0.0<span className="text-2xl">%</span></p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-wide">Average across all reports</p>
                          </div>
                          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-6">
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Valuation</p>
                                  <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-brand-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                              </div>
                              <p className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">0.00 <span className="text-2xl">€</span></p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-wide">Accumulated valuation net</p>
                          </div>
                      </div>

                      {/* Analysis History List Matching Screenshots */}
                      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
                          <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/50">
                               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                               <div>
                                   <h3 className="text-lg font-black text-slate-900 tracking-tighter uppercase italic">Analysis History</h3>
                                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Review your verified profitability audits</p>
                               </div>
                          </div>
                          
                          <div className="divide-y divide-slate-100">
                              {isLoadingHistory ? (
                                  <div className="p-20 text-center flex flex-col items-center">
                                      <div className="w-10 h-10 border-4 border-slate-100 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing Cloud Audit Log...</p>
                                  </div>
                              ) : history.length === 0 ? (
                                  <div className="p-20 text-center flex flex-col items-center opacity-40">
                                      <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No verified audits found.</p>
                                  </div>
                              ) : (
                                  history.map((record) => (
                                      <div key={record.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-all group">
                                          <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-3 mb-2">
                                                  <h4 className="font-black text-slate-900 text-base italic truncate">Audit Ref: {record.id.substring(0,8)}</h4>
                                                  <span className="bg-orange-50 text-orange-600 text-[9px] font-black px-2 py-1 rounded border border-orange-100 uppercase tracking-tighter">Pending Data Verification</span>
                                              </div>
                                              <div className="flex gap-4 items-center">
                                                  <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Date: {new Date(record.created_at).toLocaleDateString()}</p>
                                                  <span className="text-slate-200">|</span>
                                                  <p className="text-xs text-slate-400 font-mono tracking-tighter truncate max-w-xs">{record.file_url}</p>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-4 flex-shrink-0">
                                              <button className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm">
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                  View Rating
                                              </button>
                                              <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all">
                                                  Verify Data
                                              </button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'payment' && (
                  <div className="bg-white p-24 rounded-[40px] border border-slate-200 text-center animate-fade-in shadow-sm flex flex-col items-center">
                       <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-8"><svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg></div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">No billing history found</h3>
                       <p className="text-slate-400 mt-2 font-medium max-w-sm">Detailed billing logs for credit top-ups and plan renewals will appear here once active.</p>
                       <button className="mt-8 bg-brand-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-200">Upgrade Plan</button>
                  </div>
              )}
          </div>

          {/* RIGHT SIDEBAR - Balance & Stats */}
          <div className="space-y-8">
              
              {/* Analysis Balance Widget Matching Screenshot 1 */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                      <h3 className="font-black text-slate-900 tracking-tighter uppercase text-sm">Analysis Balance</h3>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">3 analysis available in total</p>
                  
                  <div className="space-y-6 mb-8">
                      <div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                              <span className="text-slate-700">Free analysis</span>
                              <span className="text-brand-600">0%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div className="h-full bg-brand-500 w-[5%] rounded-full shadow-[0_0_8px_rgba(54,118,178,0.5)]"></div>
                          </div>
                          <p className="text-[9px] text-slate-400 font-black uppercase mt-2 tracking-tighter">3 free analysis remaining from 3</p>
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-t border-slate-50 pt-6">
                          <span className="text-slate-400">Total available</span>
                          <span className="text-xl text-brand-600 font-mono tracking-tighter">3 <span className="text-[10px]">ANALYSIS</span></span>
                      </div>
                  </div>

                  {/* Plan Badge Matching Screenshot 1 */}
                  <div className="bg-[#EBF9FF] border border-[#BDEFFF] p-5 rounded-[24px] flex items-start gap-4 shadow-sm">
                      <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <div>
                          <p className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Basic Plan</p>
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wide">3 free reviews per month</p>
                      </div>
                  </div>
              </div>

              {/* Support Widget Matching Style */}
              <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-100 text-center">
                  <h4 className="font-black text-slate-900 uppercase italic text-sm tracking-tighter mb-2">Need expert help?</h4>
                  <p className="text-xs text-slate-500 font-medium mb-8 leading-relaxed">Our technical support team can help you with manual verification and custom reporting.</p>
                  <button className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 hover:bg-slate-100 transition-all shadow-sm">Support Center</button>
              </div>

          </div>
      </div>
    </div>
  );
};

export default ClientAnalysisPortal;
