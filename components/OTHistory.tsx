
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkOrdersFromSupabase, deleteWorkOrder, getAllWorkshopLaborLogs, getAnalysisRequest } from '../services/supabaseClient';
import { analyzeProfitabilityDocument } from '../services/geminiService';
import { RepairJob } from '../types';

const OTHistory: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<RepairJob[]>([]);
  const [laborCostsMap, setLaborCostsMap] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistoryAndLogs = async () => {
      setIsLoading(true);
      
      const [orders, logs] = await Promise.all([
          getWorkOrdersFromSupabase(),
          getAllWorkshopLaborLogs()
      ]);

      const costMap: Record<string, number> = {};
      logs.forEach((log: any) => {
          costMap[log.work_order_id] = (costMap[log.work_order_id] || 0) + (log.calculated_labor_cost || 0);
      });
      setLaborCostsMap(costMap);

      const sorted = orders.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      setHistory(sorted);
      
      setIsLoading(false);
    };

    fetchHistoryAndLogs();
  }, []);

  const handleViewProfitability = async (valuationId: string, orderId: string) => {
    setAnalyzingId(orderId);
    try {
        const request = await getAnalysisRequest(valuationId);
        if (!request || !request.file_url) {
            alert(`No analysis document found for this repair's linked appraisal.\n\nPlease ensure a document has been analyzed in the chat for this claim first.`);
            setAnalyzingId(null);
            return;
        }
        const response = await fetch(request.file_url);
        const blob = await response.blob();
        let mimeType = blob.type || 'application/pdf';
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            const analysisData = await analyzeProfitabilityDocument(base64data, mimeType);
            if (!analysisData) {
                alert("Analysis failed. Could not extract data from document.");
                setAnalyzingId(null);
                return;
            }
            navigate(`/analytics/report/${valuationId}`, { state: { analysisData } });
            setAnalyzingId(null);
        };
    } catch (e) {
        console.error(e);
        alert("Error generating profitability report.");
        setAnalyzingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("Are you sure you want to permanently delete this Work Order?")) {
          const result = await deleteWorkOrder(id);
          if (result.success) {
              setHistory(prev => prev.filter(job => job.id !== id));
          } else {
              alert(`Delete Failed: ${result.error}\n\nCommon fixes:\n1. Check if Supabase RLS policies exist for DELETE.\n2. Ensure foreign key constraints in DB use CASCADE.`);
          }
      }
  };

  const getStatusBadge = (status: string) => {
      const s = status.toLowerCase();
      let color = 'bg-slate-100 text-slate-600';
      if (s === 'finished' || s === 'invoiced' || s === 'closed') color = 'bg-green-100 text-green-700 border-green-200';
      else if (s === 'reception') color = 'bg-blue-100 text-blue-700 border-blue-200';
      else if (['bodywork', 'paint', 'disassembly'].includes(s)) color = 'bg-orange-100 text-orange-700 border-orange-200';
      return (
          <span className={`px-2 py-1 rounded-full text-[10px] font-black border ${color} uppercase tracking-tighter`}>
              {s.replace('_', ' ')}
          </span>
      );
  };

  const filteredHistory = history.filter(item => {
    const search = searchTerm.toLowerCase();
    const vehicle = item.vehicle?.toLowerCase() || '';
    const plate = item.plate?.toLowerCase() || '';
    const idStr = item.expedienteId?.toLowerCase() || item.id.toLowerCase();
    const client = item.insuredName?.toLowerCase() || '';
    return vehicle.includes(search) || plate.includes(search) || idStr.includes(search) || client.includes(search);
  });

  return (
    <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
             </div>
             Repair History & Billing
          </h1>
          <p className="text-slate-500 text-sm font-medium">Real-time cost tracking from workshop production logs.</p>
        </div>
        <div className="relative w-full md:w-80">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
                type="text"
                className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 text-sm shadow-sm transition-all"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-4">Entry Date</th>
                        <th className="px-6 py-4">File / Expedient</th>
                        <th className="px-6 py-4">Vehicle Specs</th>
                        <th className="px-6 py-4">Insured Client</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Aggregated Total</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {isLoading && (
                        <tr><td colSpan={7} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing history...</td></tr>
                    )}
                    {!isLoading && filteredHistory.length === 0 && (
                        <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-bold italic">No records found.</td></tr>
                    )}
                    {!isLoading && filteredHistory.map(item => {
                        const date = item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '-';
                        const loggedLabor = laborCostsMap[item.id] || 0;
                        const finalTotal = (item.totalAmount || 0) + loggedLabor;
                        return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer group" onClick={() => navigate(`/expediente/${item.id}`)}>
                            <td className="px-6 py-5 text-slate-500 font-medium text-xs">{date}</td>
                            <td className="px-6 py-5 font-mono font-black text-slate-900 text-sm">{item.expedienteId || item.id.substring(0,8)}</td>
                            <td className="px-6 py-5">
                                <div className="font-bold text-slate-800 text-sm">{item.vehicle || 'Unknown'}</div>
                                <div className="text-[10px] text-slate-400 font-mono bg-slate-100/50 inline-block px-1.5 py-0.5 rounded border border-slate-200 mt-1 uppercase">{item.plate || 'No Plate'}</div>
                            </td>
                            <td className="px-6 py-5 text-slate-600 font-medium truncate max-w-[150px] text-xs">{item.insuredName || 'N/A'}</td>
                            <td className="px-6 py-5 text-center">{getStatusBadge(item.status)}</td>
                            <td className="px-6 py-5 text-right font-mono font-black text-slate-900">€{finalTotal.toFixed(2)}</td>
                            <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {item.valuationId && (
                                        <button onClick={(e) => { e.stopPropagation(); handleViewProfitability(item.valuationId!, item.id); }} className="bg-indigo-50 border border-indigo-100 p-2 rounded-lg text-indigo-600 hover:bg-indigo-100 shadow-sm transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
                                    )}
                                    <button onClick={(e) => handleDelete(e, item.id)} className="bg-white border border-red-100 p-2 rounded-lg text-red-400 hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default OTHistory;
