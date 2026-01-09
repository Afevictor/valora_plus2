
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkOrder, Client, AppRole } from '../types';
import { 
    saveWorkOrderToSupabase, 
    getClientsFromSupabase, 
    saveClientToSupabase, 
    saveVehicle,
    uploadWorkshopFile,
    saveFileMetadata,
    supabase
} from '../services/supabaseClient';
import { analyzeVehicleReceptionBatch } from '../services/geminiService';
import ClientForm from './ClientForm';

// Supported Categories with bucket mappings
const FILE_CATEGORIES = [
    { id: 'Damage Front', bucket: 'evidence_photos' },
    { id: 'Damage Rear', bucket: 'evidence_photos' },
    { id: 'Damage Left', bucket: 'evidence_photos' },
    { id: 'Damage Right', bucket: 'evidence_photos' },
    { id: 'VIN', bucket: 'evidence_photos' },
    { id: 'Odometer', bucket: 'evidence_photos' },
    { id: 'Video Walkaround', bucket: 'videos' },
    { id: 'Registration', bucket: 'documents' },
    { id: 'Insurance Policy', bucket: 'documents' },
    { id: 'Invoice', bucket: 'documents' },
    { id: 'Other', bucket: 'documents' }
];

interface StagedFile {
    id: string;
    file: File;
    preview: string;
    category: string;
    bucket: string;
    type: 'image' | 'pdf' | 'video' | 'other';
}

