
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ValuationRequest, ClaimsStage, HourCostCalculation } from '../types';
import { getValuationsFromSupabase, deleteValuation, getCostCalculations } from '../services/supabaseClient';

const STAGE_LABELS: Record<ClaimsStage, string> = {
    draft: 'Borrador / Pendiente',
    sent_expert: 'Asignado a Perito',
    in_review: 'En Revisión (Chat)',
    report_issued: 'Informe Finalizado',
    negotiation: 'En Negociación',
    analytics: 'Cerrado / Historial',
    pending_admin: 'Pendiente de Aprobación'
};

const STAGE_COLORS: Record<ClaimsStage, string> = {
    draft: 'bg-slate-100 text-slate-500 border-slate-200',
    sent_expert: 'bg-blue-50 text-blue-600 border-blue-200',
    in_review: 'bg-purple-50 text-purple-600 border-purple-200',
    report_issued: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    negotiation: 'bg-orange-50 text-orange-600 border-orange-200',
    analytics: 'bg-slate-800 text-slate-100 border-slate-700',
    pending_admin: 'bg-amber-50 text-amber-600 border-amber-200'
};

const ClaimsHistory: React.FC = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState<ValuationRequest[]>([]);
    const [costOptions, setCostOptions] = useState<HourCostCalculation[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedValuation, setSelectedValuation] = useState<ValuationRequest | null>(null);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const [allValuations, costs] = await Promise.all([
                getValuationsFromSupabase(),
                getCostCalculations()
            ]);
            setCostOptions(costs);
            // Filter out those still in 'pending_admin' if this is a "History" view 
            // but the user said "Master List" before. 
            // However, "History" usually implies closed or progressed.
            // Let's keep all but sort by date descending.
            const sorted = (allValuations || []).sort((a, b) =>
                new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime()
            );
            setHistory(sorted);
        } catch (e) {
            console.error("Error loading history:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Seguro que desea eliminar este registro permanentemente?")) {
            const success = await deleteValuation(id);
            if (success) {
                setHistory(prev => prev.filter(v => v.id !== id));
            }
        }
    };

    const filteredHistory = history.filter(v => {
        const search = searchTerm.toLowerCase();
        return (
            v.ticketNumber?.toLowerCase().includes(search) ||
            v.vehicle?.plate?.toLowerCase().includes(search) ||
            v.insuredName?.toLowerCase().includes(search) ||
            v.insuranceCompany?.toLowerCase().includes(search) ||
            v.workshop?.name?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="max-w-[1600px] mx-auto p-6 md:p-10 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-8 bg-brand-500 rounded-full"></div>
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Historial de Siniestros</h1>
                    </div>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] ml-5">Archivo Maestro de Peritaciones y Resoluciones</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <input
                            type="text"
                            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Buscar matrícula, asegurado or taller..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg className="w-5 h-5 text-slate-400 absolute left-4 top-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <button
                        onClick={fetchHistory}
                        className="p-4 bg-white border border-slate-200 rounded-[20px] text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {/* Main Content Table (Premium Design) */}
            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando Archivo...</span>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Expediente</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehículo</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Taller / Cliente</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Compañía</th>
                                <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Actual</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center opacity-30">
                                            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            <p className="text-lg font-bold text-slate-400">No se encontraron registros</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map(item => (
                                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900 group-hover:text-brand-600 transition-colors uppercase">{item.ticketNumber || 'SIN-ID'}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.requestDate}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold text-xs uppercase shadow-sm">
                                                    {item.vehicle?.brand?.substring(0, 1) || 'V'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800">{item.vehicle?.brand} {item.vehicle?.model}</span>
                                                    <span className="text-[10px] font-bold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-md inline-block w-fit mt-1 uppercase tracking-widest border border-brand-100">{item.vehicle?.plate}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{item.workshop?.name || 'Taller Desconocido'}</span>
                                                <span className="text-[10px] font-medium text-slate-500">{item.insuredName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-black text-slate-500 uppercase bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                                {item.insuranceCompany || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`inline-block px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${STAGE_COLORS[item.claimsStage] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                {STAGE_LABELS[item.claimsStage] || item.claimsStage}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setSelectedValuation(item)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-black transition-all shadow-lg hover:scale-110"
                                                    title="Ver Detalle Completo"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm hover:scale-110"
                                                    title="Eliminar Registro"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Premium Detail Modal */}
            {selectedValuation && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col animate-scale-in">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <span className="bg-brand-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 inline-block">Archivo Maestro</span>
                                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Expediente {selectedValuation.ticketNumber}</h2>
                            </div>
                            <button onClick={() => setSelectedValuation(null)} className="w-12 h-12 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center transition-all group">
                                <svg className="w-6 h-6 text-slate-400 group-hover:rotate-90 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                {/* Left Column: Info */}
                                <div className="lg:col-span-2 space-y-12">
                                    <div className="grid grid-cols-2 gap-8">
                                        <section>
                                            <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-6 pb-2 border-b-2 border-brand-100 inline-block">Vehículo e Identificación</h4>
                                            <div className="space-y-4">
                                                <InfoItem label="Marca / Modelo" value={`${selectedValuation.vehicle?.brand} ${selectedValuation.vehicle?.model}`} bold />
                                                <InfoItem label="Matrícula" value={selectedValuation.vehicle?.plate} />
                                                <InfoItem label="Nº de Bastidor (VIN)" value={selectedValuation.vehicle?.vin || 'N/A'} />
                                                <InfoItem label="Kilometraje" value={`${selectedValuation.vehicle?.km} KM`} />
                                            </div>
                                        </section>
                                        <section>
                                            <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-6 pb-2 border-b-2 border-brand-100 inline-block">Compañía e Insignia</h4>
                                            <div className="space-y-4">
                                                <InfoItem label="Asegurado" value={selectedValuation.insuredName} bold />
                                                <InfoItem label="Compañía" value={selectedValuation.insuranceCompany} />
                                                <InfoItem label="Tipo de Reparación" value={selectedValuation.claimType} />
                                                <InfoItem label="Fecha de Siniestro" value={selectedValuation.claimDate} />
                                            </div>
                                        </section>
                                    </div>

                                    <section>
                                        <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-8 pb-2 border-b-2 border-brand-100 inline-block">Evidencias Gráficas ({selectedValuation.photos?.length || 0})</h4>
                                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                                            {selectedValuation.photos?.map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-2xl overflow-hidden border-4 border-slate-50 hover:border-brand-500 transition-all shadow-sm">
                                                    <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                                                </a>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                {/* Right Column: Sidebar */}
                                <div className="space-y-8">
                                    <div className="bg-slate-50 rounded-[32px] p-8 space-y-6 border border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Resumen de Gestión</h4>
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Taller de Origen</p>
                                                <p className="text-sm font-black text-slate-900">{selectedValuation.workshop?.name}</p>
                                                <p className="text-[10px] text-slate-500 mt-1">{selectedValuation.workshop?.province}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Perito Asignado</p>
                                                <p className="text-sm font-black text-slate-900">{selectedValuation.assignedExpertId ? 'Sincronizado Bitrix' : 'Sin Asignar'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Franquicia</p>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedValuation.franchise?.applies ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-600'}`}>
                                                    {selectedValuation.franchise?.applies ? `${selectedValuation.franchise.amount} €` : 'Exenta'}
                                                </span>
                                            </div>

                                            <div className="pt-4 border-t border-slate-200/60">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Referencia de Costes</p>
                                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                    <p className="text-[10px] font-black text-slate-900 mb-3 truncate">{selectedValuation.costReference || 'General'}</p>

                                                    {(() => {
                                                        const selected = costOptions.find(c => c.periodo === selectedValuation.costReference);
                                                        const hourlyCost = selected?.resultado_calculo?.hourlyCost || 0;

                                                        return (
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center pb-2 border-b border-amber-200/30">
                                                                    <div>
                                                                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest opacity-70">Interno</p>
                                                                        <p className="text-xs font-black text-slate-900">{hourlyCost > 0 ? `${hourlyCost.toFixed(2)}€/h` : 'N/A'}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest opacity-70">Margen</p>
                                                                        <p className="text-xs font-black text-emerald-600">20%</p>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest opacity-70 mb-0.5">Sugerido (PVP)</p>
                                                                    <p className="text-base font-black text-emerald-600">{hourlyCost > 0 ? `${(hourlyCost * 1.2).toFixed(2)}€/h` : 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-2 space-y-3">
                                        <button onClick={() => setSelectedValuation(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl">Cerrar Expediente</button>
                                        <button onClick={() => window.print()} className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Imprimir Reporte</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                @keyframes scale-in { 
                    from { opacity: 0; transform: scale(0.95); } 
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
            `}} />
        </div>
    );
};

const InfoItem = ({ label, value, bold }: { label: string, value: any, bold?: boolean }) => (
    <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className={`text-[13px] ${bold ? 'font-black text-slate-900 uppercase' : 'font-bold text-slate-600'}`}>{value || 'No Proporcionado'}</span>
    </div>
);

export default ClaimsHistory;
