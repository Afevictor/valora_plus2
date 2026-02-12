
import React, { useState, useEffect } from 'react';
import { RepairJob, RepairStage, BusinessLine } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import {
    getWorkOrdersFromSupabase,
    updateWorkOrderStatus,
    deleteWorkOrder,
    transitionWorkOrder,
    supabase
} from '../services/supabaseClient';
import PreCloseModal from './PreCloseModal';

const COLUMNS: { id: RepairStage; title: string; color: string }[] = [
    { id: 'reception', title: 'Recepción / Pendiente', color: 'border-gray-300' },
    { id: 'disassembly', title: 'Desmontaje / Diagnóstico', color: 'border-yellow-300' },
    { id: 'bodywork', title: 'Reparación (Chapa/Mec)', color: 'border-orange-400' },
    { id: 'paint', title: 'Pintura / Acabado', color: 'border-blue-400' },
    { id: 'admin_close', title: 'Cierre Adm. / Calidad', color: 'border-purple-400' },
    { id: 'finished', title: 'Listo para Entrega', color: 'border-green-400' },
];

type ViewMode = 'kanban' | 'list';
type LineFilter = 'all' | BusinessLine;

const RepairKanban: React.FC = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState<RepairJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');
    const [lineFilter, setLineFilter] = useState<LineFilter>('all');



    // Estado Module E: Pre-Close Modal
    const [isPreCloseModalOpen, setIsPreCloseModalOpen] = useState(false);
    const [preCloseJob, setPreCloseJob] = useState<RepairJob | null>(null);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        setIsLoading(true);
        const data = await getWorkOrdersFromSupabase();
        setJobs(data);
        setIsLoading(false);
    };

    const handleDragStart = (e: React.DragEvent, jobId: string) => {
        setDraggedJobId(jobId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStage: RepairStage) => {
        e.preventDefault();
        if (!draggedJobId) return;

        const jobToUpdate = jobs.find(j => j.id === draggedJobId);
        if (!jobToUpdate) return;

        // ACTIVADOR MODULE E (Pre-Close Profitability Check)
        // Solo cuando se mueve a 'finished' DESDE 'admin_close'
        if (targetStage === 'finished' && jobToUpdate.status === 'admin_close') {
            setPreCloseJob(jobToUpdate);
            setIsPreCloseModalOpen(true);
            return;
        }

        // Transición Normal
        const res = await transitionWorkOrder(draggedJobId, targetStage);
        if (res.success) {
            setJobs(prev => prev.map(j => j.id === draggedJobId ? { ...j, status: targetStage } : j));
        } else {
            alert(res.error || "Error al actualizar el estado");
        }
        setDraggedJobId(null);
    };



    const handlePreCloseConfirm = async () => {
        if (!preCloseJob) return;

        // Finalizar Cierre Real
        const res = await transitionWorkOrder(preCloseJob.id, 'finished');
        if (!res.success) {
            alert(res.error || "Fallo al cerrar expediente.");
            return;
        }

        setJobs(prev => prev.map(j => j.id === preCloseJob.id ? { ...j, status: 'finished' } : j));
        setIsPreCloseModalOpen(false);
        setPreCloseJob(null);
    };

    const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("¿Está seguro de que desea eliminar esta orden de trabajo?")) {
            setJobs(prev => prev.filter(j => j.id !== jobId));
            await deleteWorkOrder(jobId);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'bg-red-100 text-red-800 border-red-200';
            case 'Medium': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Low': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'High': return 'Alta';
            case 'Medium': return 'Media';
            case 'Low': return 'Baja';
            default: return priority;
        }
    };

    const filteredJobs = jobs.filter(job => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (job.vehicle || '').toLowerCase().includes(search) ||
            (job.plate || '').toLowerCase().replace(/\s/g, '').includes(search.replace(/\s/g, '')) ||
            (job.expedienteId || '').toLowerCase().includes(search) ||
            (job.insuredName || '').toLowerCase().includes(search)
        );
        const matchesLine = lineFilter === 'all' ? true : job.businessLine === lineFilter;
        return matchesSearch && matchesLine;
    });

    const getCount = (stage: RepairStage) => filteredJobs.filter(j => j.status === stage).length;

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 md:p-6 overflow-hidden">

            {/* CABECERA Y CONTROLES */}
            <div className="flex flex-col gap-6 mb-6 flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Planificador de Taller</h1>
                        <p className="text-slate-500 text-sm">Gestione el flujo de trabajo de Mecánica y Chapa.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-brand-500 text-sm"
                                placeholder="Buscar OT, matrícula..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={() => navigate('/reception')} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm whitespace-nowrap">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Nueva OT
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex p-1 gap-1 w-full md:w-auto">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'Mechanics', label: 'Mecánica' },
                            { id: 'Bodywork', label: 'Chapa/Pintura' }
                        ].map(l => (
                            <button
                                key={l.id}
                                onClick={() => setLineFilter(l.id as any)}
                                className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${lineFilter === l.id ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex border-l border-slate-200 pl-4 ml-4 gap-2">
                        <button onClick={() => setViewMode('kanban')} className={`p-2 rounded hover:bg-slate-100 ${viewMode === 'kanban' ? 'text-brand-600 bg-brand-50' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded hover:bg-slate-100 ${viewMode === 'list' ? 'text-brand-600 bg-brand-50' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* ÁREA DE CONTENIDO */}
            <div className="flex-1 overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <svg className="animate-spin h-10 w-10 text-brand-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <p className="text-sm text-slate-500 font-medium">Sincronizando con la base de datos...</p>
                        </div>
                    </div>
                )}

                {viewMode === 'kanban' && (
                    <div className="flex h-full gap-4 overflow-x-auto pb-4">
                        {COLUMNS.map((column) => (
                            <div
                                key={column.id}
                                className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, column.id)}
                            >
                                <div className={`p-3 border-t-4 ${column.color} bg-white rounded-t-xl shadow-sm flex justify-between items-center`}>
                                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{column.title}</h3>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{getCount(column.id)}</span>
                                </div>
                                <div className="flex-1 p-2 overflow-y-auto space-y-3 scrollbar-thin">
                                    {filteredJobs
                                        .filter((job) => job.status === column.id)
                                        .map((job) => (
                                            <Link
                                                to={`/expediente/${job.id}`}
                                                key={job.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, job.id)}
                                                className="block bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative select-none"
                                            >
                                                <button onClick={(e) => handleDeleteJob(e, job.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors z-10 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                <div className="flex justify-between items-start mb-2 pr-6">
                                                    <span className="text-xs font-bold text-slate-400 group-hover:text-brand-500 transition-colors">{job.expedienteId}</span>
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getPriorityColor(job.priority)}`}>{getPriorityLabel(job.priority)}</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm mb-1">{job.vehicle}</h4>
                                                <div className="flex items-center gap-1 mb-2 text-xs text-slate-500">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    <span className="truncate max-w-[150px] font-medium">{job.insuredName || 'Cliente N/D'}</span>
                                                </div>
                                                <div className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono font-medium text-slate-600 border border-slate-200 inline-block">{job.plate}</div>
                                                {job.hasExternalAppraisal && <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-[10px] uppercase font-bold mt-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>Peritación Activa</div>}
                                            </Link>
                                        ))}
                                    {getCount(column.id) === 0 && <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center"><p className="text-xs text-slate-400 opacity-50">Vacío</p></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr><th className="px-6 py-3">ID Expediente</th><th className="px-6 py-3">Línea</th><th className="px-6 py-3">Vehículo / Cliente</th><th className="px-6 py-3">Estado</th><th className="px-6 py-3">Prioridad</th><th className="px-6 py-3 text-right">Acción</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredJobs.map(job => (
                                        <tr key={job.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/expediente/${job.id}`)}>
                                            <td className="px-6 py-4 font-bold text-slate-700">{job.expedienteId}</td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${job.businessLine === 'Mechanics' ? 'bg-blue-100 text-blue-800' : job.businessLine === 'Bodywork' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100'}`}>{job.businessLine === 'Mechanics' ? 'Mecánica' : job.businessLine === 'Bodywork' ? 'Chapa' : 'General'}</span></td>
                                            <td className="px-6 py-4"><div className="flex flex-col"><span className="font-medium text-slate-900">{job.vehicle}</span><span className="text-xs text-slate-500 mb-1">{job.insuredName}</span><span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded w-fit">{job.plate}</span></div></td>
                                            <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{COLUMNS.find(c => c.id === job.status)?.title || job.status}</span></td>
                                            <td className="px-6 py-4"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${getPriorityColor(job.priority)}`}>{getPriorityLabel(job.priority)}</span></td>
                                            <td className="px-6 py-4 text-right"><button onClick={(e) => handleDeleteJob(e, job.id)} className="text-red-400 hover:text-red-600 transition-colors p-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>




            {/* MODULE E: PRE-CLOSE MODAL */}
            {
                isPreCloseModalOpen && preCloseJob && (
                    <PreCloseModal
                        workOrderId={preCloseJob.id}
                        onClose={() => { setIsPreCloseModalOpen(false); setPreCloseJob(null); setDraggedJobId(null); }}
                        onConfirm={handlePreCloseConfirm}
                    />
                )
            }
        </div >
    );
};

export default RepairKanban;
