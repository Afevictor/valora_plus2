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
    getActiveTimeLog,
    startTask,
    pauseTask,
    resumeTask,
    finishTask,
    getTaskTimeLogsForOrder,
    getExtractionJobs,
    processExtractionResults,
    getPurchaseLinesForWorkOrder,
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
    const [activeTab, setActiveTab] = useState<'resumen' | 'datos' | 'docs' | 'tiempos' | 'chat'>('resumen');

    // Estado de Datos
    const [job, setJob] = useState<RepairJob | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [workshopRate, setWorkshopRate] = useState<number>(0);
    const [laborLogs, setLaborLogs] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [valuation, setValuation] = useState<ValuationRequest | null>(null); // Added this
    const [isLoadingMain, setIsLoadingMain] = useState(true);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [refreshFiles, setRefreshFiles] = useState(0);
    const [extractionJobs, setExtractionJobs] = useState<any[]>([]);
    const [purchaseLines, setPurchaseLines] = useState<any[]>([]);
    const [processingAi, setProcessingAi] = useState(false);
    const [showPreClose, setShowPreClose] = useState(false);

    // Estado del Temporizador
    const [timer, setTimer] = useState<ActiveTimer | null>(null);
    const [displaySeconds, setDisplaySeconds] = useState(0);
    const [selectedPhase, setSelectedPhase] = useState<MandatoryPhase | ''>('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [isFinishing, setIsFinishing] = useState(false);

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
                const [staff, rateData, logs, vData, fData, cDataList, aiJobs, pLines] = await Promise.all([
                    getEmployeesFromSupabase(),
                    getActiveHourCostCalculation(currentYear, user.id),
                    getTaskTimeLogsForOrder(foundJob.id),
                    foundJob.vehicleId ? getVehicle(foundJob.vehicleId) : Promise.resolve(null),
                    getFilesForExpediente(foundJob.id, foundJob.expedienteId),
                    getClientsFromSupabase(),
                    getExtractionJobs(foundJob.id),
                    getPurchaseLinesForWorkOrder(foundJob.id)
                ]);

                setEmployees(staff);
                setWorkshopRate(rateData?.resultado_calculo?.hourlyCost || 0);
                setLaborLogs(logs);
                setVehicle(vData);
                setFiles(fData);
                setExtractionJobs(aiJobs);
                setPurchaseLines(pLines);

                if (foundJob.clientId) {
                    setClient(cDataList.find(c => c.id === foundJob.clientId) || null);
                }

                if (foundJob.valuationId) {
                    const valData = await getValuationById(foundJob.valuationId);
                    setValuation(valData);
                }

                console.log(`[FILES DEBUG] Processed ${fData.length} files for job ${foundJob.id}`);
            }

            // Verify Server-Side Active Timer
            const checkActiveTimer = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                // If no employee selected, maybe check for current user?
                // For now, we rely on selectedEmployeeId
                if (!selectedEmployeeId) {
                    setTimer(null);
                    return;
                }

                const activeLog = await getActiveTimeLog(selectedEmployeeId);

                if (activeLog && activeLog.work_order_tasks?.work_order_id === id) {
                    console.log("Found active server task:", activeLog);
                    setTimer({
                        timeLogId: activeLog.id,
                        taskId: activeLog.task_id,
                        employeeId: activeLog.employee_id,
                        phase: activeLog.work_order_tasks.task_type as MandatoryPhase,
                        startTime: new Date(activeLog.started_at).getTime(),
                        accumulatedSeconds: 0, // Simplification for MVP
                        isPaused: activeLog.status === 'paused'
                    });
                    setSelectedPhase(activeLog.work_order_tasks.task_type as MandatoryPhase);
                } else {
                    setTimer(null);
                }
            };

            await checkActiveTimer();
            setIsLoadingMain(false);
        };
        loadAllData();
    }, [id, refreshFiles, selectedEmployeeId]); // Re-run when employee selection changes

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

    // Lógica del Cronómetro (Visual Ticker)
    useEffect(() => {
        let interval: any;
        if (timer && !timer.isPaused) {
            interval = setInterval(() => {
                const now = Date.now();
                const currentSession = Math.floor((now - timer.startTime) / 1000);
                setDisplaySeconds(timer.accumulatedSeconds + currentSession);
            }, 1000);
        } else if (timer?.isPaused) {
            setDisplaySeconds(timer.accumulatedSeconds);
        } else {
            setDisplaySeconds(0);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // --- Acciones del Temporizador (Server-Side) ---
    const startTimer = async () => {
        if (!selectedPhase || !selectedEmployeeId || !job) return;

        // 1. Obtener User ID (Workshop Owner)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Crear Task (Auto-Assign)
        // En V3, idealmente el Manager crea la task primero. Aquí lo hacemos al vuelo.
        const taskPayload = {
            workshop_id: user.id,
            work_order_id: job.id,
            employee_id: selectedEmployeeId,
            task_type: selectedPhase,
            status: 'in_progress',
            description: `Tarea auto-generada: ${selectedPhase}`
        };

        const { success, task, error } = await createWorkOrderTask(taskPayload);

        if (!success || !task) {
            alert(`Error creando tarea: ${error}`);
            return;
        }

        // 3. Iniciar Timer (RPC)
        const res = await startTask(task.id, selectedEmployeeId);
        if (res.success && res.timeLog) {
            setTimer({
                timeLogId: res.timeLog.id,
                taskId: task.id,
                startTime: Date.now(),
                accumulatedSeconds: 0,
                phase: selectedPhase,
                employeeId: selectedEmployeeId,
                isPaused: false
            });
            setDisplaySeconds(0);
        } else {
            alert(`No se pudo iniciar: ${res.message}`);
        }
    };

    const pauseTimer = async () => {
        if (!timer || timer.isPaused) return;

        const result = await pauseTask(timer.timeLogId);
        if (result.success) {
            const now = Date.now();
            const sessionSeconds = Math.floor((now - timer.startTime) / 1000);

            setTimer({
                ...timer,
                accumulatedSeconds: timer.accumulatedSeconds + sessionSeconds,
                isPaused: true
            });
        } else {
            alert(`Error al pausar: ${result.message}`);
        }
    };

    const resumeTimer = async () => {
        if (!timer || !timer.isPaused) return;

        const result = await resumeTask(timer.taskId, timer.employeeId);
        if (result.success) {
            setTimer({
                ...timer,
                startTime: Date.now(),
                isPaused: false
            });
        } else {
            alert(`Error al reanudar: ${result.message}`);
        }
    };

    const finishTimer = async () => {
        if (!timer || !job) return;
        setIsFinishing(true);

        const result = await finishTask(timer.timeLogId, timer.taskId);

        if (result.success) {
            setTimer(null);
            setSelectedPhase('');
            // Refresh Logs List
            const updatedLogs = await getTaskTimeLogsForOrder(job.id);
            setLaborLogs(updatedLogs);
        } else {
            alert(`Error al finalizar: ${result.message}`);
        }
        setIsFinishing(false);

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
                if (timer) await finishTimer();
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
        if (timer) await finishTimer();

        const res = await transitionWorkOrder(job.id, 'closed');
        if (res.success) {
            setJob({ ...job, status: 'closed' });
            setShowPreClose(false);
            alert("Expediente cerrado correctamente.");
        } else {
            alert(res.error);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

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

    const valuationReports = files.filter(f => f.category === 'Valuation Report');

    const systemDocs = files.filter(f =>
        (f.bucket === 'documents' && f.category !== 'Valuation Report') ||
        (f.bucket === 'reception-files' && f.mime_type === 'application/pdf')
    );

    const otherDocs = files.filter(f =>
        !visualEvidence.find(v => v.id === f.id) &&
        !valuationReports.find(v => v.id === f.id) &&
        !systemDocs.find(v => v.id === f.id)
    );

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            intake: 'Recepción',
            assigned: 'Asignado',
            in_progress: 'En Progreso',
            disassembly: 'Desmontaje',
            bodywork: 'Chapa/Mec',
            paint: 'Pintura',
            admin_close: 'Cierre Adm.',
            closed: 'Cerrado'
        };
        return map[status] || status;
    };

    return (
        <div className="max-w-7xl mx-auto p-6 min-h-screen flex flex-col bg-slate-50 pb-20">

            {/* Cabecera del Expediente */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-brand-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{job.vehicle}</h1>
                        <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg font-mono font-bold text-sm">{job.plate}</span>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">ID Expediente: {job.expedienteId || job.id.substring(0, 8)}</p>

                    {/* Phase Controls */}
                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FASE ACTUAL:</span>
                            <span className="bg-slate-900 text-white px-3 py-1 rounded text-xs font-black uppercase">{getStatusLabel(job.status)}</span>
                        </div>
                        {job.status !== 'closed' && (
                            <button
                                onClick={handleAdvancePhase}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
                            >
                                Avanzar Fase
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                    {[
                        { id: 'resumen', label: 'Resumen' },
                        { id: 'datos', label: 'Datos' },
                        { id: 'docs', label: 'Docs' },
                        { id: 'tiempos', label: 'Tiempos' },
                        { id: 'chat', label: 'Chat' }
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[700px]">

                {activeTab === 'resumen' && (
                    <div className="flex-1 p-8 md:p-12 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                            <div className="lg:col-span-2 space-y-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center text-brand-600 shadow-inner">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Actual</span>
                                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{getStatusLabel(job.status)}</h2>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-sm">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Descripción de la Reparación</h3>
                                    <p className="text-slate-700 leading-relaxed font-medium text-lg italic">
                                        "{job.description || 'No se proporcionó descripción durante la recepción.'}"
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Prioridad</p>
                                        <p className={`font-black text-sm uppercase ${job.priority === 'High' ? 'text-red-600' : 'text-slate-700'}`}>
                                            {job.priority === 'High' ? 'Alta' : job.priority === 'Medium' ? 'Media' : 'Baja'}
                                        </p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Fecha Entrada</p>
                                        <p className="font-black text-sm text-slate-700">{new Date(job.entryDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Kilómetros</p>
                                        <p className="font-black text-sm text-slate-700">{job.currentKm || '-'} KM</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Peritación</p>
                                        <p className="font-black text-sm text-indigo-600">{job.requestAppraisal ? 'SÍ' : 'NO'}</p>
                                    </div>
                                </div>

                                {/* AI EXTRACTION STATUS (NEW) */}
                                {extractionJobs.length > 0 && (
                                    <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Extracción de Datos AI</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${extractionJobs[0].status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                                extractionJobs[0].status === 'failed' ? 'bg-red-100 text-red-600' :
                                                    'bg-indigo-200 text-indigo-600 animate-pulse'
                                                }`}>
                                                {extractionJobs[0].status}
                                            </span>
                                        </div>

                                        {extractionJobs[0].status === 'completed' && (
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium text-slate-600">Se han extraído datos de la peritación. ¿Deseas aplicarlos a la facturación?</p>
                                                <button
                                                    disabled={processingAi}
                                                    onClick={async () => {
                                                        setProcessingAi(true);
                                                        const success = await processExtractionResults(extractionJobs[0].id);
                                                        if (success) {
                                                            alert("Datos aplicados correctamente.");
                                                            // Reload data or increment a refresh counter
                                                            window.location.reload();
                                                        }
                                                        setProcessingAi(false);
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                                                >
                                                    {processingAi ? 'PROCESANDO...' : 'APLICAR DATOS'}
                                                </button>
                                            </div>
                                        )}

                                        {extractionJobs[0].status === 'pending' && (
                                            <p className="text-xs font-bold text-indigo-600">El motor de IA está analizando los documentos. Por favor, espera...</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-1 bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl flex flex-col justify-between relative overflow-hidden ring-4 ring-brand-500/20">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                </div>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                        <h3 className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em]">Rentabilidad Real</h3>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Coste/Hora</p>
                                            <p className="text-white font-mono font-bold text-xs">{workshopRate.toFixed(2)} €</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Financial Summary Card */}
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                            <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-white/10">
                                                <div>
                                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ingresos</p>
                                                    <p className="text-2xl font-black text-white">€{job.totalAmount?.toFixed(2) || '0.00'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Gastos</p>
                                                    <p className="text-2xl font-black text-rose-400">
                                                        €{(
                                                            laborLogs.reduce((acc, l) => {
                                                                const s = l.duration_seconds || (l.ended_at ? Math.floor((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 1000) : 0);
                                                                return acc + (s / 3600 * workshopRate);
                                                            }, 0) +
                                                            purchaseLines.reduce((acc, l) => acc + (l.total_amount || 0), 0)
                                                        ).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                <div className="flex justify-between items-center text-xs">
                                                    <p className="text-slate-400 font-bold uppercase">Mano de Obra (Real)</p>
                                                    <p className="text-slate-300 font-mono">
                                                        €{laborLogs.reduce((acc, l) => {
                                                            const s = l.duration_seconds || (l.ended_at ? Math.floor((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 1000) : 0);
                                                            return acc + (s / 3600 * workshopRate);
                                                        }, 0).toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <p className="text-slate-400 font-bold uppercase">Materiales / Recambios</p>
                                                    <p className="text-slate-300 font-mono">
                                                        €{purchaseLines.reduce((acc, l) => acc + (l.total_amount || 0), 0).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-2">
                                                <p className="text-brand-400 text-[10px] font-black uppercase tracking-widest mb-2">Resultado Final (Beneficio)</p>
                                                {(() => {
                                                    const laborCost = laborLogs.reduce((acc, l) => {
                                                        const s = l.duration_seconds || (l.ended_at ? Math.floor((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 1000) : 0);
                                                        return acc + (s / 3600 * workshopRate);
                                                    }, 0);
                                                    const partsCost = purchaseLines.reduce((acc, l) => acc + (l.total_amount || 0), 0);
                                                    const revenue = job.totalAmount || 0;
                                                    const profit = revenue - laborCost - partsCost;
                                                    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                                                    return (
                                                        <div className="flex items-end justify-between">
                                                            <p className={`text-5xl font-black tabular-nums tracking-tighter ${profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                                €{profit.toFixed(2)}
                                                            </p>
                                                            <div className={`px-3 py-1 rounded-full font-black text-xs ${profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                                {margin.toFixed(1)}% MARGEN
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/10 flex justify-between">
                                        <div>
                                            <p className="text-slate-500 text-[10px] font-black uppercase">Horas Reales</p>
                                            <p className="text-lg font-black text-white">
                                                {(laborLogs.reduce((acc, l) => {
                                                    const seconds = l.duration_seconds ||
                                                        (l.ended_at ? Math.floor((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 1000) : 0);
                                                    return acc + seconds;
                                                }, 0) / 3600).toFixed(2)}h
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-500 text-[10px] font-black uppercase">Eficiencia</p>
                                            <p className="text-lg font-black text-white">Altísima</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'datos' && (
                    <div className="flex-1 p-8 md:p-12 animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Identificación del Cliente</h3>
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <div className="col-span-2 bg-slate-900 p-8 rounded-[32px] text-white shadow-xl">
                                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2">Nombre Completo / Entidad</p>
                                    <p className="text-3xl font-black tracking-tight">{client?.name || job.insuredName}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest border-t border-white/10 pt-2 inline-block">
                                        Identificación: {client?.taxId || 'N/D'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tipo de Cliente</p>
                                    <p className="font-bold text-slate-700">{client?.clientType || 'Standard'}</p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Teléfono</p>
                                    <p className="font-bold text-slate-700">{client?.phone || 'No registrado'}</p>
                                </div>
                                <div className="col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Correo Electrónico</p>
                                    <p className="font-bold text-slate-700">{client?.email || 'No registrado'}</p>
                                </div>
                                {client?.address && (
                                    <div className="col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Dirección Fiscal / Ubicación</p>
                                        <p className="font-bold text-slate-700">{client.address}, {client.city} ({client.province})</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Perfil Técnico del Vehículo</h3>
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <div className="col-span-2 bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Especificaciones (Marca/Modelo)</p>
                                        <p className="text-2xl font-black text-slate-800">
                                            {vehicle ? `${vehicle.brand} ${vehicle.model}` : job.vehicle}
                                        </p>
                                    </div>
                                    <div className="bg-white px-4 py-2 rounded-xl border-2 border-slate-900 font-mono font-black text-xl text-slate-900 shadow-sm">
                                        {vehicle?.plate || job.plate}
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Kilometraje Actual</p>
                                    <p className="text-lg font-black text-slate-700">{vehicle?.currentKm || job.currentKm || '---'} KM</p>
                                </div>

                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nº Bastidor (VIN)</p>
                                    <p className="text-sm font-black text-slate-700 font-mono uppercase truncate">{vehicle?.vin || job.vin || 'NO REGISTRADO'}</p>
                                </div>

                                {vehicle && (
                                    <>
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Combustible</p>
                                            <p className="text-sm font-bold text-slate-700">{vehicle.fuel || '---'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Color</p>
                                            <p className="text-sm font-bold text-slate-700">{vehicle.color || '---'}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 3: INFORMACIÓN DE PERITACIÓN Y SEGURO (NEW) */}
                        {(job.requestAppraisal || valuation) && (
                            <div className="md:col-span-2 space-y-8 mt-4">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Gestión de Peritación y Seguro</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                                        <p className="text-[10px] font-black text-purple-600 uppercase mb-2">Compañía Aseguradora</p>
                                        <p className="text-lg font-black text-slate-800">
                                            {valuation?.insuranceCompany || job.insurance?.company || 'No especificada'}
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                                        <p className="text-[10px] font-black text-purple-600 uppercase mb-2">Tipo de Siniestro</p>
                                        <p className="text-lg font-black text-slate-800">
                                            {valuation?.claimType || 'Por determinar'}
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                                        <p className="text-[10px] font-black text-purple-600 uppercase mb-2">Estado Siniestro</p>
                                        <span className="px-3 py-1 bg-white border-2 border-purple-500 text-purple-600 rounded-lg text-[10px] font-black uppercase">
                                            {valuation?.claimsStage?.replace('_', ' ') || 'Pendiente'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Franquicia</p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {valuation?.franchise?.applies
                                                ? `SÍ (${valuation.franchise.amount} €)`
                                                : job.insurance?.franchise
                                                    ? `SÍ (${job.insurance.franchise} €)`
                                                    : 'SIN FRANQUICIA'}
                                        </p>
                                    </div>
                                    {valuation?.opposingVehicle?.exists && (
                                        <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                                            <p className="text-[10px] font-black text-red-600 uppercase mb-2">Vehículo Contrario</p>
                                            <p className="text-sm font-bold text-slate-700 uppercase">
                                                {valuation.opposingVehicle.plate} - {valuation.opposingVehicle.model}
                                            </p>
                                        </div>
                                    )}
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Referencia de Coste Aplicada</p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {valuation?.costReference || 'General Taller'}
                                        </p>
                                    </div>
                                </div>
                                {valuation?.notes && (
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-inner">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Notas Internas de Peritación</p>
                                        <p className="text-slate-600 font-medium italic leading-relaxed">
                                            {valuation.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECCIÓN 4: DETALLES DE REPARACIÓN (FULL WIDTH BELOW) */}
                        <div className="md:col-span-2 space-y-8 mt-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Detalles de la Orden y Reparación</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Tipos de Trabajo</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(job.repairType || ['Mecánica']).map((type: string) => (
                                            <span key={type} className="bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-700">
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Prioridad</p>
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${job.priority === 'High' ? 'bg-red-100 text-red-600' :
                                        job.priority === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                        {job.priority || 'Medium'}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Peritación Solicitada</p>
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${job.requestAppraisal || valuation ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                        {job.requestAppraisal || valuation ? 'SÍ' : 'NO'}
                                    </span>
                                </div>
                                <div className="md:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-inner">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Observaciones / Daños Declarados</p>
                                    <p className="text-slate-700 font-medium italic leading-relaxed">
                                        {job.description || 'Sin observaciones detalladas.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'docs' && (
                    <div className="flex-1 p-8 md:p-12 animate-fade-in">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 border-b pb-3">
                            Documentación del Expediente
                        </h2>

                        <div className="space-y-10">
                            {/* Valuation Reports Section */}
                            {valuationReports.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                            Informes de Valoración ({valuationReports.length})
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {valuationReports.map((file) => (
                                            <div key={file.id} className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-black uppercase">Informe</span>
                                                            <p className="font-bold text-slate-800 text-sm truncate group-hover:text-purple-600 transition-colors">
                                                                {file.original_filename || 'Informe de Valoración'}
                                                            </p>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                    disabled={downloadingFileId === file.id}
                                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {downloadingFileId === file.id ? (
                                                        <>
                                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Descargando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            Descargar
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* System Documents Section */}
                            {systemDocs.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                            Documentos del Sistema ({systemDocs.length})
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {systemDocs.map((file) => (
                                            <div key={file.id} className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase whitespace-nowrap">{file.category || 'Documento'}</span>
                                                            <p className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                                                                {file.original_filename || 'Documento'}
                                                            </p>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                    disabled={downloadingFileId === file.id}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {downloadingFileId === file.id ? (
                                                        <>
                                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Descargando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            Descargar
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* OTHER Documents Section */}
                            {otherDocs.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                            Documentos del Expediente ({otherDocs.length})
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {otherDocs.map((file) => (
                                            <div key={file.id} className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase whitespace-nowrap">{file.category || 'Otros'}</span>
                                                            <p className="font-bold text-slate-800 text-sm truncate group-hover:text-slate-600 transition-colors">
                                                                {file.original_filename || 'Archivo'}
                                                            </p>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                    disabled={downloadingFileId === file.id}
                                                    className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {downloadingFileId === file.id ? (
                                                        <>
                                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Descargando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            Descargar
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Photos Section */}
                            {visualEvidence.filter(f => f.mime_type?.startsWith('image/')).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                            Fotografías ({visualEvidence.filter(f => f.mime_type?.startsWith('image/')).length})
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {visualEvidence.filter(f => f.mime_type?.startsWith('image/')).map((file) => (
                                            <div key={file.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden group">
                                                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                                    <img
                                                        src={file.publicUrl}
                                                        alt={file.original_filename}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                                            <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[8px] font-black uppercase mb-1 inline-block">{file.category || 'Imagen'}</span>
                                                            <p className="text-white text-[10px] font-bold truncate">
                                                                {file.original_filename}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <button
                                                        onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                        disabled={downloadingFileId === file.id}
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {downloadingFileId === file.id ? (
                                                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Videos Section */}
                            {visualEvidence.filter(f => f.mime_type?.startsWith('video/')).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                            Videos ({visualEvidence.filter(f => f.mime_type?.startsWith('video/')).length})
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {visualEvidence.filter(f => f.mime_type?.startsWith('video/')).map((file) => (
                                            <div key={file.id} className="bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl border border-red-200 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black uppercase mb-0.5 inline-block">{file.category || 'Video'}</span>
                                                                <p className="font-bold text-slate-800 text-sm truncate group-hover:text-red-600 transition-colors">
                                                                    {file.original_filename || 'Video'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(file.publicUrl, file.original_filename, file.id)}
                                                    disabled={downloadingFileId === file.id}
                                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {downloadingFileId === file.id ? (
                                                        <>
                                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Descargando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            Descargar
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {files.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 px-6">
                                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                        <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-400 uppercase tracking-wider mb-2">
                                        Sin Documentación
                                    </h3>
                                    <p className="text-slate-400 text-sm text-center max-w-md">
                                        No se han subido documentos, fotos o videos para este expediente durante la recepción.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* El resto de las pestañas (Tiempos, Chat) seguirían similar... */}
                {activeTab === 'tiempos' && (
                    <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 animate-fade-in">
                        <div className="w-full md:w-[420px] p-8 space-y-8 bg-slate-50/50">
                            <div>
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Nueva Sesión de Trabajo</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Operario Asignado</label>
                                        <select
                                            disabled={!!timer}
                                            className="w-full p-4 border border-slate-200 rounded-2xl bg-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none font-bold text-slate-700 disabled:opacity-60 transition-all"
                                            value={selectedEmployeeId}
                                            onChange={e => setSelectedEmployeeId(e.target.value)}
                                        >
                                            <option value="">Seleccionar Personal...</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Fase de Reparación</label>
                                        <select
                                            disabled={!!timer}
                                            className="w-full p-4 border border-slate-200 rounded-2xl bg-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none font-bold text-slate-700 disabled:opacity-60 transition-all"
                                            value={selectedPhase}
                                            onChange={e => setSelectedPhase(e.target.value as MandatoryPhase)}
                                        >
                                            <option value="">Seleccionar Fase...</option>
                                            {REPAIR_PHASES.map(p => (
                                                <option key={p.value} value={p.value}>{p.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden ring-4 ring-slate-100 group">
                                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.4em] mb-3">Tiempo en Sesión</p>
                                    <h3 className="text-6xl font-mono font-black text-white tabular-nums tracking-tighter mb-2">
                                        {formatTime(displaySeconds)}
                                    </h3>
                                    <p className="text-emerald-400 font-mono font-bold text-xl mb-6">
                                        Coste Actual: {((displaySeconds / 3600) * workshopRate).toFixed(2)} €
                                    </p>
                                    <div className="flex gap-4">
                                        {!timer ? (
                                            <button
                                                disabled={!selectedEmployeeId}
                                                onClick={startTimer}
                                                className="flex-1 bg-brand-500 hover:bg-brand-400 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-20 disabled:grayscale"
                                            >
                                                INICIAR SESIÓN
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={timer.isPaused ? resumeTimer : pauseTimer}
                                                    className={`flex-1 text-white py-5 rounded-2xl font-black shadow-lg transition-all ${timer.isPaused ? 'bg-orange-500 hover:bg-orange-400' : 'bg-slate-700 hover:bg-slate-600'
                                                        }`}
                                                >
                                                    {timer.isPaused ? 'REANUDAR' : 'PAUSAR'}
                                                </button>
                                                <button
                                                    onClick={finishTimer}
                                                    disabled={isFinishing}
                                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-black shadow-lg disabled:opacity-50"
                                                >
                                                    {isFinishing ? 'Guardando...' : 'Finalizar'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto max-h-[800px]">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Historial de Trabajo</h2>
                            <div className="space-y-4">
                                {laborLogs.length === 0 ? (
                                    <p className="text-slate-400 text-sm italic py-4">No hay registros de tiempo.</p>
                                ) : (
                                    laborLogs.map((log) => (
                                        <div key={log.id} className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`w-2 h-2 rounded-full ${!log.ended_at ? 'bg-orange-500 animate-pulse' :
                                                        log.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'
                                                        }`} />
                                                    <p className="font-bold text-slate-800 text-sm">
                                                        {log.employees?.full_name || 'Desconocido'}
                                                    </p>
                                                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                                        {log.work_order_tasks?.task_type || 'N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    Iniciado: {new Date(log.started_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-black text-lg text-slate-700">
                                                    {(() => {
                                                        const seconds = log.duration_seconds ||
                                                            (log.ended_at ? Math.floor((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 1000) : 0);

                                                        if (seconds > 0) {
                                                            const h = Math.floor(seconds / 3600);
                                                            const m = Math.floor((seconds % 3600) / 60);
                                                            return `${h}h ${m}m`;
                                                        }
                                                        return !log.ended_at ? 'En curso' : 'Calculating...';
                                                    })()}
                                                </p>
                                                {(() => {
                                                    const seconds = log.duration_seconds ||
                                                        (log.ended_at ? Math.floor((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 1000) : 0);

                                                    if (seconds > 0 && workshopRate > 0) {
                                                        return (
                                                            <p className="text-[10px] font-bold text-emerald-600">
                                                                {((seconds / 3600) * workshopRate).toFixed(2)} €
                                                            </p>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && job && (
                    <div className="flex-1 overflow-hidden animate-fade-in min-h-[600px]">
                        <DualChat workOrder={job} />
                    </div>
                )}
            </div>
            {showPreClose && (
                <PreCloseModal
                    workOrderId={job.id}
                    onClose={() => setShowPreClose(false)}
                    onConfirm={handleConfirmClose}
                />
            )}
        </div >
    );
};

export default ExpedienteDetail;
