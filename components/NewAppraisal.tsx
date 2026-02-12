
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
    WorkshopCustomer,
    getInsurers,
    Insurer,
    createExtractionJob,
    triggerExtractionProcess
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
    autoProcess?: boolean;
}

const NewAppraisal: React.FC = () => {
    const navigate = useNavigate();
    const [activeRole, setActiveRole] = useState<AppRole | null>(null);

    // Pasos: 1=Cliente, 2=Recepción (Subidas), 3=Detalles
    const [step, setStep] = useState(1);

    // Estado de Datos (CUSTOMERS now)
    const [customers, setCustomers] = useState<WorkshopCustomer[]>([]);
    const [insurers, setInsurers] = useState<Insurer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Datos de Recepción
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [vehicleData, setVehicleData] = useState({ plate: '', vin: '', km: 0, brand: '', model: '', year: new Date().getFullYear(), color: '' });
    const [claimData, setClaimData] = useState({
        insurer_id: '',
        claim_number: '',
        incident_type: 'collision',
        incident_date: new Date().toISOString().split('T')[0]
    });
    const [extractionStatus, setExtractionStatus] = useState<'idle' | 'processing' | 'completed' | 'failed' | 'requires_review'>('idle');
    const [extractionMessage, setExtractionMessage] = useState('');
    const [extractionJobId, setExtractionJobId] = useState<string | null>(null);
    const [extractedBilling, setExtractedBilling] = useState<any>({
        bodywork_hours: 0,
        paint_hours: 0,
        bodywork_rate: 45,
        paint_rate: 50,
        materials_amount: 0,
        total_estimate: 0
    });
    const [extractedParts, setExtractedParts] = useState<any[]>([]);
    const [confidenceScores, setConfidenceScores] = useState<any>(null);
    const [showReviewUI, setShowReviewUI] = useState(false);
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
            loadInsurers();
        };
        loadInitData();
    }, [activeRole]);

    const loadCustomers = async () => {
        setLoadingCustomers(true);
        const data = await getWorkshopCustomers();
        if (data) setCustomers(data);
        setLoadingCustomers(false);
    };

    const loadInsurers = async () => {
        const data = await getInsurers();
        if (data) setInsurers(data);
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

    const runSmartAnalysis = async (file: File) => {
        if (!workshopOwnerId) return;
        setExtractionStatus('processing');
        setExtractionMessage('Analizando PDF con IA...');

        try {
            // 1. Upload file (re-using existing simplified upload logic)
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const filename = `${timestamp}_${safeName}`;
            const storagePath = `${workshopOwnerId}/temp_extraction/${filename}`;

            const uploadedPath = await uploadWorkshopFile(file, 'reception-files', storagePath);
            if (!uploadedPath) throw new Error("Error subiendo el archivo para análisis.");

            // 2. Save Metadata
            const metadata = await saveFileMetadata({
                workshop_id: workshopOwnerId,
                expediente_id: tempTicketId,
                original_filename: file.name,
                category: 'Assessment PDF',
                storage_path: uploadedPath,
                bucket: 'reception-files',
                mime_type: file.type,
                size_bytes: file.size
            });

            if (!metadata) throw new Error("Error guardando metadatos del archivo.");

            // 3. Create Job
            const jobResult = await createExtractionJob({
                work_order_id: null, // Standalone extraction before submit
                file_id: metadata.id,
                status: 'pending'
            });

            if (!jobResult.success || !jobResult.job) throw new Error(jobResult.error || "Error creando trabajo de IA.");
            setExtractionJobId(jobResult.job.id);

            // 4. Trigger & Wait (Polled or Sync response)
            const triggerResult = await triggerExtractionProcess(jobResult.job.id);
            if (!triggerResult.success) throw new Error(triggerResult.error || "Error procesando IA.");

            // 5. Apply Results
            const resultData = triggerResult.data;
            const data = resultData?.data;
            const status = resultData?.status;
            const scores = resultData?.confidence_scores;

            if (data) {
                applyExtractionResults(data);
                setExtractedBilling(data.labor ? { ...data.labor, materials_amount: data.materials?.paint_amount, total_estimate: data.total_estimate } : null);
                setExtractedParts(data.materials?.parts || []);
                setConfidenceScores(scores);

                if (status === 'requires_review') {
                    setExtractionStatus('requires_review');
                    setExtractionMessage('Análisis completado, pero requiere revisión manual.');
                    setShowReviewUI(true);
                } else {
                    setExtractionStatus('completed');
                    setExtractionMessage('¡Datos extraídos y aplicados correctamente!');
                    setTimeout(() => setExtractionStatus('idle'), 3000);
                }
            } else {
                setExtractionStatus('failed');
                setExtractionMessage('No se pudieron extraer datos del PDF.');
            }

        } catch (e: any) {
            console.error("AI Extraction Error:", e);
            setExtractionStatus('failed');
            setExtractionMessage(e.message || "Error desconocido");
        }
    };

    const applyExtractionResults = (data: any) => {
        if (data.vehicle) {
            setVehicleData(prev => ({
                ...prev,
                plate: data.vehicle.plate || prev.plate,
                vin: data.vehicle.vin || prev.vin,
                brand: data.vehicle.brand || prev.brand,
                model: data.vehicle.model || prev.model,
                year: data.vehicle.year || prev.year,
                km: data.vehicle.km || prev.km,
                color: data.vehicle.color || prev.color
            }));
        }
        if (data.claim) {
            setClaimData(prev => ({
                ...prev,
                claim_number: data.claim.claim_number || prev.claim_number,
                incident_type: data.claim.incident_type || prev.incident_type,
                incident_date: data.claim.incident_date || prev.incident_date
            }));
        }
        if (data.labor) {
            setExtractedBilling({
                bodywork_hours: data.labor.bodywork_hours || 0,
                paint_hours: data.labor.paint_hours || 0,
                bodywork_rate: data.labor.bodywork_rate || 45,
                paint_rate: data.labor.paint_rate || 50,
                materials_amount: data.materials?.paint_amount || 0,
                total_estimate: data.total_estimate || 0
            });
        }
        if (data.materials?.parts) {
            setExtractedParts(data.materials.parts);
        }
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

        const cleanPlate = vehicleData.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const plateRegex = /^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
        if (cleanPlate && !plateRegex.test(cleanPlate)) {
            if (!confirm(`La matrícula ${cleanPlate} no sigue el formato estándar (1234BBB). ¿Desea continuar?`)) return;
        }

        setIsSaving(true);

        try {
            const vehicleId = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();

            await saveVehicle({
                id: vehicleId,
                clientId: selectedCustomer.id,
                plate: vehicleData.plate,
                vin: vehicleData.vin,
                brand: vehicleData.brand,
                model: vehicleData.model,
                currentKm: vehicleData.km,
                year: vehicleData.year,
                fuel: 'Desconocido',
                transmission: 'Manual',
                color: vehicleData.color || 'Blanco'
            }, workshopOwnerId);

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
                insurer_id: claimData.insurer_id || undefined,
                claim_number: claimData.claim_number,
                incident_type: claimData.incident_type,
                incident_date: claimData.incident_date,
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

            for (const staged of stagedFiles) {
                const timestamp = Date.now();
                const safeName = staged.file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                const filename = `${timestamp}_${safeName}`;
                const storagePath = `${workshopOwnerId}/${tempTicketId}/${filename}`;

                const uploadedPath = await uploadWorkshopFile(staged.file, staged.bucket, storagePath);

                if (uploadedPath) {
                    const metadata = await saveFileMetadata({
                        workshop_id: workshopOwnerId,
                        expediente_id: tempTicketId,
                        original_filename: staged.file.name,
                        category: staged.category || 'General',
                        storage_path: uploadedPath,
                        bucket: staged.bucket,
                        mime_type: staged.file.type,
                        size_bytes: staged.file.size
                    });

                    if (staged.type === 'pdf' && metadata?.id) {
                        try {
                            const jobResult = await createExtractionJob({
                                work_order_id: newOrder.id,
                                file_id: metadata.id,
                                status: 'pending'
                            });
                            if (jobResult.success && jobResult.job) {
                                await triggerExtractionProcess(jobResult.job.id);
                            }
                        } catch (aiErr) {
                            console.warn("AI Trigger failed (non-critical):", aiErr);
                        }
                    }
                }
            }

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
                raw_data: { vehicle: vehicleData, details: repairDetails, claim: claimData, tempTicketId }
            });

            if (extractionJobId) {
                await supabase.from('extraction_jobs').update({ work_order_id: newOrder.id }).eq('id', extractionJobId);
            }

            if (extractedBilling && extractedBilling.total_estimate > 0) {
                await supabase.from('work_order_billing').insert({
                    workshop_id: workshopOwnerId,
                    work_order_id: newOrder.id,
                    bodywork_hours: extractedBilling.bodywork_hours || 0,
                    paint_hours: extractedBilling.paint_hours || 0,
                    bodywork_rate: extractedBilling.bodywork_rate || 45,
                    paint_rate: extractedBilling.paint_rate || 50,
                    labor_hours_billed: (extractedBilling.bodywork_hours || 0) + (extractedBilling.paint_hours || 0),
                    labor_amount: (extractedBilling.bodywork_hours * (extractedBilling.bodywork_rate || 45)) + (extractedBilling.paint_hours * (extractedBilling.paint_rate || 50)),
                    materials_amount: extractedBilling.materials_amount || 0,
                    total_amount: extractedBilling.total_estimate || 0,
                    invoice_status: 'draft',
                    source: extractionJobId ? 'ai_extraction' : 'manual'
                });
            }

            if (extractedParts.length > 0) {
                const partsToInsert = extractedParts.map(p => ({
                    workshop_id: workshopOwnerId,
                    work_order_id: newOrder.id,
                    part_number: p.part_number,
                    description: p.description,
                    qty_billed: p.quantity,
                    price_billed: p.unit_price,
                    confidence: p.confidence || 0,
                    source: extractionJobId ? 'ai_extraction' : 'manual'
                }));
                await supabase.from('work_order_parts').insert(partsToInsert);
            }

            if (extractionJobId) {
                await supabase.from('extraction_jobs').update({ status: 'completed' }).eq('id', extractionJobId);
            }

            if (activeRole === 'Client') {
                alert("¡Solicitud registrada correctamente!");
            }
            navigate('/kanban');
        } catch (e: any) {
            console.error("[SUBMIT] ERROR:", e);
            alert(`Error durante el envío: ${e.message || 'Error desconocido'}`);
        } finally {
            setIsSaving(false);
        }
    };



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

            {/* PASO 2: DETALLES */}
            {step === 2 && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">2. Datos del Vehículo y Reparación</h2>
                            <p className="text-sm text-slate-500">Completa los datos o usa el importador de IA para acelerar el proceso.</p>
                        </div>
                        <button onClick={() => setStep(1)} className="text-slate-400 hover:text-brand-600 font-bold text-sm">Volver a Cliente</button>
                    </div>

                    {/* AI EXTRACTION HUB - Module A */}
                    <div className={`p-6 rounded-2xl border-2 border-dashed transition-all ${extractionStatus === 'processing' ? 'border-brand-500 bg-brand-50 animate-pulse' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${extractionStatus === 'completed' ? 'bg-green-600 text-white' : 'bg-brand-600 text-white'}`}>
                                {extractionStatus === 'processing' ? (
                                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : extractionStatus === 'completed' ? (
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                )}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-lg font-black text-slate-800">Importador Inteligente (IA)</h3>
                                <p className="text-sm text-slate-500 font-medium">Sube la peritación PDF para rellenar automáticamente matrícula, VIN y siniestro.</p>
                                {extractionStatus === 'failed' && <p className="text-xs text-red-500 font-bold mt-1">Error: {extractionMessage}</p>}
                                {extractionStatus === 'completed' && <p className="text-xs text-green-600 font-bold mt-1">{extractionMessage}</p>}
                            </div>
                            <div className="shrink-0 w-full md:w-auto">
                                <label className={`block px-8 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all text-center ${extractionStatus === 'processing' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200'}`}>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        disabled={extractionStatus === 'processing'}
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                runSmartAnalysis(e.target.files[0]);
                                                processFiles(e.target.files);
                                            }
                                        }}
                                    />
                                    {extractionStatus === 'processing' ? 'Analizando...' : 'Seleccionar PDF'}
                                </label>
                            </div>
                        </div>
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Año</label>
                                    <input type="number" className="w-full p-2 border rounded-lg" value={vehicleData.year} onChange={e => setVehicleData({ ...vehicleData, year: parseInt(e.target.value) || new Date().getFullYear() })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Color</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={vehicleData.color} onChange={e => setVehicleData({ ...vehicleData, color: e.target.value })} />
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

                        {/* SECCIÓN SINIESTRO - Module C */}
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Siniestro / Seguro</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Aseguradora</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-slate-50"
                                        value={claimData.insurer_id}
                                        onChange={e => setClaimData({ ...claimData, insurer_id: e.target.value })}
                                    >
                                        <option value="">Seleccionar Aseguradora</option>
                                        {insurers.map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nº Siniestro</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={claimData.claim_number} onChange={e => setClaimData({ ...claimData, claim_number: e.target.value })} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tipo de Incidente</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={claimData.incident_type}
                                        onChange={e => setClaimData({ ...claimData, incident_type: e.target.value })}
                                    >
                                        <option value="collision">Colisión</option>
                                        <option value="scratch">Rozadura/Rascazo</option>
                                        <option value="hail">Granizo</option>
                                        <option value="vandalism">Vandalismo</option>
                                        <option value="parking">Aparcamiento</option>
                                        <option value="animal">Atropello animal</option>
                                        <option value="other">Otro</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Fecha de Siniestro</label>
                                    <input type="date" className="w-full p-2 border rounded-lg" value={claimData.incident_date} onChange={e => setClaimData({ ...claimData, incident_date: e.target.value })} />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* PRESUPUESTO Y RECAMBIOS - Module A (Manual/AI) */}
                    <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                Presupuesto y Recambios
                            </h3>
                            {(extractedBilling.total_estimate > 0 || extractedParts.length > 0) && (
                                <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-tight">Datos Listos</span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Horas Chapa</label>
                                <input type="number" step="0.5" className="w-full bg-transparent font-black text-slate-800 text-lg outline-none" value={extractedBilling.bodywork_hours} onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExtractedBilling({ ...extractedBilling, bodywork_hours: val, total_estimate: (val * extractedBilling.bodywork_rate) + (extractedBilling.paint_hours * extractedBilling.paint_rate) + extractedBilling.materials_amount + extractedParts.reduce((acc, p) => acc + (p.unit_price * p.quantity), 0) });
                                }} />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Horas Pintura</label>
                                <input type="number" step="0.5" className="w-full bg-transparent font-black text-slate-800 text-lg outline-none" value={extractedBilling.paint_hours} onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExtractedBilling({ ...extractedBilling, paint_hours: val, total_estimate: (extractedBilling.bodywork_hours * extractedBilling.bodywork_rate) + (val * extractedBilling.paint_rate) + extractedBilling.materials_amount + extractedParts.reduce((acc, p) => acc + (p.unit_price * p.quantity), 0) });
                                }} />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Material Pintura (€)</label>
                                <input type="number" className="w-full bg-transparent font-black text-slate-800 text-lg outline-none" value={extractedBilling.materials_amount} onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExtractedBilling({ ...extractedBilling, materials_amount: val, total_estimate: (extractedBilling.bodywork_hours * extractedBilling.bodywork_rate) + (extractedBilling.paint_hours * extractedBilling.paint_rate) + val + extractedParts.reduce((acc, p) => acc + (p.unit_price * p.quantity), 0) });
                                }} />
                            </div>
                            <div className="p-4 bg-brand-600 rounded-2xl border border-brand-500 text-white shadow-lg">
                                <label className="block text-[10px] font-black text-white/60 uppercase mb-1">Total Estimado</label>
                                <p className="text-xl font-black">€{extractedBilling.total_estimate.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listado de Recambios</h4>
                                <button
                                    onClick={() => setExtractedParts([...extractedParts, { description: '', part_number: '', quantity: 1, unit_price: 0 }])}
                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Añadir Recambio
                                </button>
                            </div>

                            {extractedParts.length === 0 ? (
                                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-xs text-slate-400 font-medium italic">No se han añadido recambios todavía.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {extractedParts.map((part, idx) => (
                                        <div key={idx} className="flex gap-3 p-3 bg-white rounded-xl border border-slate-200 items-center">
                                            <input type="text" placeholder="Descripción" className="flex-1 text-xs font-bold border-none bg-transparent outline-none" value={part.description} onChange={e => {
                                                const newParts = [...extractedParts];
                                                newParts[idx].description = e.target.value;
                                                setExtractedParts(newParts);
                                            }} />
                                            <input type="text" placeholder="Ref." className="w-24 text-[10px] font-mono border-none bg-transparent outline-none uppercase" value={part.part_number} onChange={e => {
                                                const newParts = [...extractedParts];
                                                newParts[idx].part_number = e.target.value;
                                                setExtractedParts(newParts);
                                            }} />
                                            <input type="number" placeholder="Cant." className="w-12 text-xs font-bold text-center border-none bg-transparent outline-none" value={part.quantity} onChange={e => {
                                                const newParts = [...extractedParts];
                                                newParts[idx].quantity = parseFloat(e.target.value) || 0;
                                                setExtractedParts(newParts);
                                                // Update total estimate
                                                const partsTotal = newParts.reduce((acc, p) => acc + (p.unit_price * p.quantity), 0);
                                                setExtractedBilling({ ...extractedBilling, total_estimate: (extractedBilling.bodywork_hours * extractedBilling.bodywork_rate) + (extractedBilling.paint_hours * extractedBilling.paint_rate) + extractedBilling.materials_amount + partsTotal });
                                            }} />
                                            <input type="number" placeholder="Precio" className="w-20 text-xs font-bold text-right border-none bg-transparent outline-none" value={part.unit_price} onChange={e => {
                                                const newParts = [...extractedParts];
                                                newParts[idx].unit_price = parseFloat(e.target.value) || 0;
                                                setExtractedParts(newParts);
                                                // Update total estimate
                                                const partsTotal = newParts.reduce((acc, p) => acc + (p.unit_price * p.quantity), 0);
                                                setExtractedBilling({ ...extractedBilling, total_estimate: (extractedBilling.bodywork_hours * extractedBilling.bodywork_rate) + (extractedBilling.paint_hours * extractedBilling.paint_rate) + extractedBilling.materials_amount + partsTotal });
                                            }} />
                                            <button onClick={() => {
                                                const newParts = extractedParts.filter((_, i) => i !== idx);
                                                setExtractedParts(newParts);
                                                const partsTotal = newParts.reduce((acc, p) => acc + (p.unit_price * p.quantity), 0);
                                                setExtractedBilling({ ...extractedBilling, total_estimate: (extractedBilling.bodywork_hours * extractedBilling.bodywork_rate) + (extractedBilling.paint_hours * extractedBilling.paint_rate) + extractedBilling.materials_amount + partsTotal });
                                            }} className="text-slate-300 hover:text-red-500">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl space-y-6">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-2">Orden de Trabajo</h3>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observaciones / Daños</label>
                            <textarea className="w-full p-4 bg-white/5 border border-white/10 rounded-xl h-24 text-sm outline-none focus:border-emerald-500 transition-colors" value={repairDetails.description} onChange={e => setRepairDetails({ ...repairDetails, description: e.target.value })} />
                        </div>
                        <button onClick={() => setStep(3)} disabled={!vehicleData.plate} className="w-full bg-brand-500 hover:bg-brand-400 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 disabled:opacity-30 transition-all mt-4">
                            Continuar a Documentos
                        </button>
                    </div>
                </div>
            )}

            {/* PASO 3: ARCHIVOS/DOCUMENTACIÓN */}
            {step === 3 && (
                <div className="animate-fade-in space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">3. Documentación y Evidencias</h2>
                        <button onClick={() => setStep(2)} className="text-slate-400 hover:text-brand-600 text-sm font-bold">Volver a Detalles</button>
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
                                    <button onClick={handleSubmit} disabled={isSaving || stagedFiles.length === 0} className="w-full bg-brand-600 hover:bg-brand-700 text-white px-10 py-3 rounded-xl font-black shadow-lg disabled:opacity-30 transition-all">
                                        {isSaving ? 'Guardando...' : 'CREAR ORDEN DE REPARACIÓN'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REVISIÓN IA (Rule 2) */}
            {showReviewUI && extractedBilling && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Revisión de Peritación IA</h2>
                                <p className="text-sm text-slate-500 font-medium">Verifique los datos extraídos antes de aplicarlos a la orden.</p>
                            </div>
                            <button onClick={() => setShowReviewUI(false)} className="bg-white text-slate-400 hover:text-slate-600 w-12 h-12 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center transition-all">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Billing Section */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    Totales y Mano de Obra
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className={`p-4 rounded-2xl border transition-colors ${confidenceScores?.labor < 0.80 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Horas Carrocería</label>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent font-black text-slate-800 text-lg outline-none"
                                            value={extractedBilling.bodywork_hours}
                                            onChange={e => setExtractedBilling({ ...extractedBilling, bodywork_hours: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className={`p-4 rounded-2xl border transition-colors ${confidenceScores?.labor < 0.80 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Horas Pintura</label>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent font-black text-slate-800 text-lg outline-none"
                                            value={extractedBilling.paint_hours}
                                            onChange={e => setExtractedBilling({ ...extractedBilling, paint_hours: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className={`p-4 rounded-2xl border transition-colors ${confidenceScores?.materials < 0.80 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Material Pintura</label>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent font-black text-slate-800 text-lg outline-none"
                                            value={extractedBilling.materials_amount}
                                            onChange={e => setExtractedBilling({ ...extractedBilling, materials_amount: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="p-4 rounded-2xl border bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-100">
                                        <label className="block text-[10px] font-black text-white/60 uppercase mb-1">Total Estimado</label>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent font-black text-white text-lg outline-none"
                                            value={extractedBilling.total_estimate}
                                            onChange={e => setExtractedBilling({ ...extractedBilling, total_estimate: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Parts Section */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    Recambios y Piezas
                                </h3>
                                <div className="space-y-2">
                                    {extractedParts.map((part: any, idx: number) => (
                                        <div key={idx} className={`flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-colors ${part.confidence < 0.80 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-200'}`}>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descripción</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent font-bold text-slate-800 text-sm outline-none"
                                                    value={part.description}
                                                    onChange={e => {
                                                        const newParts = [...extractedParts];
                                                        newParts[idx].description = e.target.value;
                                                        setExtractedParts(newParts);
                                                    }}
                                                />
                                            </div>
                                            <div className="w-full md:w-48">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Referencia</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent font-mono text-slate-600 text-xs outline-none uppercase"
                                                    value={part.part_number}
                                                    onChange={e => {
                                                        const newParts = [...extractedParts];
                                                        newParts[idx].part_number = e.target.value;
                                                        setExtractedParts(newParts);
                                                    }}
                                                />
                                            </div>
                                            <div className="w-full md:w-24">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Cant.</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent font-bold text-slate-800 text-sm outline-none"
                                                    value={part.quantity}
                                                    onChange={e => {
                                                        const newParts = [...extractedParts];
                                                        newParts[idx].quantity = parseFloat(e.target.value) || 0;
                                                        setExtractedParts(newParts);
                                                    }}
                                                />
                                            </div>
                                            <div className="w-full md:w-32">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">PVP</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent font-bold text-slate-800 text-sm outline-none"
                                                    value={part.unit_price}
                                                    onChange={e => {
                                                        const newParts = [...extractedParts];
                                                        newParts[idx].unit_price = parseFloat(e.target.value) || 0;
                                                        setExtractedParts(newParts);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                            <button onClick={() => setShowReviewUI(false)} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-all">Cancelar</button>
                            <button
                                onClick={() => {
                                    setShowReviewUI(false);
                                    setExtractionStatus('completed');
                                    setExtractionMessage('Datos revisados y listos para guardar.');
                                }}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-12 py-4 rounded-2xl font-black shadow-xl shadow-brand-100 transition-all transform active:scale-95 flex items-center gap-3"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                CONFIRMAR Y APLICAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewAppraisal;
