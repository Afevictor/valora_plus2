import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RepairJob, Employee, Client, Vehicle, HourCostCalculation, OTStatus } from '../types';
import {
    getClientsFromSupabase,
    getWorkOrder,

    getEmployeesFromSupabase,
    getActiveHourCostCalculation,
    saveLaborLog,
    getLaborLogsForOrder,
    getVehicle,
    getFilesForExpediente,
    getValuationById,
    updateWorkOrderStatus,
    createWorkOrderTask,
    updateWorkOrderTask,
    deleteWorkOrderTask,
    getWorkOrderTasks,
    getActiveTimeLog,
    startTask,
    pauseTask,
    resumeTask,
    finishTask,
    getTaskTimeLogsForOrder,
    getExtractionJobs,
    processExtractionResults,
    getPurchaseLinesForWorkOrder,
    getWorkOrderBilling,
    getWorkOrderParts,
    supabase
} from '../services/supabaseClient';
import { ValuationRequest } from '../types';
import DualChat from './DualChat';
import PreCloseModal from './PreCloseModal';
import { transitionWorkOrder } from '../services/supabaseClient';

const REPAIR_PHASES = [
    { value: 'disassembly', label: 'Desmontaje' },
    { value: 'bodywork', label: 'Reparación Chapa' },
    { value: 'paint', label: 'Pintura' }
] as const;

type MandatoryPhase = typeof REPAIR_PHASES[number]['value'];

interface ActiveTimer {
    timeLogId: string;
    taskId: string;
    startTime: number;
    accumulatedSeconds: number;
    phase: MandatoryPhase;
    employeeId: string;
    isPaused: boolean;
}

const ExpedienteDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'resumen' | 'datos' | 'valoracion' | 'docs' | 'tiempos' | 'chat'>('resumen');

    // Estado de Datos
    const [job, setJob] = useState<RepairJob | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [workshopRate, setWorkshopRate] = useState<number>(0);
    const [laborLogs, setLaborLogs] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [valuation, setValuation] = useState<ValuationRequest | null>(null); // Added this
    const [isLoadingMain, setIsLoadingMain] = useState(true);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [refreshFiles, setRefreshFiles] = useState(0);
    const [extractionJobs, setExtractionJobs] = useState<any[]>([]);
    const [purchaseLines, setPurchaseLines] = useState<any[]>([]);
    const [billing, setBilling] = useState<any>(null);
    const [parts, setParts] = useState<any[]>([]);
    const [processingAi, setProcessingAi] = useState(false);
    const [showPreClose, setShowPreClose] = useState(false);
    const [isAssigning, setIsAssigning] = useState<string | null>(null);
    const [lastAction, setLastAction] = useState<{ type: string, status: 'success' | 'error' } | null>(null);
    const [tick, setTick] = useState(0);

    // Inicializar Datos
    useEffect(() => {
        const loadAllData = async () => {
            if (!id) return;
            setIsLoadingMain(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const currentYear = new Date().getFullYear().toString();

            // Obtener Orden de Trabajo
            const foundJob = await getWorkOrder(id);

            if (foundJob) {
                setJob(foundJob);

                // Obtener datos asociados en paralelo
                const [staff, rateData, logs, vData, fData, cDataList, aiJobs, pLines, otTasks, billingData, partsData] = await Promise.all([
                    getEmployeesFromSupabase(),
                    getActiveHourCostCalculation(currentYear, user.id),
                    getTaskTimeLogsForOrder(foundJob.id),
                    foundJob.vehicleId ? getVehicle(foundJob.vehicleId) : Promise.resolve(null),
                    getFilesForExpediente(foundJob.id, foundJob.expedienteId),
                    getClientsFromSupabase(),
                    getExtractionJobs(foundJob.id),
                    getPurchaseLinesForWorkOrder(foundJob.id),
                    getWorkOrderTasks(foundJob.id),
                    getWorkOrderBilling(foundJob.id),
                    getWorkOrderParts(foundJob.id)
                ]);

                setEmployees(staff);
                setWorkshopRate(rateData?.resultado_calculo?.hourlyCost || 0);
                setLaborLogs(logs);
                setVehicle(vData);
                setFiles(fData);
                setExtractionJobs(aiJobs);
                setPurchaseLines(pLines);
                setTasks(otTasks);
                setBilling(billingData);
                setParts(partsData);

                if (foundJob.clientId) {
                    setClient(cDataList.find(c => c.id === foundJob.clientId) || null);
                }

                if (foundJob.valuationId) {
                    const valData = await getValuationById(foundJob.valuationId);
                    setValuation(valData);
                }

                console.log(`[FILES DEBUG] Processed ${fData.length} files for job ${foundJob.id}`);
            }

            setIsLoadingMain(false);
        };
        loadAllData();
    }, [id, refreshFiles]);

    // Sincronización en tiempo real (cada 10 seg) y Ticker visual (cada 1 seg)
    useEffect(() => {
        if (!job || (activeTab !== 'resumen' && activeTab !== 'tiempos')) return;

        const syncInterval = setInterval(async () => {
            const [logs, otTasks] = await Promise.all([
                getTaskTimeLogsForOrder(job.id),
                getWorkOrderTasks(job.id)
            ]);
            setLaborLogs(logs);
            setTasks(otTasks);
        }, 10000);

        const ticker = setInterval(() => {
            setTick(t => t + 1);
        }, 1000);

        return () => {
            clearInterval(syncInterval);
            clearInterval(ticker);
        };
    }, [job?.id, activeTab]);

    // Gestor de Descargas
    const handleDownload = async (url: string, filename: string, fileId: string) => {
        setDownloadingFileId(fileId);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Respuesta de red no válida');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'descarga';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('La descarga falló:', error);
            window.open(url, '_blank');
        } finally {
            setDownloadingFileId(null);
        }
    };

    // --- Operaciones de Asignación ---

    const handleAssignOperator = async (taskType: string, employeeId: string) => {
        if (!job) {
            alert("No se pudo identificar el expediente. Por favor, recarga la página.");
            return;
        }

        setIsAssigning(taskType);
        const wId = job.workshopId || (await supabase.auth.getUser()).data.user?.id;

        try {
            const existingTask = tasks.find(t => t.task_type === taskType);

            if (!employeeId) {
                // If we are unassigning
                if (existingTask) {
                    const res = await deleteWorkOrderTask(existingTask.id);
                    if (res.success) {
                        setTasks(tasks.filter(t => t.id !== existingTask.id));
                        setLastAction({ type: taskType, status: 'success' });
                        setTimeout(() => setLastAction(null), 3000);
                        console.log(`[ASSIGN] Removed assignment for ${taskType}`);
                    } else {
                        throw new Error(res.error || "Error al eliminar la asignación");
                    }
                }
                return;
            }

            if (existingTask) {
                const res = await updateWorkOrderTask(existingTask.id, {
                    employee_id: employeeId,
                    workshop_id: wId // Ensure workshop consistency
                });
                if (res.success) {
                    setTasks(tasks.map(t => t.id === existingTask.id ? res.task : t));
                    setLastAction({ type: taskType, status: 'success' });
                    setTimeout(() => setLastAction(null), 3000);
                } else {
                    throw new Error(res.error || "Error al actualizar la tarea");
                }
            } else {
                const res = await createWorkOrderTask({
                    workshop_id: wId || '',
                    work_order_id: job.id,
                    employee_id: employeeId,
                    task_type: taskType,
                    status: 'assigned'
                });
                if (res.success) {
                    setTasks([...tasks, res.task]);
                    setLastAction({ type: taskType, status: 'success' });
                    setTimeout(() => setLastAction(null), 3000);
                } else {
                    throw new Error(res.error || "Error al crear la tarea");
                }
            }
        } catch (error: any) {
            console.error("[ASSIGN] Error:", error);
            alert(`Error en la operación: ${error.message || "Error desconocido"}`);
        } finally {
            setIsAssigning(null);
        }
    };

    const handleAdvancePhase = async () => {
        if (!job) return;

        // Sequence: intake -> assigned -> in_progress -> disassembly -> bodywork -> paint -> admin_close
        const order: OTStatus[] = ['intake', 'assigned', 'in_progress', 'disassembly', 'bodywork', 'paint', 'admin_close'];
        const currentIdx = order.indexOf(job.status || 'intake');

        if (currentIdx !== -1 && currentIdx < order.length - 1) {
            const next = order[currentIdx + 1];

            if (next === 'admin_close') {
                setShowPreClose(true);
                return;
            }

            if (window.confirm(`¿Avanzar a la siguiente fase (${next})?`)) {
                const res = await transitionWorkOrder(job.id, next);
                if (res.success) {
                    setJob({ ...job, status: next });
                } else {
                    alert(res.error);
                }
            }
        }
    };

    const handleConfirmClose = async () => {
        if (!job) return;

        const res = await transitionWorkOrder(job.id, 'closed');
        if (res.success) {
            setJob({ ...job, status: 'closed' });
            setShowPreClose(false);
            alert("Expediente cerrado correctamente.");
        } else {
            alert(res.error);
        }
    };

    // --- UI Context ---

    if (isLoadingMain) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
            <svg className="animate-spin h-10 w-10 text-brand-600 mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando detalles del expediente...</p>
        </div>
    );

    if (!job) return <div className="p-10 text-center text-slate-500">Expediente no encontrado.</div>;

    // Clasificación de Archivos (Including the new consolidated bucket)
    const visualEvidence = files.filter(f =>
        ['evidence_photos', 'videos'].includes(f.bucket) ||
        (f.bucket === 'reception-files' && (f.mime_type?.startsWith('image/') || f.mime_type?.startsWith('video/')))
    );

    const systemDocs = files.filter(f =>
        (f.bucket === 'documents') ||
        (f.bucket === 'reception-files' && f.mime_type === 'application/pdf')
    );

    const otherDocs = files.filter(f =>
        !visualEvidence.find(v => v.id === f.id) &&
        !systemDocs.find(v => v.id === f.id)
    );

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            intake: 'Recepción',
            assigned: 'Asignado',
            in_progress: 'En Cola/Curso',
            disassembly: 'Desmontaje',
            bodywork: 'Chapa/Mec',
            paint: 'Pintura',
            admin_close: 'Cierre Adm.',
            closed: 'Cerrado'
        };
        return map[status] || status;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-8 min-h-screen bg-slate-50/50">
            {/* Header Section - Simplified */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 border-b border-slate-200 pb-8">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{job.vehicle}</h1>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md font-mono font-bold text-sm tracking-tight border border-slate-200">
                            {job.plate}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="text-slate-400">ID: {job.expedienteId || job.id.substring(0, 8)}</span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className={`flex items-center gap-1.5 ${job.status === 'closed' ? 'text-slate-500' : 'text-brand-600'}`}>
                            <span className={`w-2 h-2 rounded-full ${job.status === 'closed' ? 'bg-slate-400' : 'bg-brand-500 animate-pulse'}`} />
                            {getStatusLabel(job.status)}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                    {job.status !== 'closed' && (
                        <button
                            onClick={handleAdvancePhase}
                            className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-2"
                        >
                            Avanzar a Siguiente Fase
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </button>
                    )}

                    <div className="flex bg-white/50 p-1 rounded-xl border border-slate-200">
                        {[
                            { id: 'resumen', label: 'Resumen' },
                            { id: 'datos', label: 'Datos' },
                            { id: 'valoracion', label: 'Valoración' },
                            { id: 'docs', label: 'Documentos' },
                            { id: 'tiempos', label: 'Operarios' },
                            { id: 'chat', label: 'DualChat' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tight transition-all ${activeTab === t.id
                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">

                {activeTab === 'resumen' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Financial Metrics Row */}
                        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                {
                                    label: 'Ingresos',
                                    value: `€${(billing?.total_amount || job.totalAmount || 0).toFixed(2)}`,
                                    color: 'text-slate-900'
                                },
                                {
                                    label: 'Gastos Reales',
                                    value: `€${(
                                        laborLogs.reduce((acc: number, l: any) => {
                                            const s = l.duration_seconds || Math.floor((new Date(l.ended_at || new Date()).getTime() - new Date(l.started_at).getTime()) / 1000);
                                            return acc + (s / 3600 * workshopRate);
                                        }, 0) +
                                        purchaseLines.reduce((acc: number, l: any) => acc + (l.total_amount || 0), 0)
                                    ).toFixed(2)}`,
                                    color: 'text-rose-600'
                                },
                                {
                                    label: 'Beneficio',
                                    value: `€${((billing?.total_amount || job.totalAmount || 0) - (
                                        laborLogs.reduce((acc: number, l: any) => {
                                            const s = l.duration_seconds || Math.floor((new Date(l.ended_at || new Date()).getTime() - new Date(l.started_at).getTime()) / 1000);
                                            return acc + (s / 3600 * workshopRate);
                                        }, 0) +
                                        purchaseLines.reduce((acc: number, l: any) => acc + (l.total_amount || 0), 0)
                                    )).toFixed(2)}`,
                                    color: 'text-emerald-600'
                                },
                                {
                                    label: 'Horas Trabajadas',
                                    value: `${(laborLogs.reduce((acc: number, l: any) => {
                                        const seconds = l.duration_seconds || Math.floor((new Date(l.ended_at || new Date()).getTime() - new Date(l.started_at).getTime()) / 1000);
                                        return acc + seconds;
                                    }, 0) / 3600).toFixed(1)}h`,
                                    color: 'text-blue-600'
                                }
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Description & AI Section */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Descripción de Reparación</h3>
                                <p className="text-slate-700 leading-relaxed font-medium text-lg">
                                    {job.description || 'Sin descripción detallada.'}
                                </p>
                            </div>

                            {extractionJobs.length > 0 && (
                                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-indigo-900 uppercase">Motor de IA Activo</h4>
                                            <p className="text-sm text-indigo-600 font-medium">Se han extraído datos de la peritación automáticamente.</p>
                                        </div>
                                    </div>
                                    <button
                                        disabled={processingAi}
                                        onClick={async () => {
                                            setProcessingAi(true);
                                            const success = await processExtractionResults(extractionJobs[0].id);
                                            if (success) {
                                                alert("Datos aplicados correctamente.");
                                                window.location.reload();
                                            }
                                            setProcessingAi(false);
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                                    >
                                        {processingAi ? 'PROCESANDO...' : 'APLICAR DATOS'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Quick Specs Column */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-lg shadow-slate-200">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Ficha Técnica</h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Kilómetros</p>
                                        <p className="text-xl font-bold">{job.currentKm || '-'} KM</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Entrada</p>
                                        <p className="text-xl font-bold">{new Date(job.entryDate).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Prioridad</p>
                                        <p className={`text-xl font-bold ${job.priority === 'High' ? 'text-red-400' : 'text-slate-100'}`}>
                                            {job.priority === 'High' ? 'Urgente' : 'Normal'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'datos' && (
                    <div className="space-y-12">
                        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-8 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                                Datos del Cliente
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre / Razón Social</p>
                                    <p className="text-xl font-bold text-slate-900">{client?.name || job.insuredName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Identificación</p>
                                    <p className="text-sm font-bold text-slate-700">{client?.taxId || 'N/D'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Teléfono</p>
                                    <p className="text-sm font-bold text-slate-700">{client?.phone || 'No registrado'}</p>
                                </div>
                                <div className="md:col-span-3 pt-4 border-t border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email</p>
                                    <p className="text-sm font-bold text-slate-700">{client?.email || 'No registrado'}</p>
                                </div>
                                {client?.address && (
                                    <div className="md:col-span-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dirección</p>
                                        <p className="text-sm font-bold text-slate-700">{client.address}, {client.city} ({client.province})</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-8 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                                Detalle del Vehículo
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div className="md:col-span-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Marca y Modelo</p>
                                    <p className="text-xl font-bold text-slate-900">{vehicle ? `${vehicle.brand} ${vehicle.model}` : job.vehicle}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Matrícula</p>
                                        <p className="text-lg font-black font-mono tracking-tight">{vehicle?.plate || job.plate}</p>
                                    </div>
                                    <div className="p-2 bg-white rounded-md border border-slate-200 shadow-sm">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bastidor (VIN)</p>
                                    <p className="text-sm font-mono font-bold text-slate-700 tracking-wider truncate">{vehicle?.vin || job.vin || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Combustible</p>
                                    <p className="text-sm font-bold text-slate-700">{vehicle?.fuel || '-'}</p>
                                </div>
                            </div>
                        </section>

                        {(job.requestAppraisal || valuation) && (
                            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-8 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                                    Información de Seguro
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Aseguradora</p>
                                        <p className="text-lg font-bold text-slate-900">{valuation?.insuranceCompany || job.insurance?.company || 'No especificada'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Siniestro / Gestión</p>
                                        <p className="text-lg font-bold text-slate-900">{valuation?.claimType || 'Por determinar'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Franquicia</p>
                                        <p className="text-lg font-bold text-slate-900">
                                            {valuation?.franchise?.applies ? `€${valuation.franchise.amount}` : job.insurance?.franchise ? `€${job.insurance.franchise}` : 'No aplica'}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                )}
                {activeTab === 'valoracion' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Financial Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Presupuestado</p>
                                <p className="text-3xl font-black text-slate-900">€{billing?.total_amount?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ingresos Mano de Obra</p>
                                <p className="text-3xl font-black text-slate-900">€{billing?.labor_amount?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ingresos Materiales/Recambios</p>
                                <p className="text-3xl font-black text-slate-900">€{((billing?.materials_amount || 0) + parts.reduce((acc, p) => acc + (p.price_billed * p.qty_billed), 0))?.toFixed(2) || '0.00'}</p>
                            </div>
                        </div>

                        {/* Labor Breakdown */}
                        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Desglose de Mano de Obra de Peritación
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                    <span className="font-bold text-slate-600">Total Horas</span>
                                    <span className="font-black text-lg text-slate-900">{billing?.labor_hours_billed || 0}h</span>
                                </div>
                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                                    <span className="font-bold text-indigo-900">Fuente de Datos</span>
                                    <span className="px-3 py-1 bg-white text-indigo-600 rounded-lg text-[10px] font-black uppercase shadow-sm">
                                        {billing?.source === 'ai_extraction' ? 'Extracción IA' : 'Manual'}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* Parts List */}
                        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    Listado de Recambios (Extracción de Peritación)
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Descripción</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Referencia</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Cant.</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Precio</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {parts.length > 0 ? parts.map((part: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <p className="font-bold text-slate-800 text-sm">{part.description}</p>
                                                    {part.confidence && (
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${part.confidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            Confianza IA: {(part.confidence * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="font-mono text-xs text-slate-500 uppercase">{part.part_number || 'N/A'}</span>
                                                </td>
                                                <td className="px-8 py-5 text-center font-bold text-slate-600">{part.qty_billed}</td>
                                                <td className="px-8 py-5 text-right font-bold text-slate-600">€{part.price_billed.toFixed(2)}</td>
                                                <td className="px-8 py-5 text-right font-black text-slate-900">€{(part.qty_billed * part.price_billed).toFixed(2)}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">No hay recambios registrados para esta orden.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}
                {activeTab === 'docs' && (
                    <div className="space-y-12">
                        {/* Photos Section */}
                        {visualEvidence.filter(f => f.mime_type?.startsWith('image/')).length > 0 && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Fotografías</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {visualEvidence.filter(f => f.mime_type?.startsWith('image/')).map((file) => (
                                        <div key={file.id} className="group aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative">
                                            <img src={file.publicUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                    className="bg-white text-slate-900 p-3 rounded-full shadow-lg"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Videos Section */}
                        {visualEvidence.filter(f => f.mime_type?.startsWith('video/')).length > 0 && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Videos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {visualEvidence.filter(f => f.mime_type?.startsWith('video/')).map((file) => (
                                        <div key={file.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm truncate">{file.original_filename}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium uppercase">Video</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                className="p-2 text-slate-400 hover:text-slate-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* System Documents Section */}
                        {systemDocs.length > 0 && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Documentos del Sistema</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {systemDocs.map((file) => (
                                        <div key={file.id} className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between gap-4 shadow-sm">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-800 text-sm truncate">{file.original_filename}</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase">{file.category || 'Sistema'}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                className="p-2 text-slate-400 hover:text-slate-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Other Documents Section */}
                        {otherDocs.length > 0 && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Otros Documentos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {otherDocs.map((file) => (
                                        <div key={file.id} className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between gap-4 shadow-sm">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-800 text-sm truncate">{file.original_filename}</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase">{file.category || 'Archivo'}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                className="p-2 text-slate-400 hover:text-slate-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Empty State */}
                        {files.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Sin documentos</h3>
                                <p className="text-slate-500 max-w-sm">No se han subido archivos para este expediente todavía.</p>
                            </div>
                        )}
                    </div>
                )}


                {activeTab === 'tiempos' && (
                    <div className="space-y-8">
                        <header className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Asignación de Operarios</h3>
                                <p className="text-sm text-slate-600 font-medium">Gestiona qué operario se encarga de cada tarea de reparación.</p>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {['Desmontaje', 'Reparación Chapa', 'Pintura', 'Montaje', 'Mecánica', 'Limpieza'].map(type => {
                                const task = tasks.find(t => t.task_type === type);

                                return (
                                    <div key={type} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-slate-900">{type}</h4>
                                            {task?.status === 'in_progress' && (
                                                <span className="flex h-2 w-2 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                            )}
                                        </div>

                                        <select
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-200 transition-all cursor-pointer"
                                            value={task?.employee_id || ''}
                                            onChange={(e) => handleAssignOperator(type, e.target.value)}
                                            disabled={isAssigning !== null}
                                        >
                                            <option value="">Sin asignar</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                                            ))}
                                        </select>

                                        {task && (
                                            <div className="flex items-center gap-2 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                <span className={`px-1.5 py-0.5 rounded ${task.status === 'finished' ? 'bg-emerald-100 text-emerald-600' :
                                                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100'
                                                    }`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && job && (
                    <div className="flex-1 overflow-hidden animate-fade-in min-h-[600px]">
                        <DualChat workOrder={job} />
                    </div>
                )}
            </div>
            {
                showPreClose && (
                    <PreCloseModal
                        workOrderId={job.id}
                        onClose={() => setShowPreClose(false)}
                        onConfirm={handleConfirmClose}
                    />
                )
            }
        </div >
    );
};

export default ExpedienteDetail;
