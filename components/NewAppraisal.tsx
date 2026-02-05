
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkOrder, AppRole } from '../types';
import {
    saveWorkOrderToSupabase,
    saveVehicle,
    uploadWorkshopFile,
    saveFileMetadata,
    logClientActivity,
    supabase,
    getWorkshopCustomers,
    saveWorkshopCustomer,
    WorkshopCustomer
} from '../services/supabaseClient';
import WorkshopCustomerForm from './WorkshopCustomerForm';

// Bucket default
const DEFAULT_BUCKET = 'reception-files';

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

    // Pasos: 1=Cliente, 2=Recepción (Subidas), 3=Detalles
    const [step, setStep] = useState(1);

    // Estado de Datos (CUSTOMERS now)
    const [customers, setCustomers] = useState<WorkshopCustomer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Datos de Recepción
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [vehicleData, setVehicleData] = useState({ plate: '', vin: '', km: 0, brand: '', model: '' });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [previewFile, setPreviewFile] = useState<StagedFile | null>(null);
    const [tempTicketId] = useState(`OT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`);
    const [workshopOwnerId, setWorkshopOwnerId] = useState<string | null>(null);

    // Detalles de Reparación
    const [repairDetails, setRepairDetails] = useState({
        types: [] as string[],
        description: '',
        priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
        requestAppraisal: false
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const aiScanInputRef = useRef<HTMLInputElement>(null);

    // Inicialización
    useEffect(() => {
        const role = sessionStorage.getItem('vp_active_role') as AppRole;
        setActiveRole(role);

        const loadInitData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setWorkshopOwnerId(user.id);
            loadCustomers();
        };
        loadInitData();
    }, [activeRole]);

    const loadCustomers = async () => {
        setLoadingCustomers(true);
        const data = await getWorkshopCustomers();
        if (data) setCustomers(data);
        setLoadingCustomers(false);
    };

    const handleCustomerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setSelectedCustomer(null);
    };

    const filteredCustomers = customers.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm) ||
        c.tax_id?.toLowerCase().includes(searchTerm)
    );

    const handleSelectCustomer = (customer: WorkshopCustomer) => {
        setSelectedCustomer(customer);
        setTimeout(() => setStep(2), 200);
    };

    const handleCreateCustomer = async (newCustomerData: Partial<WorkshopCustomer>) => {
        const saved = await saveWorkshopCustomer(newCustomerData);
        if (saved) {
            const updatedList = await getWorkshopCustomers();
            setCustomers(updatedList);
            setSelectedCustomer(saved);
            setShowCustomerModal(false);
            setStep(2);
        } else {
            alert('Error al guardar el cliente.');
        }
    };

    // --- PASO 2: PROCESAR ARCHIVOS ---
    const processFiles = (files: FileList | null) => {
        if (!files) return;
        const newStaged: StagedFile[] = Array.from(files).map(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isPdf = file.type === 'application/pdf';

            const bucket = 'reception-files';
            let type: 'image' | 'pdf' | 'video' | 'other' = 'other';

            if (isImage) type = 'image';
            else if (isVideo) type = 'video';
            else if (isPdf) type = 'pdf';

            return {
                id: Math.random().toString(36).substring(7),
                file,
                preview: URL.createObjectURL(file),
                category: 'General',
                bucket,
                type
            };
        });
        setStagedFiles(prev => [...prev, ...newStaged]);
    };


    const removeStagedFile = (id: string) => {
        setStagedFiles(prev => prev.filter(f => f.id !== id));
    };

    const runSmartAnalysis = async () => {
        console.log("AI analysis disabled.");
    };

    const handleDirectAiScan = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const newStaged: StagedFile[] = Array.from(files).map(file => {
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            return {
                id: Math.random().toString(36).substring(7),
                file,
                preview: URL.createObjectURL(file),
                category: 'General',
                bucket: isImage ? 'evidence_photos' : 'documents',
                type: isImage ? 'image' : isPdf ? 'pdf' : 'other'
            };
        });
        setStagedFiles(prev => [...prev, ...newStaged]);
    };

    const handleSubmit = async () => {
        if (!selectedCustomer || !workshopOwnerId) {
            alert("Error: No se ha identificado el cliente o el taller.");
            return;
        }
        setIsSaving(true);

        try {
            const vehicleId = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();

            // 1. Guardar Vehículo
            await saveVehicle({
                id: vehicleId,
                clientId: selectedCustomer.id, // Linking to workshop_customer ID
                plate: vehicleData.plate,
                vin: vehicleData.vin,
                brand: vehicleData.brand,
                model: vehicleData.model,
                currentKm: vehicleData.km,
                year: new Date().getFullYear(),
                fuel: 'Desconocido',
                transmission: 'Manual',
                color: 'Blanco'
            }, workshopOwnerId);

            // 2. Guardar Orden de Trabajo
            const newOrder: WorkOrder = {
                id: window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
                expedienteId: tempTicketId,
                clientId: selectedCustomer.id,
                vehicleId: vehicleId,
                status: 'reception',
                repairType: repairDetails.types.length > 0 ? repairDetails.types as any : ['Mecánica'],
                entryDate: new Date().toISOString(),
                description: repairDetails.description,
                priority: repairDetails.priority,
                totalAmount: 0,
                photos: [],
                team: { technicianIds: [] },
                plate: vehicleData.plate,
                vin: vehicleData.vin,
                vehicle: `${vehicleData.brand} ${vehicleData.model}`.trim() || 'Vehículo Desconocido',
                currentKm: vehicleData.km,
                insuredName: selectedCustomer.full_name,
                requestAppraisal: repairDetails.requestAppraisal,
                lines: []
            };

            const woResult = await saveWorkOrderToSupabase(newOrder, workshopOwnerId);
            if (!woResult.success) throw new Error(`Error al guardar la orden: ${woResult.error}`);

            // 3. Subir archivos
            for (const staged of stagedFiles) {
                const timestamp = Date.now();
                const safeName = staged.file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                const filename = `${timestamp}_${safeName}`;
                const storagePath = `${workshopOwnerId}/${tempTicketId}/${filename}`;

                const uploadedPath = await uploadWorkshopFile(staged.file, staged.bucket, storagePath);

                if (uploadedPath) {
                    await saveFileMetadata({
                        workshop_id: workshopOwnerId,
                        expediente_id: tempTicketId,
                        original_filename: staged.file.name,
                        category: staged.category || 'General',
                        storage_path: uploadedPath,
                        bucket: staged.bucket,
                        mime_type: staged.file.type,
                        size_bytes: staged.file.size
                    });
                }
            }

            // 4. Log Activity
            const activityFiles: any[] = [];
            for (const staged of stagedFiles) {
                const { data: { publicUrl } } = supabase.storage.from(staged.bucket).getPublicUrl(`${workshopOwnerId}/${tempTicketId}/${staged.file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`);
                activityFiles.push({
                    url: publicUrl,
                    name: staged.file.name,
                    category: staged.category,
                    type: staged.type
                });
            }

            await logClientActivity({
                client_id: selectedCustomer.id,
                plate: vehicleData.plate,
                expediente_id: tempTicketId,
                activity_type: 'appraisal_request',
                summary: repairDetails.description || 'Nueva solicitud de reparación.',
                file_assets: activityFiles,
                raw_data: {
                    vehicle: vehicleData,
                    details: repairDetails,
                    tempTicketId
                }
            });

            if (activeRole === 'Client') {
                alert("¡Solicitud registrada correctamente!");
                navigate('/kanban');
            } else {
                navigate('/kanban');
            }
        } catch (e: any) {
            console.error("[SUBMIT] ERROR:", e);
            alert(`Error durante el envío: ${e.message || 'Error desconocido'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const isStep2Valid = stagedFiles.length > 0;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 min-h-[calc(100vh-2rem)]">
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-slate-400 font-mono tracking-tighter">{tempTicketId}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{activeRole === 'Client' ? 'Nueva Recepción' : 'Nueva Entrada a Taller'}</h1>
                <div className="flex items-center gap-2 mt-4">
                    <div className={`h-2 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                    <div className={`h-2 w-12 rounded-full transition-colors ${step >= 2 ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                    <div className={`h-2 w-12 rounded-full transition-colors ${step >= 3 ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                </div>
            </div>

            {/* PASO 1: CLIENTE */}
            {step === 1 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">1. Identificación del Cliente</h2>
                        <button onClick={() => setShowCustomerModal(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors">
                            Nuevo Cliente
                        </button>
                    </div>
                    <input
                        type="text"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 mb-6 shadow-inner"
                        placeholder="Buscar por nombre, teléfono, DNI..."
                        value={searchTerm}
                        onChange={handleCustomerSearch}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredCustomers.length === 0 && (
                            <div className="col-span-full py-8 text-center text-slate-400 italic">
                                No se han encontrado resultados.
                            </div>
                        )}
                        {filteredCustomers.map(customer => (
                            <div key={customer.id} onClick={() => handleSelectCustomer(customer)} className="p-4 rounded-xl border cursor-pointer hover:bg-brand-50 transition-all flex items-center gap-4 group bg-white shadow-sm hover:border-brand-300">
                                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors flex-shrink-0">
                                    {customer.full_name.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-slate-800 truncate">{customer.full_name}</h3>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                            {customer.phone || 'Sin teléfono'}
                                        </p>
                                        <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            {customer.email || 'Sin email'}
                                        </p>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PASO 2: RECEPCIÓN DIGITAL */}
            {step === 2 && (
                <div className="animate-fade-in space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">2. Documentación y Evidencias</h2>
                        <button onClick={() => setStep(1)} className="text-slate-400 hover:text-brand-600 text-sm font-bold">Volver a Cliente</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center relative hover:border-emerald-400 hover:bg-slate-50 transition-all">
                                <input type="file" multiple accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => processFiles(e.target.files)} />
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <p className="text-sm font-black text-slate-700">Documentos / PDF</p>
                            </div>

                            <button onClick={() => cameraInputRef.current?.click()} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95">
                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Cámara
                            </button>
                            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => processFiles(e.target.files)} />

                            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white border border-slate-300 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors">
                                Subir Archivos
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => processFiles(e.target.files)} />
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                                    Archivos Pendientes
                                    <span className="bg-brand-500 text-white px-2 py-0.5 rounded-full text-[10px]">{stagedFiles.length}</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                                    {stagedFiles.map(staged => (
                                        <div key={staged.id} className="flex gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 relative group transition-all hover:shadow-md">
                                            <div className="w-20 h-20 rounded-xl bg-slate-200 overflow-hidden cursor-pointer relative shadow-sm" onClick={() => setPreviewFile(staged)}>
                                                {staged.type === 'pdf' ? (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-600"><span className="text-[8px] font-black uppercase">PDF</span></div>
                                                ) : (
                                                    <img src={staged.preview} className="w-full h-full object-cover" alt="preview" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase truncate mb-2">{staged.file.name}</p>
                                            </div>
                                            <button onClick={() => removeStagedFile(staged.id)} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 w-7 h-7 rounded-full shadow-md border flex items-center justify-center">&times;</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                                    <button onClick={() => setStep(3)} disabled={!isStep2Valid} className="bg-brand-600 hover:bg-brand-700 text-white px-10 py-3 rounded-xl font-black shadow-lg disabled:opacity-30 transition-all">
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PASO 3: DETALLES */}
            {step === 3 && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">3. Datos del Vehículo y Reparación</h2>
                        <button onClick={() => setStep(2)} className="text-slate-400 hover:text-brand-600 font-bold text-sm">Volver a Archivos</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Vehículo</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Matrícula *</label>
                                    <input type="text" className="w-full p-3 border rounded-xl font-mono font-black text-lg bg-slate-50 uppercase" value={vehicleData.plate} onChange={e => setVehicleData({ ...vehicleData, plate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Marca</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={vehicleData.brand} onChange={e => setVehicleData({ ...vehicleData, brand: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Modelo</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={vehicleData.model} onChange={e => setVehicleData({ ...vehicleData, model: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Kms</label>
                                    <input type="number" className="w-full p-2 border rounded-lg" value={vehicleData.km || ''} onChange={e => setVehicleData({ ...vehicleData, km: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">VIN</label>
                                    <input type="text" className="w-full p-2 border rounded-lg font-mono uppercase" value={vehicleData.vin} onChange={e => setVehicleData({ ...vehicleData, vin: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl space-y-6">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-2">Orden de Trabajo</h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observaciones / Daños</label>
                                <textarea className="w-full p-4 bg-white/5 border border-white/10 rounded-xl h-24 text-sm outline-none focus:border-emerald-500 transition-colors" value={repairDetails.description} onChange={e => setRepairDetails({ ...repairDetails, description: e.target.value })} />
                            </div>
                            <button onClick={handleSubmit} disabled={isSaving || !vehicleData.plate} className="w-full bg-brand-500 hover:bg-brand-400 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 disabled:opacity-30 transition-all mt-4">
                                {isSaving ? 'Guardando...' : 'CREAR ORDEN DE REPARACIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CLIENTE */}
            {showCustomerModal && <WorkshopCustomerForm onSubmit={handleCreateCustomer} onCancel={() => setShowCustomerModal(false)} />}

            {/* MODAL PREVIEW */}
            {previewFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90">
                    <div className="relative max-w-4xl w-full h-[85vh] bg-white rounded-3xl overflow-hidden flex flex-col">
                        <button onClick={() => setPreviewFile(null)} className="absolute top-4 right-4 bg-white text-slate-900 font-bold w-10 h-10 rounded-full shadow-lg z-10">&times;</button>
                        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-4">
                            <img src={previewFile.preview} className="max-w-full max-h-full object-contain" alt="preview" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewAppraisal;
