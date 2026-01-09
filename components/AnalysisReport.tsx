import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const AnalysisReport: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const data = location.state?.analysisData;
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!data) {
        // If someone navigates here directly without data, go back to history
        navigate('/history-claims');
    }
  }, [data, navigate]);

  if (!data) return null;

  // Destructure Data
  const v = data.vehicle || {};
  const f = data.financials || {};
  const m = data.metadata || {};
  const ai = data.ai_analysis || {};

  // Calculate margins for display
  const parts = f.parts_total || 0;
  const laborHrs = f.labor_hours || 0;
  const totalNet = f.total_net || 0;
  
  // Simple estimation logic
  const estCost = (parts * 0.7) + (laborHrs * 35);
  const estProfit = totalNet - estCost;
  const profitMargin = totalNet > 0 ? ((estProfit / totalNet) * 100).toFixed(1) : '0.0';

  // Chart Data
  const chartData = [
    { name: 'Parts', value: f.parts_total || 0, color: '#3b82f6' },
    { name: 'Labor', value: f.labor_total || 0, color: '#10b981' },
    { name: 'Paint', value: f.paint_material_total || 0, color: '#a855f7' },
    { name: 'Margin', value: estProfit > 0 ? estProfit : 0, color: '#cbd5e1' },
  ];

  const handleExport = () => {
      setIsExporting(true);
      const element = document.getElementById('report-content');
      
      const opt = {
          margin:       [10, 10],
          filename:     `ValoraPlus_Profitability_${m.doc_number || id}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-ignore
      if (window.html2pdf) {
          // @ts-ignore
          window.html2pdf().set(opt).from(element).save().then(() => setIsExporting(false));
      } else {
          window.print();
          setIsExporting(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in print:p-0 print:max-w-none">
        
        {/* Navigation Header - Hidden in Print */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => navigate('/history-claims')} 
                    className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition-colors font-medium"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to History
                </button>
                <h1 className="text-xl font-bold text-slate-800">Profitability Report</h1>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isExporting ? (
                        <>
                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Generating PDF...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download PDF
                        </>
                    )}
                </button>
            </div>
        </div>

        <div id="report-content" className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200 print:shadow-none print:border-none">
            
            {/* Report Header */}
            <header className="bg-slate-900 text-white p-8 print:bg-white print:text-black print:border-b-2 print:border-black">
                <div className="flex flex-col md:flex-row justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">{v.make_model || 'Unknown Vehicle'}</h1>
                        <div className="flex flex-wrap gap-3 mt-3">
                            <span className="bg-slate-700 px-3 py-1 rounded text-sm font-mono text-slate-200 print:bg-slate-200 print:text-black print:border print:border-black">{v.plate || 'NO PLATE'}</span>
                            <span className="bg-slate-700 px-3 py-1 rounded text-sm text-slate-300 print:bg-white print:text-black print:border print:border-black">{v.vin || 'VIN Not Found'}</span>
                            <span className="bg-blue-600 px-3 py-1 rounded text-sm font-bold shadow-sm print:hidden">Doc #{m.doc_number || 'N/A'}</span>
                            <span className="hidden print:inline-block text-sm font-bold">Ref: {m.doc_number || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="text-left md:text-right mt-6 md:mt-0">
                        <p className="text-sm text-slate-400 uppercase tracking-wide print:text-black">Total Amount (Net)</p>
                        <p className="text-4xl font-bold text-green-400 print:text-black">€{(f.total_net || 0).toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-1 print:text-black">Gross: €{(f.total_gross || 0).toLocaleString()}</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-8">
                
                {/* AI Insight Box */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg mb-8 print:border print:border-slate-300">
                    <h3 className="text-blue-900 font-bold mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        AI Analysis Summary
                    </h3>
                    <p className="text-blue-800 mb-3 text-sm leading-relaxed">{ai.summary || 'No summary generated.'}</p>
                    <div className="flex gap-4 items-center">
                        <span className="text-xs font-bold uppercase text-blue-600 tracking-wide">Profitability Rating:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${ai.profitability_rating === 'High' ? 'bg-green-200 text-green-800' : ai.profitability_rating === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'} print:border print:border-black`}>
                            {ai.profitability_rating || 'N/A'}
                        </span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm print:border-slate-400">
                        <p className="text-xs text-slate-500 uppercase font-bold">Parts Cost</p>
                        <p className="text-2xl font-bold text-slate-800">€{(f.parts_total || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm print:border-slate-400">
                        <p className="text-xs text-slate-500 uppercase font-bold">Labor Cost</p>
                        <p className="text-2xl font-bold text-slate-800">€{(f.labor_total || 0).toLocaleString()}</p>
                        <p className="text-xs text-slate-400 mt-1">{f.labor_hours || 0} hrs @ €{f.labor_rate || 0}/h</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm print:border-slate-400">
                        <p className="text-xs text-slate-500 uppercase font-bold">Paint Materials</p>
                        <p className="text-2xl font-bold text-slate-800">€{(f.paint_material_total || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-inner print:bg-white print:border-slate-400">
                        <p className="text-xs text-slate-500 uppercase font-bold">Est. Margin</p>
                        <p className={`text-2xl font-bold ${parseFloat(profitMargin) > 15 ? 'text-green-600' : 'text-orange-500'} print:text-black`}>{profitMargin}%</p>
                        <p className="text-xs text-slate-400 mt-1">~ €{estProfit.toFixed(0)} profit</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Breakdown Chart */}
                    <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm h-80 flex flex-col print:border-slate-400">
                        <h3 className="text-sm font-bold text-slate-600 mb-4 text-center">Cost Distribution</h3>
                        <div className="flex-1 w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: number) => `€${value.toLocaleString()}`}
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-sm font-bold text-slate-400 mb-8">€</span>
                            </div>
                        </div>
                    </div>

                    {/* Risk Factors & Details */}
                    <div className="col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm print:border-slate-400">
                            <h3 className="text-lg font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Analysis Details</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-slate-50 last:border-0">
                                        <td className="py-3 text-slate-500">Document Date</td>
                                        <td className="py-3 font-medium text-right text-slate-800">{m.date || 'N/A'}</td>
                                    </tr>
                                    <tr className="border-b border-slate-50 last:border-0">
                                        <td className="py-3 text-slate-500">AI Confidence Score</td>
                                        <td className="py-3 font-medium text-right text-green-600">{m.confidence_score || 95}%</td>
                                    </tr>
                                    <tr className="border-b border-slate-50 last:border-0">
                                        <td className="py-3 text-slate-500">Labor Hours Identified</td>
                                        <td className="py-3 font-medium text-right text-slate-800">{f.labor_hours || 0} h</td>
                                    </tr>
                                    <tr className="border-b border-slate-50 last:border-0">
                                        <td className="py-3 text-slate-500">Hourly Rate Identified</td>
                                        <td className="py-3 font-medium text-right text-slate-800">€{f.labor_rate || 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {ai.risk_factors && ai.risk_factors.length > 0 && (
                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm print:border-slate-400">
                                <h3 className="text-lg font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Risk Factors Identified</h3>
                                <ul className="space-y-2">
                                    {ai.risk_factors.map((risk: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-700 bg-orange-50 p-2 rounded print:bg-white print:border print:border-slate-200">
                                            <i className="fas fa-exclamation-triangle text-orange-500 mt-0.5"></i>
                                            <svg className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            {risk}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

            </main>
            <footer className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-200 print:bg-white">
                Generated by Valora Plus AI Engine • {new Date().toLocaleDateString()}
            </footer>
        </div>
    </div>
  );
};

export default AnalysisReport;