const NewAppraisal: React.FC = () => {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  
  // Steps: 1=Client, 2=Reception (Uploads), 3=Details (Manual & Metadata)
  const [step, setStep] = useState(1);
  
  // Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  
  // Reception Data
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [vehicleData, setVehicleData] = useState({ plate: '', vin: '', km: 0, brand: '', model: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState<StagedFile | null>(null);
  const [tempTicketId] = useState(`WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`);
  
  // Repair Details
  const [repairDetails, setRepairDetails] = useState({ 
      types: [] as string[], 
      description: '', 
      priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent', 
      requestAppraisal: false 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
      const role = sessionStorage.getItem('vp_active_role') as AppRole;
      setActiveRole(role);
      
      if (role === 'Client') {
          handleAutoClientLoad();
      } else {
          loadClients();
      }
  }, []);

  const handleAutoClientLoad = async () => {
      setLoadingClients(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const allClients = await getClientsFromSupabase();
          const current = allClients.find(c => c.id === user.id);
          if (current) {
              setSelectedClient(current);
              setStep(2); // Jump straight to uploads
          }
      }
      setLoadingClients(false);
  };

  const loadClients = async () => {
      setLoadingClients(true);
      const data = await getClientsFromSupabase();
      if (data) setClients(data);
      setLoadingClients(false);
  };

  const handleClientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      setSelectedClient(null);
  };

  const filteredClients = clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm) ||
      c.taxId.toLowerCase().includes(searchTerm)
  );

  const handleSelectClient = (client: Client) => {
      setSelectedClient(client);
      setTimeout(() => setStep(2), 200);
  };

  const handleCreateClient = async (newClient: Client) => {
      await saveClientToSupabase(newClient);
      const updatedList = await getClientsFromSupabase();
      setClients(updatedList);
      setSelectedClient(newClient); 
      setShowClientModal(false);
      setStep(2); 
  };

  // --- STEP 2: STAGING FILES ---
  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const newStaged: StagedFile[] = Array.from(files).map(file => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isPdf = file.type === 'application/pdf';
        
        let bucket = 'documents';
        let type: 'image' | 'pdf' | 'video' | 'other' = 'other';
        
        if (isImage) {
            bucket = 'evidence_photos';
            type = 'image';
        } else if (isVideo) {
            bucket = 'videos';
            type = 'video';
        } else if (isPdf) {
            bucket = 'documents';
            type = 'pdf';
        }

        return {
            id: Math.random().toString(36).substring(7),
            file,
            preview: URL.createObjectURL(file),
            category: '', 
            bucket,
            type
        };
    });
    setStagedFiles(prev => [...prev, ...newStaged]);
  };

  const updateFileCategory = (id: string, category: string) => {
      const catObj = FILE_CATEGORIES.find(c => c.id === category);
      setStagedFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          category, 
          bucket: catObj?.bucket || f.bucket 
      } : f));
  };

  const removeStagedFile = (id: string) => {
      setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const runAIAnalysis = async () => {
      const photos = stagedFiles.filter(f => f.type === 'image');
      if (photos.length === 0) return;
      setIsAnalyzing(true);
      
      try {
          const base64Images = await Promise.all(photos.map(async (staged) => {
              const response = await fetch(staged.preview);
              const blob = await response.blob();
              return new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
              });
          }));

          const result = await analyzeVehicleReceptionBatch(base64Images);
          if (result && result.data) {
              setVehicleData(prev => ({
                  ...prev,
                  plate: result.data.plate || prev.plate,
                  vin: result.data.vin || prev.vin,
                  km: result.data.km || prev.km,
                  brand: result.data.brand || prev.brand,
                  model: result.data.model || prev.model
              }));
          }
      } catch (e) {
          console.error("AI Error", e);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleSubmit = async () => {
      if (!selectedClient) return;
      setIsSaving(true);
      
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Unauthorized");

          const dbId = crypto.randomUUID();
          const vehicleId = crypto.randomUUID();

          // 1. Upload Staged Files
          for (const staged of stagedFiles) {
              const filename = `${Date.now()}_${staged.file.name.replace(/\s/g, '_')}`;
              const storagePath = `${user.id}/${dbId}/${staged.category.replace(/\s/g, '_') || 'General'}/${filename}`;
              const uploadedPath = await uploadWorkshopFile(staged.file, staged.bucket, storagePath);
              if (uploadedPath) {
                  await saveFileMetadata({
                      workshop_id: user.id,
                      expediente_id: dbId, 
                      name: staged.file.name,
                      category: staged.category,
                      storage_path: uploadedPath,
                      bucket: staged.bucket,
                      mime_type: staged.file.type,
                      size_bytes: staged.file.size
                  });
              }
          }

          // 2. Save Vehicle
          await saveVehicle({
              id: vehicleId,
              clientId: selectedClient.id,
              plate: vehicleData.plate,
              vin: vehicleData.vin,
              brand: vehicleData.brand,
              model: vehicleData.model,
              currentKm: vehicleData.km,
              year: new Date().getFullYear(),
              fuel: 'Unknown',
              transmission: 'Manual',
              color: 'White'
          });

          // 3. Save Work Order
          const newOrder: WorkOrder = {
              id: dbId,
              expedienteId: tempTicketId,
              clientId: selectedClient.id,
              vehicleId: vehicleId,
              status: 'reception',
              repairType: repairDetails.types.length > 0 ? repairDetails.types as any : ['Mechanics'],
              entryDate: new Date().toISOString(),
              description: repairDetails.description,
              priority: repairDetails.priority,
              totalAmount: 0,
              photos: [], 
              team: { technicianIds: [] },
              plate: vehicleData.plate,
              vehicle: `${vehicleData.brand} ${vehicleData.model}`.trim() || 'Unknown Vehicle',
              currentKm: vehicleData.km,
              insuredName: selectedClient.name,
              requestAppraisal: repairDetails.requestAppraisal,
              lines: []
          };

          await saveWorkOrderToSupabase(newOrder);
          
          if (activeRole === 'Client') {
              alert("Your repair request has been submitted successfully!");
              navigate('/');
          } else {
              navigate('/kanban');
          }
      } catch (e) {
          console.error("Save Error", e);
          alert("Failed to save. Check console.");
      } finally {
          setIsSaving(false);
      }
  };

  const isStep2Valid = stagedFiles.length > 0 && stagedFiles.every(f => f.category !== '');

  return (
    <div className="max-w-5xl mx-auto p-6 min-h-[calc(100vh-2rem)]">
      
      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-slate-400 font-mono tracking-tighter">{tempTicketId}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{activeRole === 'Client' ? 'New Repair Request' : 'New Workshop Entry'}</h1>
        <div className="flex items-center gap-2 mt-4">
            {activeRole !== 'Client' && <div className={`h-2 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-brand-600' : 'bg-slate-200'}`}></div>}
            <div className={`h-2 w-12 rounded-full transition-colors ${step >= 2 ? (activeRole === 'Client' ? 'bg-emerald-500' : 'bg-brand-600') : 'bg-slate-200'}`}></div>
            <div className={`h-2 w-12 rounded-full transition-colors ${step >= 3 ? (activeRole === 'Client' ? 'bg-emerald-500' : 'bg-brand-600') : 'bg-slate-200'}`}></div>
        </div>
      </div>

      {/* STEP 1: CLIENT (Skipped for Clients) */}
      {step === 1 && activeRole !== 'Client' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">1. Client Identification</h2>
                  <button onClick={() => setShowClientModal(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                      New Client
                  </button>
              </div>
              <input 
                  type="text" 
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 mb-6 shadow-inner"
                  placeholder="Search by name, phone, Tax ID..."
                  value={searchTerm}
                  onChange={handleClientSearch}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClients.slice(0, 6).map(client => (
                      <div key={client.id} onClick={() => handleSelectClient(client)} className="p-4 rounded-xl border cursor-pointer hover:bg-brand-50 transition-all flex items-center gap-4 group">
                          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                              {client.name.charAt(0)}
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-800">{client.name}</h3>
                              <p className="text-xs text-slate-500">{client.phone}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* STEP 2: DIGITAL RECEPTION */}
      {step === 2 && (
          <div className="animate-fade-in space-y-8">
             <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-800">2. Upload Documents, Photos & Videos</h2>
                  {activeRole !== 'Client' && <button onClick={() => setStep(1)} className="text-slate-400 hover:text-brand-600 text-sm font-bold">Back to Client</button>}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center relative hover:border-emerald-400 hover:bg-slate-50 transition-all">
                        <input type="file" multiple accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => processFiles(e.target.files)} />
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <p className="text-sm font-black text-slate-700">Registration / PDF Zone</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Drag and drop here</p>
                    </div>

                    <button 
                        onClick={() => cameraInputRef.current?.click()}
                        className={`w-full ${activeRole === 'Client' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-black'} text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95`}
                    >
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Smart Camera
                    </button>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => processFiles(e.target.files)} />
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-white border border-slate-300 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Upload Photos & Videos
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => processFiles(e.target.files)} />
                 </div>

                 <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                            Pending Review List
                            <span className={`${activeRole === 'Client' ? 'bg-emerald-500' : 'bg-brand-500'} text-white px-2 py-0.5 rounded-full text-[10px]`}>{stagedFiles.length}</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                            {stagedFiles.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-300 italic flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                                    <svg className="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    No files staged yet.
                                </div>
                            )}
                            {stagedFiles.map(staged => (
                                <div key={staged.id} className="flex gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 relative group transition-all hover:shadow-md">
                                    <div 
                                        className="w-20 h-20 rounded-xl bg-slate-200 overflow-hidden cursor-pointer relative shadow-sm"
                                        onClick={() => setPreviewFile(staged)}
                                    >
                                        {staged.type === 'pdf' ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-600">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                <span className="text-[8px] font-black uppercase">PDF</span>
                                            </div>
                                        ) : staged.type === 'video' ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-brand-50 text-brand-600 relative">
                                                <video src={staged.preview} className="w-full h-full object-cover opacity-50" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                </div>
                                            </div>
                                        ) : (
                                            <img src={staged.preview} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase truncate mb-2">{staged.file.name}</p>
                                        <select 
                                            required
                                            className={`w-full text-xs p-2 border rounded-lg focus:ring-2 transition-colors ${staged.category ? 'border-slate-300 bg-white' : 'border-emerald-400 bg-emerald-50'}`}
                                            value={staged.category}
                                            onChange={(e) => updateFileCategory(staged.id, e.target.value)}
                                        >
                                            <option value="">Set Category *</option>
                                            {FILE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                                        </select>
                                    </div>
                                    <button onClick={() => removeStagedFile(staged.id)} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 w-7 h-7 rounded-full shadow-md border flex items-center justify-center">&times;</button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                onClick={runAIAnalysis}
                                disabled={isAnalyzing || stagedFiles.filter(f=>f.type==='image').length === 0}
                                className="px-6 py-3 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-sm hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isAnalyzing ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                AI Autofill
                            </button>
                            <button 
                                onClick={() => setStep(3)}
                                disabled={!isStep2Valid}
                                className={`${activeRole === 'Client' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand-600 hover:bg-brand-700'} text-white px-10 py-3 rounded-xl font-black shadow-lg disabled:opacity-30 disabled:grayscale transition-all active:scale-95`}
                            >
                                Confirm Documents
                            </button>
                        </div>
                    </div>
                 </div>
             </div>
          </div>
      )}

      {/* STEP 3: FINAL DETAILS */}
      {step === 3 && (
          <div className="animate-fade-in space-y-6">
             <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">3. Finalize Details</h2>
                  <button onClick={() => setStep(2)} className="text-slate-400 hover:text-emerald-600 font-bold text-sm">Back to Documents</button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Vehicle Identification</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">License Plate</label>
                            <input type="text" className="w-full p-3 border rounded-xl font-mono font-black text-lg bg-slate-50 uppercase focus:ring-2 focus:ring-emerald-500" value={vehicleData.plate} onChange={e => setVehicleData({...vehicleData, plate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Brand</label>
                            <input type="text" className="w-full p-2 border rounded-lg font-bold text-slate-700" value={vehicleData.brand} onChange={e => setVehicleData({...vehicleData, brand: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Model</label>
                            <input type="text" className="w-full p-2 border rounded-lg font-bold text-slate-700" value={vehicleData.model} onChange={e => setVehicleData({...vehicleData, model: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">VIN (Chassis)</label>
                            <input type="text" className="w-full p-2 border rounded-lg font-mono text-sm uppercase" value={vehicleData.vin} onChange={e => setVehicleData({...vehicleData, vin: e.target.value})} />
                        </div>
                    </div>
                 </div>

                 <div className={`${activeRole === 'Client' ? 'bg-emerald-900' : 'bg-slate-900'} text-white p-8 rounded-2xl shadow-xl space-y-6`}>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-2">Request Specification</h3>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Repair Description / Faults</label>
                        <textarea className="w-full p-4 bg-white/5 border border-white/10 rounded-xl h-24 text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="Explain what needs to be repaired..." value={repairDetails.description} onChange={e => setRepairDetails({...repairDetails, description: e.target.value})} />
                    </div>
                    
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSaving || !vehicleData.plate}
                        className={`w-full ${activeRole === 'Client' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-brand-500 hover:bg-brand-400'} text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 disabled:opacity-30 transition-all active:scale-95 mt-4`}
                    >
                        {isSaving ? <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'SUBMIT REPAIR REQUEST'}
                    </button>
                    {!vehicleData.plate && <p className="text-[10px] text-red-400 text-center font-bold">License plate is required.</p>}
                 </div>
             </div>
          </div>
      )}

      {/* PREVIEW MODAL */}
      {previewFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
              <div className="relative max-w-4xl w-full h-[85vh] bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div><h3 className="font-black text-slate-800 uppercase text-xs truncate">{previewFile.file.name}</h3></div>
                      <button onClick={() => setPreviewFile(null)} className="bg-white text-slate-500 font-black text-xl w-10 h-10 rounded-full border shadow-sm hover:text-red-500">&times;</button>
                  </div>
                  <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-4">
                      {previewFile.type === 'pdf' ? <embed src={previewFile.preview} type="application/pdf" className="w-full h-full rounded-lg" /> : previewFile.type === 'video' ? <video src={previewFile.preview} controls className="max-w-full max-h-full rounded-lg shadow-xl" /> : <img src={previewFile.preview} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />}
                  </div>
              </div>
          </div>
      )}

      {showClientModal && <ClientForm onSubmit={handleCreateClient} onCancel={() => setShowClientModal(false)} />}
    </div>
  );
};

export default NewAppraisal;
