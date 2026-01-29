
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ValuationRequest } from '../types';
import { getValuationsFromSupabase, deleteValuation } from '../services/supabaseClient';

const STAGE_LABELS: Record<string, string> = {
    draft: 'Borrador',
    sent_expert: 'Enviado a Perito',
    in_review: 'En Revisión',
    report_issued: 'Informe Emitido',
    negotiation: 'Negociación',
    analytics: 'Analítica / Cerrado'
};

const STAGE_COLORS: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    sent_expert: 'bg-blue-100 text-blue-700 border-blue-200',
    in_review: 'bg-purple-100 text-purple-700 border-purple-200',
    report_issued: 'bg-green-100 text-green-700 border-green-200',
    negotiation: 'bg-orange-100 text-orange-700 border-orange-200',
    analytics: 'bg-gray-100 text-gray-800 border-gray-300'
};

const ClaimsHistory: React.FC = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState<ValuationRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistory = async () => {
        setIsLoading(true);
        const allValuations = await getValuationsFromSupabase();
        setHistory(allValuations);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleRefresh = () => {
        fetchHistory();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("ADVERTENCIA: Esto eliminará permanentemente esta solicitud de peritación de la base de datos y del Planificador de Siniestros. Esta acción no se puede deshacer. ¿Continuar?")) {
            console.log("User confirmed deletion for:", id);
            const success = await deleteValuation(id);
            if (success) {
                setHistory(prev => prev.filter(v => v.id !== id));
                alert("✅ Registro eliminado correctamente.");
            } else {
                alert("❌ No se pudo eliminar el registro. Verifique la consola del navegador para más detalles.");
            }
        }
    };

    const filteredHistory = history.filter(v => {
        const search = searchTerm.toLowerCase();
        const displayId = v.ticketNumber || v.id;
        return (
            displayId.toLowerCase().includes(search) ||
            v.vehicle.plate.toLowerCase().includes(search) ||
            v.insuredName.toLowerCase().includes(search) ||
            v.insuranceCompany.toLowerCase().includes(search)
        );
    });

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>
                            Listado Maestro de Siniestros
                        </h1>
                        <p className="text-slate-500 text-sm">Lista completa de todas las peritaciones y su estado actual.</p>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 p-2 rounded-full transition-all shadow-sm"
                        title="Actualizar Lista"
                    >
                        <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>

                <div className="relative w-full md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-brand-500 focus:border-brand-500 text-sm"
                        placeholder="Buscar expediente, matrícula..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-100 sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Fecha Solicitud</th>
                                <th className="px-6 py-3">ID Expediente</th>
                                <th className="px-6 py-3">Vehículo / Matrícula</th>
                                <th className="px-6 py-3">Asegurado</th>
                                <th className="px-6 py-3">Compañía</th>
                                <th className="px-6 py-3 text-center">Fase</th>
                                <th className="px-6 py-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Cargando historial...
                                        </span>
                                    </td>
                                </tr>
                            )}

                            {!isLoading && filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        No se encontraron siniestros.
                                    </td>
                                </tr>
                            )}

                            {!isLoading && filteredHistory.map(item => {
                                const stage = item.claimsStage || 'draft';
                                const stageLabel = STAGE_LABELS[stage] || stage;
                                const stageColor = STAGE_COLORS[stage] || 'bg-slate-100 text-slate-600 border-slate-200';

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-600">{item.requestDate}</td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-700">
                                            {item.ticketNumber || item.id.substring(0, 8)}
                                            <span className="block text-[10px] text-slate-400 font-normal">Ref OT: {item.workOrderId}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{item.vehicle.brand} {item.vehicle.model}</div>
                                            <div className="text-xs text-slate-500">{item.vehicle.plate}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{item.insuredName}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200">
                                                {item.insuranceCompany}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${stageColor}`}>
                                                {stageLabel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-red-400 hover:text-red-600 transition-colors p-2 rounded hover:bg-red-50"
                                                    title="Eliminar Registro Permanentemente"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ClaimsHistory;
