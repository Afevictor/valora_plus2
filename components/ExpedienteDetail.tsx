
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RepairJob, Employee, Client, Vehicle, HourCostCalculation } from '../types';
import { 
    getClientsFromSupabase, 
    getWorkOrder, 
    getEmployeesFromSupabase,
    getActiveHourCostCalculation,
    saveLaborLog,
    getLaborLogsForOrder,
    getVehicle,
    getFilesForExpediente,
    supabase
} from '../services/supabaseClient';

const MANDATORY_PHASES = ['Disassembly', 'Body Repair', 'Paint'] as const;
type MandatoryPhase = typeof MANDATORY_PHASES[number];

interface ActiveTimer {
    startTime: number;
    accumulatedSeconds: number;
    phase: MandatoryPhase;
    employeeId: string;
    isPaused: boolean;
}

const ExpedienteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'summary' | 'data' | 'docs' | 'times' | 'chat'>('summary');
  
  // Data State
  const [job, setJob] = useState<RepairJob | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workshopRate, setWorkshopRate] = useState<number>(0);
  const [laborLogs, setLaborLogs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  // Timer State
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<MandatoryPhase | ''>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);

  // Initialize Data
  useEffect(() => {
    const loadAllData = async () => {
        if (!id) return;
        setIsLoadingMain(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const currentYear = new Date().getFullYear().toString();
        
        // Fetch Work Order first to get UUID and human IDs
        const foundJob = await getWorkOrder(id);

        if (foundJob) {
            setJob(foundJob);
            
            // Parallel fetches for associated data
            const [staff, rateData, logs, vData, fData, cDataList] = await Promise.all([
                getEmployeesFromSupabase(),
                getActiveHourCostCalculation(currentYear, user.id),
                getLaborLogsForOrder(foundJob.id),
                foundJob.vehicleId ? getVehicle(foundJob.vehicleId) : Promise.resolve(null),
                getFilesForExpediente(foundJob.id, foundJob.expedienteId), 
                getClientsFromSupabase()
            ]);

            setEmployees(staff);
            setWorkshopRate(rateData?.resultado_calculo?.hourlyCost || 0);
            setLaborLogs(logs);
            setVehicle(vData);
            setFiles(fData);
            
            if (foundJob.clientId) {
                setClient(cDataList.find(c => c.id === foundJob.clientId) || null);
            }
        }

        // Recover Timer State
        const saved = localStorage.getItem(`vp_labor_timer_${id}`);
        if (saved) {
            const parsed: ActiveTimer = JSON.parse(saved);
            setTimer(parsed);
            setSelectedPhase(parsed.phase);
            setSelectedEmployeeId(parsed.employeeId);
        }
        setIsLoadingMain(false);
    };
    loadAllData();
  }, [id]);

  // Robust Download Handler
  const handleDownload = async (url: string, filename: string, fileId: string) => {
    setDownloadingFileId(fileId);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed:', error);
        window.open(url, '_blank');
    } finally {
        setDownloadingFileId(null);
    }
  };

  // Stopwatch Logic
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

  // --- Timer Actions ---
  const startTimer = () => {
    if (!selectedPhase || !selectedEmployeeId) return;
    const newState: ActiveTimer = {
        startTime: Date.now(),
        accumulatedSeconds: 0,
        phase: selectedPhase as MandatoryPhase,
        employeeId: selectedEmployeeId,
        isPaused: false
    };
    setTimer(newState);
    localStorage.setItem(`vp_labor_timer_${id}`, JSON.stringify(newState));
  };

  const pauseTimer = () => {
    if (!timer || timer.isPaused) return;
    const now = Date.now();
    const sessionSeconds = Math.floor((now - timer.startTime) / 1000);
    const newState: ActiveTimer = { ...timer, accumulatedSeconds: timer.accumulatedSeconds + sessionSeconds, isPaused: true };
    setTimer(newState);
    localStorage.setItem(`vp_labor_timer_${id}`, JSON.stringify(newState));
  };

  const resumeTimer = () => {
    if (!timer || !timer.isPaused) return;
    const newState: ActiveTimer = { ...timer, startTime: Date.now(), isPaused: false };
    setTimer(newState);
    localStorage.setItem(`vp_labor_timer_${id}`, JSON.stringify(newState));
  };

  const finishTimer = async () => {
    if (!timer || !job || !client) return;
    setIsFinishing(true);

    const now = Date.now();
    const sessionSeconds = timer.isPaused ? 0 : Math.floor((now - timer.startTime) / 1000);
    const totalSeconds = timer.accumulatedSeconds + sessionSeconds;
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    const laborCost = (minutes / 60) * workshopRate;

    const logData = {
        work_order_id: job.id,
        client_id: client.id,
        employee_id: timer.employeeId,
        phase: timer.phase,
        start_time: new Date(timer.startTime - (timer.accumulatedSeconds * 1000)).toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: minutes,
        hourly_rate_snapshot: workshopRate,
        calculated_labor_cost: parseFloat(laborCost.toFixed(2))
    };

    const result = await saveLaborLog(logData);
    if (result.success) {
        setLaborLogs(prev => [logData, ...prev]);
        setTimer(null);
        localStorage.removeItem(`vp_labor_timer_${id}`);
        setSelectedPhase('');
    } else {
        alert(`Storage Failed: ${result.error}\n\nThis usually means you are trying to save logs for an Expedient that isn't yet synced to the cloud.`);
    }
    setIsFinishing(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  if (isLoadingMain) return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
          <svg className="animate-spin h-10 w-10 text-brand-600 mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Expedient Details...</p>
      </div>
  );

  if (!job) return <div className="p-10 text-center text-slate-500">Expedient not found.</div>;

  // File Partitioning
  const visualEvidence = files.filter(f => ['evidence_photos', 'videos'].includes(f.bucket));
  const valuationReports = files.filter(f => f.category === 'Valuation Report');
  const generalDocs = files.filter(f => f.bucket === 'documents' && f.category !== 'Valuation Report');

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen flex flex-col bg-slate-50 pb-20">
      
      {/* Expedient Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-brand-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{job.vehicle}</h1>
                <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg font-mono font-bold text-sm">{job.plate}</span>
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Expedient ID: {job.expedienteId || job.id.substring(0,8)}</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            {['summary', 'data', 'docs', 'times', 'chat'].map((t) => (
                <button
                    key={t}
                    onClick={() => setActiveTab(t as any)}
                    className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all whitespace-nowrap ${activeTab === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    {t}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[700px]">
        
        {activeTab === 'summary' && (
            <div className="flex-1 p-8 md:p-12 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-10">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center text-brand-600 shadow-inner">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Status</span>
                                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{job.status.replace('_', ' ')}</h2>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-sm">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Repair Description</h3>
                            <p className="text-slate-700 leading-relaxed font-medium text-lg italic">
                                "{job.description || 'No description provided during reception.'}"
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Priority</p>
                                <p className={`font-black text-sm uppercase ${job.priority === 'High' ? 'text-red-600' : 'text-slate-700'}`}>{job.priority}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Entry Date</p>
                                <p className="font-black text-sm text-slate-700">{new Date(job.entryDate).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">KM Recorded</p>
                                <p className="font-black text-sm text-slate-700">{job.currentKm || '-'} KM</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Appraisal</p>
                                <p className="font-black text-sm text-indigo-600">{job.requestAppraisal ? 'YES' : 'NO'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1 bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-6">Financial Overview</h3>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase">Estimated Total</p>
                                    <p className="text-4xl font-black tabular-nums">€{job.totalAmount?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-slate-500 text-xs font-bold uppercase">Logged Labor Cost</p>
                                    <p className="text-2xl font-black text-emerald-400 tabular-nums">€{laborLogs.reduce((acc, l) => acc + (l.calculated_labor_cost || 0), 0).toFixed(2)}</p>
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-slate-500 text-xs font-bold uppercase">Associated Insurance</p>
                                    <p className="text-sm font-bold text-slate-300">{job.insurance?.company || 'None / Direct'}</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => navigate('/history-claims')} className="mt-8 w-full bg-white/10 hover:bg-white/20 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10">
                            Manage Billing
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'data' && (
            <div className="flex-1 p-8 md:p-12 animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Client Identification</h3>
                    {client ? (
                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            <div className="col-span-2 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-[10px] font-black text-brand-600 uppercase mb-1">Full Name / Entity</p>
                                <p className="text-xl font-black text-slate-800">{client.name}</p>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">Tax ID: {client.taxId || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Client Type</p>
                                <p className="font-bold text-slate-700">{client.clientType}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Phone</p>
                                <p className="font-bold text-slate-700">{client.phone}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Email Address</p>
                                <p className="font-bold text-slate-700">{client.email}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-12 rounded-3xl text-center text-slate-400 font-bold border-2 border-dashed border-slate-200">
                            Client profile not linked.
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Technical Vehicle Profile</h3>
                    {vehicle ? (
                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            <div className="col-span-2 bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black text-brand-600 uppercase mb-1">Vehicle Specs</p>
                                    <p className="text-xl font-black text-slate-800">{vehicle.brand} {vehicle.model}</p>
                                </div>
                                <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-mono font-black text-lg text-slate-900 shadow-sm">{vehicle.plate}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-12 rounded-3xl text-center text-slate-400 font-bold border-2 border-dashed border-slate-200">
                            Detailed vehicle data not populated.
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'times' && (
            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 animate-fade-in">
                <div className="w-full md:w-[420px] p-8 space-y-8 bg-slate-50/50">
                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">New Labor Session</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Assigned Technician</label>
                                <select 
                                    disabled={!!timer}
                                    className="w-full p-4 border border-slate-200 rounded-2xl bg-white shadow-sm focus:ring-2 focus:ring-brand-500 outline-none font-bold text-slate-700 disabled:opacity-60 transition-all"
                                    value={selectedEmployeeId}
                                    onChange={e => setSelectedEmployeeId(e.target.value)}
                                >
                                    <option value="">Select Staff...</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden ring-4 ring-slate-100 group">
                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.4em] mb-3">Time in Session</p>
                        <h3 className="text-6xl font-mono font-black text-white tabular-nums tracking-tighter mb-6">
                            {formatTime(displaySeconds)}
                        </h3>
                        <div className="flex gap-4">
                            {!timer ? (
                                <button 
                                    disabled={!selectedPhase || !selectedEmployeeId}
                                    onClick={startTimer}
                                    className="flex-1 bg-brand-500 hover:bg-brand-400 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-20 disabled:grayscale"
                                >
                                    START SESSION
                                </button>
                            ) : (
                                <button 
                                    onClick={finishTimer} 
                                    disabled={isFinishing}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-black shadow-lg disabled:opacity-50"
                                >
                                    {isFinishing ? 'Saving...' : 'Finish'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ExpedienteDetail;
