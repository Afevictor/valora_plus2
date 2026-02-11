import React, { useState, useEffect } from 'react';
import { clockIn, clockOut, startBreak, endBreak, getCurrentAttendance } from '../services/supabaseClient';
import { EmployeeAttendance, AttendanceBreak } from '../types';

const AttendanceTracker: React.FC = () => {
    const [attendance, setAttendance] = useState<EmployeeAttendance | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        loadStatus();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const loadStatus = async () => {
        setLoading(true);
        const data = await getCurrentAttendance();
        setAttendance(data);
        setLoading(false);
    };

    const handleClockIn = async () => {
        try {
            const data = await clockIn();
            setAttendance(data);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleClockOut = async () => {
        if (!attendance) return;
        const notes = prompt("Notas de la jornada (opcional):") || '';
        const success = await clockOut(attendance.id, notes);
        if (success) setAttendance(null);
    };

    const handleStartBreak = async (type: 'meal' | 'rest' | 'personal') => {
        if (!attendance) return;
        const brk = await startBreak(attendance.id, type);
        if (brk) loadStatus();
    };

    const handleEndBreak = async (breakId: string) => {
        const success = await endBreak(breakId);
        if (success) loadStatus();
    };

    const activeBreak = attendance?.attendance_breaks?.find((b: any) => !b.break_end);

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold">Cargando estado...</div>;

    return (
        <div className="max-w-md mx-auto p-4 animate-fade-in">
            <div className={`rounded-3xl shadow-2xl overflow-hidden border transition-all duration-500 ${attendance ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-900 border-slate-700'}`}>
                <div className="p-8 text-white relative">
                    <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
                        Control Horario
                    </div>

                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="text-5xl font-black tabular-nums tracking-tighter">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest opacity-60">
                            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>

                        {!attendance ? (
                            <div className="py-8 space-y-6 w-full">
                                <div className="p-4 bg-white/10 rounded-2xl border border-white/5">
                                    <p className="text-sm font-medium">No has iniciado jornada todavía.</p>
                                </div>
                                <button
                                    onClick={handleClockIn}
                                    className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    FICHAR ENTRADA
                                </button>
                            </div>
                        ) : (
                            <div className="py-4 space-y-6 w-full">
                                <div className="p-4 bg-emerald-500/30 rounded-2xl border border-white/10">
                                    <div className="flex justify-between items-center text-left">
                                        <div>
                                            <p className="text-[10px] font-black uppercase opacity-60">Fichado desde</p>
                                            <p className="text-xl font-black">{new Date(attendance.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-400 text-emerald-900 rounded-full text-[9px] font-black uppercase">
                                                Active
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {activeBreak ? (
                                    <div className="space-y-4 animate-pulse">
                                        <div className="p-4 bg-amber-500/30 rounded-2xl border border-amber-400/30 text-amber-100 italic text-sm">
                                            Descanso en curso ({activeBreak.break_type})...
                                        </div>
                                        <button
                                            onClick={() => handleEndBreak(activeBreak.id)}
                                            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all shadow-lg"
                                        >
                                            FINALIZAR DESCANSO
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleStartBreak('meal')}
                                            className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase transition-all border border-white/5"
                                        >
                                            🍽️ Comida
                                        </button>
                                        <button
                                            onClick={() => handleStartBreak('rest')}
                                            className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase transition-all border border-white/5"
                                        >
                                            ☕ Pausa
                                        </button>
                                        <button
                                            onClick={handleClockOut}
                                            className="col-span-2 mt-4 py-5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-red-900/20"
                                        >
                                            FICHAR SALIDA
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-black/20 p-6">
                    <div className="flex justify-between items-center text-white/50">
                        <div className="text-center">
                            <p className="text-[9px] font-black uppercase mb-1">Hoy</p>
                            <p className="text-sm font-bold text-white">---</p>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="text-center">
                            <p className="text-[9px] font-black uppercase mb-1">Semana</p>
                            <p className="text-sm font-bold text-white">---</p>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="text-center">
                            <p className="text-[9px] font-black uppercase mb-1">Mes</p>
                            <p className="text-sm font-bold text-white">---</p>
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-8 opacity-50">
                Sistema inalterable • Registro Legal España
            </p>
        </div>
    );
};

export default AttendanceTracker;
