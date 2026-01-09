
import React, { useState, useEffect, useRef } from 'react';
import { RepairJob, RepairStage, BusinessLine } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { 
    getWorkOrdersFromSupabase, 
    updateWorkOrderStatus, 
    deleteWorkOrder,
    uploadWorkshopFile,
    saveFileMetadata,
    supabase
} from '../services/supabaseClient';

const COLUMNS: { id: RepairStage; title: string; color: string }[] = [
  { id: 'reception', title: 'Reception / Pending', color: 'border-gray-300' },
  { id: 'disassembly', title: 'Disassembly / Diagnosis', color: 'border-yellow-300' },
  { id: 'bodywork', title: 'Repair (Body/Mech)', color: 'border-orange-400' },
  { id: 'paint', title: 'Paint / Finish', color: 'border-blue-400' },
  { id: 'admin_close', title: 'Admin Close / Quality', color: 'border-purple-400' },
  { id: 'finished', title: 'Ready for Delivery', color: 'border-green-400' },
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

  // Closing Flow State
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingJob, setClosingJob] = useState<RepairJob | null>(null);
  const [closingFile, setClosingFile] = useState<File | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const closingFileInputRef = useRef<HTMLInputElement>(null);

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

    // MANDATORY CLOSING FLOW TRIGGER
    if (targetStage === 'finished') {
        setClosingJob(jobToUpdate);
        setIsClosingModalOpen(true);
        return;
    }

    // Normal Transition
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === draggedJobId ? { ...job, status: targetStage } : job
      )
    );
    await updateWorkOrderStatus(draggedJobId, targetStage);
    setDraggedJobId(null);
  };

  const finalizeClosure = async () => {
      if (!closingJob || !closingFile) return;
      setIsFinalizing(true);

      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Session expired. Please log in again.");

          // 1. Upload Valuation Report - Use the DB UUID for path consistency
          const timestamp = Date.now();
          const safeFileName = closingFile.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
          const filename = `FINAL_VALUATION_${timestamp}_${safeFileName}`;
          
          // CRITICAL: Path uses user.id and job.id (UUID)
          const storagePath = `${user.id}/${closingJob.id}/Valuation_Reports/${filename}`;
          
          const uploadedPath = await uploadWorkshopFile(closingFile, 'documents', storagePath);
          
          if (!uploadedPath) throw new Error("Storage upload failed.");

          // 2. Save Metadata to database
          const metadataSuccess = await saveFileMetadata({
              workshop_id: user.id,
              expediente_id: closingJob.id, // Linked to UUID for safety
              name: closingFile.name,
              category: 'Valuation Report',
              storage_path: uploadedPath,
              bucket: 'documents',
              mime_type: closingFile.type,
              size_bytes: closingFile.size
          });

          if (!metadataSuccess) throw new Error("Metadata registration failed.");

          // 3. Update Status to Finished in DB
          const statusSuccess = await updateWorkOrderStatus(closingJob.id, 'finished');
          if (!statusSuccess) throw new Error("Status update failed in database.");
          
          // 4. Update Local State
          setJobs(prev => prev.map(j => j.id === closingJob.id ? { ...j, status: 'finished' } : j));
          
          // Success Feedback
          alert("Expedient closed successfully. Valuation report is now available in the Docs tab.");
          
          // Reset
          setIsClosingModalOpen(false);
          setClosingJob(null);
          setClosingFile(null);
          setDraggedJobId(null);

      } catch (e: any) {
          console.error("Closure Error:", e);
          alert(`Critical Error during closure: ${e.message || 'Unknown database error'}`);
      } finally {
          setIsFinalizing(false);
      }
  };

  const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm("Are you sure you want to delete this work order?")) {
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
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 overflow-hidden">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col gap-6 mb-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Workshop Planner</h1>
              <p className="text-slate-500 text-sm">Manage Mechanics and Bodywork workflow.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-brand-500 text-sm"
                        placeholder="Search WO, plate..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={() => navigate('/new-appraisal')} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm whitespace-nowrap">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    New WO
                </button>
            </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
             <div className="flex p-1 gap-1 w-full md:w-auto">
                {['all', 'Mechanics', 'Bodywork'].map(l => (
                    <button 
                        key={l}
                        onClick={() => setLineFilter(l as any)}
                        className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${lineFilter === l ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {l.charAt(0).toUpperCase() + l.slice(1)}
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

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-10 w-10 text-brand-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="text-sm text-slate-500 font-medium">Syncing with database...</p>
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
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getPriorityColor(job.priority)}`}>{job.priority}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">{job.vehicle}</h4>
                        <div className="flex items-center gap-1 mb-2 text-xs text-slate-500">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <span className="truncate max-w-[150px] font-medium">{job.insuredName || 'Client N/A'}</span>
                        </div>
                        <div className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono font-medium text-slate-600 border border-slate-200 inline-block">{job.plate}</div>
                        {job.hasExternalAppraisal && <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-[10px] uppercase font-bold mt-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>Appraisal Active</div>}
                        </Link>
                    ))}
                    {getCount(column.id) === 0 && <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center"><p className="text-xs text-slate-400 opacity-50">Empty</p></div>}
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
                            <tr><th className="px-6 py-3">File ID</th><th className="px-6 py-3">Line</th><th className="px-6 py-3">Vehicle / Client</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Priority</th><th className="px-6 py-3 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredJobs.map(job => (
                                <tr key={job.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/expediente/${job.id}`)}>
                                    <td className="px-6 py-4 font-bold text-slate-700">{job.expedienteId}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${job.businessLine === 'Mechanics' ? 'bg-blue-100 text-blue-800' : job.businessLine === 'Bodywork' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100'}`}>{job.businessLine || 'General'}</span></td>
                                    <td className="px-6 py-4"><div className="flex flex-col"><span className="font-medium text-slate-900">{job.vehicle}</span><span className="text-xs text-slate-500 mb-1">{job.insuredName}</span><span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded w-fit">{job.plate}</span></div></td>
                                    <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{COLUMNS.find(c => c.id === job.status)?.title || job.status}</span></td>
                                    <td className="px-6 py-4"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${getPriorityColor(job.priority)}`}>{job.priority}</span></td>
                                    <td className="px-6 py-4 text-right"><button onClick={(e) => handleDeleteJob(e, job.id)} className="text-red-400 hover:text-red-600 transition-colors p-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {/* CLOSING FLOW MODAL */}
      {isClosingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                  <div className="bg-slate-50 p-8 border-b border-slate-100">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <h2 className="text-2xl font-black text-slate-800 text-center uppercase tracking-tighter">Ready for Delivery?</h2>
                      <p className="text-slate-500 text-center mt-2 text-sm">Please upload the <strong>Insurer's Valuation Report</strong> for final profitability analysis before closing this expedient.</p>
                  </div>

                  <div className="p-8 space-y-6">
                      <div 
                        onClick={() => !isFinalizing && closingFileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${closingFile ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200 hover:border-brand-400 hover:bg-white'} ${isFinalizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                          <input 
                            ref={closingFileInputRef}
                            type="file" 
                            accept=".pdf,image/*" 
                            className="hidden" 
                            disabled={isFinalizing}
                            onChange={(e) => setClosingFile(e.target.files?.[0] || null)} 
                          />
                          {!closingFile ? (
                              <div className="space-y-2">
                                  <svg className="w-10 h-10 text-slate-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Select PDF or Photo</p>
                              </div>
                          ) : (
                              <div className="flex items-center justify-center gap-3">
                                  <div className="bg-green-600 text-white p-2 rounded-lg">
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                  <div className="text-left overflow-hidden">
                                      <p className="text-sm font-bold text-green-700 truncate max-w-[180px]">{closingFile.name}</p>
                                      <p className="text-[10px] text-green-500 uppercase font-black">Ready to Finalize</p>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setClosingFile(null); }} className="text-red-400 hover:text-red-600 p-1">&times;</button>
                              </div>
                          )}
                      </div>

                      <div className="flex gap-4">
                          <button 
                            disabled={isFinalizing}
                            onClick={() => { setIsClosingModalOpen(false); setClosingFile(null); setDraggedJobId(null); }}
                            className="flex-1 px-6 py-4 bg-white border border-slate-300 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all uppercase text-xs disabled:opacity-50"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={finalizeClosure}
                            disabled={!closingFile || isFinalizing}
                            className="flex-[2] px-6 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all disabled:opacity-30 disabled:grayscale uppercase text-xs flex items-center justify-center gap-2"
                          >
                              {isFinalizing ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>Processing...</span>
                                  </>
                              ) : "Finalize Delivery"}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default RepairKanban;
