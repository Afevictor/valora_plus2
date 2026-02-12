import React, { useState, useEffect } from 'react';
import {
    supabase,
    getEmployeesFromSupabase,
    getWorkOrdersFromSupabase,
    getTasksByEmployee,
    startTask,
    pauseTask,
    resumeTask,
    finishTask,
    getActiveTimeLog,
    createWorkOrderTask
} from '../services/supabaseClient';
import { Employee, RepairJob } from '../types';

const OperatorTimeTracking: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [employeeInfo, setEmployeeInfo] = useState<Employee | null>(null);
    const [pendingTasks, setPendingTasks] = useState<any[]>([]);
    const [activeLog, setActiveLog] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [view, setView] = useState<'main' | 'tasks'>('main');
    const [allActiveLogs, setAllActiveLogs] = useState<any[]>([]);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedEmployee) {
            const emp = employees.find(e => e.id === selectedEmployee);
            setEmployeeInfo(emp || null);
            fetchActiveLog();
            fetchPendingTasks();
        } else {
            setEmployeeInfo(null);
            setActiveLog(null);
            setPendingTasks([]);
        }
    }, [selectedEmployee, employees]);

    useEffect(() => {
        let interval: any;
        if (activeLog && activeLog.status === 'in_progress') {
            const start = new Date(activeLog.started_at).getTime();
            interval = setInterval(() => {
                const now = new Date().getTime();
                setElapsedTime(Math.floor((now - start) / 1000));
            }, 1000);
        } else if (activeLog && activeLog.status === 'paused') {
            setElapsedTime(activeLog.duration_seconds || 0);
        } else {
            setElapsedTime(0);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [activeLog]);

    useEffect(() => {
        if (!selectedEmployee) return;
        const syncInterval = setInterval(() => {
            fetchActiveLog();
            fetchPendingTasks();
        }, 10000);
        return () => clearInterval(syncInterval);
    }, [selectedEmployee]);

    // Sincronización global (quién está trabajando en el taller)
    useEffect(() => {
        if (selectedEmployee) return;
        fetchWorkshopStatus();
        const interval = setInterval(fetchWorkshopStatus, 20000);
        return () => clearInterval(interval);
    }, [selectedEmployee]);

    const fetchWorkshopStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('task_time_logs')
                .select('*, work_order_tasks!task_id(task_type, work_orders(plate, vehicle))')
                .eq('status', 'in_progress');
            if (error) throw error;
            setAllActiveLogs(data || []);
        } catch (e) {
            console.error("Error fetching board status:", e);
        }
    };

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const empData = await getEmployeesFromSupabase();
            setEmployees(empData.filter(e => e.es_productivo));

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const currentEmp = empData.find(e => e.id === user.id);
                if (currentEmp) setSelectedEmployee(currentEmp.id);
            }
        } catch (e) {
            console.error("Error loading initial data:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveLog = async () => {
        if (!selectedEmployee) return;
        const log = await getActiveTimeLog(selectedEmployee);
        setActiveLog(log);
    };

    const fetchPendingTasks = async () => {
        if (!selectedEmployee) return;
        const tasks = await getTasksByEmployee(selectedEmployee);
        setPendingTasks(tasks.filter(t => t.status !== 'in_progress'));
    };

    const handleStartTask = async (taskId: string) => {
        if (!selectedEmployee) return;
        const result = await startTask(taskId, selectedEmployee);
        if (result.success) {
            await fetchActiveLog();
            await fetchPendingTasks();
            setView('main');
        } else {
            alert(result.message);
        }
    };

    const handlePauseTask = async (timeLogId: string) => {
        const result = await pauseTask(timeLogId);
        if (result.success) {
            await fetchActiveLog();
        }
    };

    const handleResumeTask = async (taskId: string) => {
        if (!selectedEmployee) return;
        const result = await resumeTask(taskId, selectedEmployee);
        if (result.success) {
            await fetchActiveLog();
            await fetchPendingTasks();
        }
    };

    const handleFinishTask = async (timeLogId: string, taskId: string) => {
        const result = await finishTask(timeLogId, taskId);
        if (result.success) {
            await fetchActiveLog();
            await fetchPendingTasks();
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold">Cargando...</div>;

    if (!selectedEmployee) {
        return (
            <div className="max-w-xl mx-auto p-4 sm:p-8 animate-in fade-in duration-500">
                <div className="bg-slate-900 rounded-[48px] p-8 sm:p-12 shadow-2xl border border-white/5 relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">Panel de Taller en Vivo</p>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">¿Quién está ahí?</h2>
                        <p className="text-slate-400 font-medium text-sm">Selecciona tu perfil para gestionar tus tareas y tiempos.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {employees.map(emp => {
                        const activeTask = allActiveLogs.find(log => log.employee_id === emp.id);
                        return (
                            <button
                                key={emp.id}
                                onClick={() => setSelectedEmployee(emp.id)}
                                className={`group p-6 rounded-[32px] text-left transition-all border-2 flex flex-col justify-between h-44 shadow-lg ${activeTask
                                    ? 'bg-emerald-50 border-emerald-100'
                                    : 'bg-white border-slate-50 hover:border-brand-200'
                                    }`}
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                                            {emp.fullName.charAt(0)}
                                        </div>
                                        {activeTask && (
                                            <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-lg animate-pulse">
                                                OCUPADO
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="mt-4 font-black text-slate-900 text-lg leading-tight group-hover:text-brand-600 transition-colors">{emp.fullName}</h3>
                                </div>

                                {activeTask ? (
                                    <div className="mt-2">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase truncate">
                                            ⚙️ {activeTask.work_order_tasks?.task_type}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 truncate tracking-tight">
                                            {activeTask.work_order_tasks?.work_orders?.plate} • {activeTask.work_order_tasks?.work_orders?.vehicle}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-brand-400 transition-colors">Sin tarea activa</p>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-12 text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        {allActiveLogs.length} OPERARIOS TRABAJANDO AHORA
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto min-h-[90vh] bg-slate-50 flex flex-col animate-in fade-in duration-500">
            {/* Operator Header */}
            <div className="bg-slate-900 p-8 pt-12 pb-16 text-white rounded-b-[48px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32" />

                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <p className="text-brand-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">OPERARIO ACTIVO</p>
                        <h2 className="text-2xl font-black tracking-tight">{employeeInfo?.fullName}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">⚙️ {employeeInfo?.role || 'Técnico Especialista'}</p>
                    </div>
                    <button
                        onClick={() => setSelectedEmployee('')}
                        className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-red-500 transition-all group"
                    >
                        <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 px-6 -mt-8 space-y-6 pb-12">
                {/* Current Task Card */}
                <div className={`rounded-[32px] p-8 shadow-2xl transition-all duration-500 relative overflow-hidden ${activeLog ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-100'}`}>
                    {activeLog ? (
                        <>
                            <div className="flex items-center gap-2 mb-6">
                                <span className={`w-2 h-2 rounded-full ${activeLog.status === 'paused' ? 'bg-amber-400' : 'bg-white animate-ping'}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                    {activeLog.status === 'paused' ? 'TAREA EN PAUSA' : 'TRABAJANDO EN...'}
                                </span>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-3xl font-black mb-1 leading-tight">{activeLog.work_order_tasks?.task_type || 'Tarea...'}</h3>
                                <div className="flex items-center gap-2 text-emerald-100 font-bold text-sm">
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">{activeLog.work_order_tasks?.work_orders?.plate || 'WO'}</span>
                                    <span>{activeLog.work_order_tasks?.work_orders?.vehicle || 'Vehículo'}</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-center mb-10 bg-black/10 py-8 rounded-[32px] backdrop-blur-sm border border-white/10 shadow-inner">
                                <div className="text-7xl font-black tabular-nums tracking-tighter mb-1 text-white">
                                    {formatTime(elapsedTime)}
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-200">Cronómetro en Vivo</p>
                            </div>

                            <div className="space-y-4">
                                {activeLog.status === 'paused' ? (
                                    <button
                                        onClick={() => handleResumeTask(activeLog.task_id)}
                                        className="w-full py-5 bg-white text-emerald-600 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl hover:scale-[1.02] transition-all"
                                    >
                                        ▶️ REANUDAR TAREA
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handlePauseTask(activeLog.id)}
                                        className="w-full py-5 bg-white/20 hover:bg-white/30 rounded-2xl font-black uppercase text-xs tracking-widest transition-all backdrop-blur-md"
                                    >
                                        ⏸ PAUSAR TAREA
                                    </button>
                                )}
                                <button
                                    onClick={() => handleFinishTask(activeLog.id, activeLog.task_id)}
                                    className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest transition-all ${activeLog.status === 'paused' ? 'bg-white/10 text-white' : 'bg-white text-emerald-600 shadow-xl shadow-emerald-900/40 hover:scale-[1.02]'}`}
                                >
                                    ✅ FINALIZAR TAREA
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6">
                            {pendingTasks.length > 0 ? (
                                <div className="animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <p className="text-brand-600 text-[10px] font-black uppercase tracking-widest mb-1">TIENES TRABAJO PENDIENTE</p>
                                    <h3 className="text-xl font-black text-slate-900 mb-6">{pendingTasks[0].task_type}</h3>
                                    <button
                                        onClick={() => handleStartTask(pendingTasks[0].id)}
                                        className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-brand-200 hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        🚀 EMPEZAR AHORA
                                    </button>
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('tasks-list');
                                            el?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                                    >
                                        Ver todas mis tareas
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 mb-2">Sin tareas asignadas</h3>
                                    <p className="text-slate-400 font-medium text-sm mb-0">Buen trabajo. No tienes nada pendiente por ahora.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Pending Tasks Section - Spec Layout */}
                <div id="tasks-list" className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Tareas Pendientes</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Cola de Trabajo</p>
                        </div>
                        <span className="bg-brand-50 text-brand-600 text-[10px] font-black px-3 py-1.5 rounded-xl border border-brand-100">{pendingTasks.length}</span>
                    </div>

                    <div className="space-y-4">
                        {pendingTasks.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                                <p className="text-slate-400 text-sm font-medium italic">No tienes tareas asignadas por el momento.</p>
                            </div>
                        ) : (
                            pendingTasks.map(task => (
                                <div key={task.id} className="p-6 bg-slate-50 hover:bg-white rounded-[32px] border-2 border-transparent hover:border-brand-50 transition-all group shadow-sm hover:shadow-xl hover:shadow-brand-100/50">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase tracking-tighter">WO-{task.work_order_id?.slice(-5).toUpperCase() || 'NEW'}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est: {task.estimated_hours || '---'}h</span>
                                            </div>
                                            <h4 className="font-black text-slate-800 text-base leading-tight truncate">{task.task_type}</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1 truncate">
                                                {task.work_orders?.plate} • {task.work_orders?.vehicle}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleStartTask(task.id)}
                                            className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${activeLog ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white text-brand-600 border border-brand-100 shadow-lg shadow-brand-100 group-hover:bg-brand-600 group-hover:text-white group-hover:scale-105 active:scale-95'}`}
                                            disabled={!!activeLog}
                                        >
                                            <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                    {activeLog && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                            <p className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Debes pausar la tarea actual antes de iniciar esta</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            `}} />
        </div>
    );
};

export default OperatorTimeTracking;
