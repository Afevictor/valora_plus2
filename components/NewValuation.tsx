
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ValuationRequest, WorkOrder, Client, HourCostCalculation } from '../types';
import { saveValuationToSupabase, getClientsFromSupabase, getCostCalculations, uploadChatAttachment, saveClientToSupabase, getCompanyProfileFromSupabase, getCompanyProfileById, logClientActivity, supabase, updateValuationStage } from '../services/supabaseClient';
import { getBitrixUsers, BitrixUser, pushValuationToBitrix } from '../services/bitrixService';
import ClientForm from './ClientForm';

const CLAIM_TYPES = ['Colisión', 'Robo', 'Incendio', 'Lunas', 'Fenómeno Atmosférico', 'Vandalismo', 'Daños Propios'];

const INSURANCE_COMPANIES = [
    'Mapfre', 'Mutua Madrileña', 'Allianz', 'AXA', 'Generali', 'Liberty Seguros',
    'Línea Directa', 'Reale', 'Zurich', 'Catalana Occidente', 'Pelayo', 'MMT Seguros',
    'Helvetia', 'RACC', 'Santa Lucía', 'Caser', 'Plus Ultra', 'Nationale Suisse',
    'Aser', 'MGS', 'Verti', 'Qualitas Auto', 'Genesis', 'Balumba', 'Fiatc', 'DKV'
].sort();

const NewValuation: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Form State
    const [formData, setFormData] = useState<Partial<ValuationRequest>>({
        id: crypto.randomUUID(), // Valid UUID for DB
        ticketNumber: `VAL-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`, // Readable Ticket ID
        workOrderId: '',
        assignedExpertId: '',
        costReference: '', // Required field
        requestDate: new Date().toLocaleDateString(),
        status: 'New',
        claimsStage: 'draft',
        workshop: {
            name: '', // Will be filled from DB
            cif: '',
            contact: '',
            province: ''
        },
        vehicle: { brand: '', model: '', plate: '', km: 0 },
        insuredName: '',
        claimDate: '',
        claimType: 'Colisión',
        insuranceCompany: '',
        franchise: { applies: false, amount: 0 },
        opposingVehicle: { exists: false, plate: '', model: '' },
        photos: [],
        documents: [],
        notes: '',
        declarationAccepted: false,
        chatHistory: []
    });

    // Dynamic Data States
    const [bitrixUsers, setBitrixUsers] = useState<BitrixUser[]>([]);
    const [isBitrixConnected, setIsBitrixConnected] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [insuranceOptions, setInsuranceOptions] = useState<Client[]>([]);
    const [costOptions, setCostOptions] = useState<HourCostCalculation[]>([]);
    const [refreshingUsers, setRefreshingUsers] = useState(false);
    const [showClientModal, setShowClientModal] = useState(false);

    const [isLoadingCosts, setIsLoadingCosts] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [workshopId, setWorkshopId] = useState<string | null>(null);

    // Load Data on Mount
    useEffect(() => {
        const loadInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const role = sessionStorage.getItem('vp_active_role');
            if (user) setCurrentUserId(user.id);

            if (role === 'Client' && user) {
                // Pre-fill workshop details from clients table for authentication display
                const allClients = await getClientsFromSupabase();
                const me = allClients.find(c => c.id === user.id);
                if (me) {
                    setFormData(prev => ({
                        ...prev,
                        insuredName: me.name,
                        workshop: { // Workshop in this context means 'Solicitant'
                            name: me.name,
                            cif: me.taxId || '',
                            contact: me.email || '',
                            province: me.city || ''
                        }
                    }));
                    fetchCosts(me.id); // Auto fetch costs

                    // If client has a workshop_id, fetch that workshop's settings (Default Expert)
                    if (me.workshop_id) {
                        setWorkshopId(me.workshop_id);
                        getCompanyProfileById(me.workshop_id).then(profile => {
                            if (profile?.defaultExpertId) {
                                setFormData(prev => ({ ...prev, assignedExpertId: profile.defaultExpertId }));
                            }
                        });
                        handleRefreshBitrixUsers(me.workshop_id);
                    } else {
                        handleRefreshBitrixUsers();
                    }
                }
            } else {
                // Admin context
                if (user) setWorkshopId(user.id);
                getCompanyProfileFromSupabase().then(profile => {
                    if (profile) {
                        setFormData(prev => ({
                            ...prev,
                            workshop: {
                                name: profile.companyName,
                                cif: profile.cif,
                                contact: `${profile.email} - ${profile.phone}`,
                                province: profile.province
                            }
                        }));
                    }
                });
                handleRefreshBitrixUsers();
            }

            // 3. Fetch Clients independently (for Admin dropdown)
            if (role !== 'Client') {
                getClientsFromSupabase().then(allClients => {
                    if (allClients) {
                        setClients(allClients);
                        const insurers = allClients.filter(c => c.clientType === 'Insurance' || c.clientType === 'Company');
                        setInsuranceOptions(insurers);
                    }
                });
            }

            // 4. Fetch Cost Calculations
            if (role !== 'Client') fetchCosts();
        };

        loadInitialData();
    }, []);

    const fetchCosts = async (clientId?: string) => {
        setIsLoadingCosts(true);
        try {
            console.log(`NewValuation: Fetching all available cost calculations...`);
            const costs = await getCostCalculations(); // Broad fetch

            if (costs && costs.length > 0) {
                console.log(`NewValuation: Found ${costs.length} records in total.`);
                setCostOptions(costs);

                // If a clientId is provided, prioritize it
                if (clientId) {
                    // Filter for this workshop/client
                    const clientRecords = costs.filter(c => c.workshop_id === clientId);
                    if (clientRecords.length > 0) {
                        // Sort by created_at desc (assuming standard ordering or logic) - actually just take the first if getCostCalculations orders it
                        // The existing getCostCalculations orders by created_at desc already
                        const latest = clientRecords[0];
                        setFormData(prev => ({ ...prev, costReference: latest.periodo }));
                    }
                }
            } else {
                setCostOptions([]);
            }
        } catch (err) {
            console.error("NewValuation: Error loading costs:", err);
            setCostOptions([]);
        } finally {
            setIsLoadingCosts(false);
            setStatusMessage('');
        }
    };

    const handleRefreshBitrixUsers = async (wId?: string) => {
        setRefreshingUsers(true);
        try {
            const bUsers = await getBitrixUsers(true, wId);
            if (bUsers.length > 0) {
                setBitrixUsers(bUsers);
                setIsBitrixConnected(true);

                // --- AUTO-SELECT DEFAULT EXPERT ---
                const { getBitrixSettingsFromSupabase } = await import('../services/supabaseClient');
                const settings = await getBitrixSettingsFromSupabase(wId);

                if (settings?.default_expert_id) {
                    const expertExists = bUsers.some((u: any) => String(u.ID) === String(settings.default_expert_id));
                    if (expertExists) {
                        console.log("NewValuation: Auto-selecting default expert:", settings.default_expert_id);
                        setFormData(prev => ({ ...prev, assignedExpertId: settings.default_expert_id }));
                    }
                } else if (bUsers.length === 1) {
                    // If only one user, auto-select it anyway
                    setFormData(prev => ({ ...prev, assignedExpertId: bUsers[0].ID }));
                }
            } else {
                setIsBitrixConnected(false);
                setBitrixUsers([]);
            }
        } catch (e) {
            console.error("Error refreshing Bitrix users:", e);
            setIsBitrixConnected(false);
        }
        setRefreshingUsers(false);
    };

    // Handle Work Order Linking on Mount
    useEffect(() => {
        // Check if we have an OT ID passed via state or query param
        const stateOtId = location.state?.otId;

        if (stateOtId) {
            // Find the OT in local storage (or fetch from DB if needed, but local usually has it cached)
            const savedJobs = localStorage.getItem('vp_kanban_board');
            if (savedJobs) {
                const jobs: WorkOrder[] = JSON.parse(savedJobs);
                const linkedJob = jobs.find(j => j.id === stateOtId);

                if (linkedJob) {
                    console.log("Linking to OT:", linkedJob);
                    setFormData(prev => ({
                        ...prev,
                        workOrderId: linkedJob.id, // STRICT ASSOCIATION
                        vehicle: {
                            brand: linkedJob.vehicle?.split(' ')[0] || '',
                            model: linkedJob.vehicle?.split(' ').slice(1).join(' ') || '',
                            plate: linkedJob.plate || '',
                            km: linkedJob.currentKm || 0
                        },
                        insuredName: linkedJob.insuredName || `Cliente OT ${linkedJob.clientId}`,
                        insuranceCompany: linkedJob.insurance?.company || '',
                        claimDate: linkedJob.entryDate, // Default to entry date if unknown
                    }));

                    // Auto-fetch costs if we have a client ID from the OT
                    if (linkedJob.clientId) {
                        fetchCosts(linkedJob.clientId);
                    }
                }
            }
        }
    }, [location.state]);

    // Files State
    const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
    const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
    const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);

    // Auto-refresh costs when entering step 2
    useEffect(() => {
        if (step === 2 && costOptions.length === 0) {
            fetchCosts();
        }
    }, [step]);

    const handleInputChange = (section: string, field: string, value: any) => {
        if (section === 'root') {
            setFormData(prev => ({ ...prev, [field]: value }));
        } else if (section === 'vehicle') {
            setFormData(prev => ({ ...prev, vehicle: { ...prev.vehicle!, [field]: value } }));
        } else if (section === 'franchise') {
            setFormData(prev => ({ ...prev, franchise: { ...prev.franchise!, [field]: value } }));
        } else if (section === 'opposingVehicle') {
            setFormData(prev => ({ ...prev, opposingVehicle: { ...prev.opposingVehicle!, [field]: value } }));
        }
    };

    const handleClientSelection = (clientId: string) => {
        const selected = clients.find(c => c.id === clientId);
        if (selected) {
            setFormData(prev => ({
                ...prev,
                insuredName: selected.name,
            }));
            // Refresh cost calculations for this specific client
            fetchCosts(selected.id);
        }
    };

    const handleCreateClient = async (newClient: Client) => {
        await saveClientToSupabase(newClient);
        setClients(prev => [...prev, newClient]);

        // If it's an insurance company, add to options
        if (['Insurance', 'Company'].includes(newClient.clientType)) {
            setInsuranceOptions(prev => [...prev, newClient]);
        }

        // Auto-select
        setFormData(prev => ({
            ...prev,
            insuredName: newClient.name
        }));
        setShowClientModal(false);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: File[] = Array.from(e.target.files);
            setUploadedPhotos(prev => [...prev, ...newFiles]);

            // Generate Mock URLs immediately for preview
            const newUrls = newFiles.map(f => URL.createObjectURL(f));
            setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...newUrls] }));
        }
    };

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadedVideo(file);
            setFormData(prev => ({ ...prev, videoUrl: URL.createObjectURL(file) }));
        }
    };

    const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: File[] = Array.from(e.target.files);
            setUploadedDocs(prev => [...prev, ...newFiles]);
        }
    };

    const removeDoc = (index: number) => {
        setUploadedDocs(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        // VALIDATION
        // REMOVED: Mandatory expert selection. We now handle it via auto-select or service-side fallback.
        /*
        if (isBitrixConnected && bitrixUsers.length > 0 && !formData.assignedExpertId) {
            alert("Por favor, seleccione un usuario de Bitrix24 para asignar como perito.");
            return;
        }
        */
        if (!formData.insuredName) {
            alert("Por favor, especifique el cliente (Nombre del Asegurado).");
            return;
        }
        if (!formData.costReference && !currentUserId) {
            alert("Debe seleccionar una referencia de cálculo de costes.");
            return;
        }
        if (!formData.costReference && currentUserId) {
            alert("No se encontró una Calculadora de Costes activa. Por favor, guarde una configuración en el menú 'Calculadora'.");
            return;
        }
        // Validate Opposing Vehicle
        if (formData.opposingVehicle?.exists && !formData.opposingVehicle.plate) {
            alert("Es obligatorio indicar la Matrícula del Vehículo Contrario.");
            setStep(3); // Go back to step 3
            return;
        }

        setLoading(true);

        try {
            // --- STEP 1: UPLOAD FILES TO CLOUD ---
            setStatusMessage('Subiendo archivos a la nube...');
            const fileLinks: { url: string, type: 'image' | 'video' | 'doc' }[] = [];
            const photoUrls: string[] = [];
            const docUrls: string[] = [];

            // Upload Photos
            for (const file of uploadedPhotos) {
                const url = await uploadChatAttachment(file);
                if (url) {
                    fileLinks.push({ url, type: 'image' });
                    photoUrls.push(url);
                }
            }

            // Upload Video
            let finalVideoUrl = '';
            if (uploadedVideo) {
                const url = await uploadChatAttachment(uploadedVideo);
                if (url) {
                    fileLinks.push({ url, type: 'video' });
                    finalVideoUrl = url;
                }
            }

            // Upload Documents (PDFs, etc)
            for (const file of uploadedDocs) {
                const url = await uploadChatAttachment(file);
                if (url) {
                    fileLinks.push({ url, type: 'doc' });
                    docUrls.push(url);
                }
            }

            // --- STEP 2: PREPARE FINAL DATA ---
            const finalData = {
                ...formData,
                claimsStage: formData.claimsStage || 'draft',
                photos: photoUrls, // Save real cloud URLs
                documents: docUrls, // Save real cloud URLs
                videoUrl: finalVideoUrl || formData.videoUrl
            } as ValuationRequest;

            // --- STEP 3: SAVE TO VALORA PLUS DB ---
            setStatusMessage('Guardando en la base de datos de Valora Plus...');

            // Supabase
            const result = await saveValuationToSupabase(finalData, workshopId || undefined);
            if (!result) {
                console.warn("Database save failed, but proceeding to Bitrix...");
                alert("⚠️ Error: No se pudo guardar en la base de datos de Valora Plus. Compruebe su conexión o permisos de base de datos.");
            }

            // Update linked WO
            if (formData.workOrderId) {
                const savedJobs = localStorage.getItem('vp_kanban_board');
                if (savedJobs) {
                    const jobs: WorkOrder[] = JSON.parse(savedJobs);
                    const updatedJobs = jobs.map(j =>
                        j.id === formData.workOrderId
                            ? { ...j, hasExternalAppraisal: true, valuationId: formData.id }
                            : j
                    );
                    localStorage.setItem('vp_kanban_board', JSON.stringify(updatedJobs));
                }
            }

            // --- STEP 4: PUSH TO BITRIX CRM ---
            setStatusMessage('Enviando datos al CRM de Bitrix24...');
            const selectedCost = costOptions.find(c => c.periodo === formData.costReference);

            // Fallback: If workshopId is missing, try to get it again from session
            let finalWorkshopId = workshopId;
            if (!finalWorkshopId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) finalWorkshopId = user.id;
            }

            const bitrixResult = await pushValuationToBitrix(finalData, fileLinks, selectedCost, finalWorkshopId || undefined);

            if (!bitrixResult.success) {
                console.warn("Bitrix push failed, but local data saved:", bitrixResult.error);
                alert(`Solicitud guardada en Valora Plus, pero falló el envío al CRM de Bitrix24.\nError: ${bitrixResult.error}`);
            } else {
                console.log("✅ Bitrix Push SUCCESS. ID:", bitrixResult.id);
                // Move to 'sent_expert' stage if successfully pushed to CRM
                await updateValuationStage(finalData.id, 'sent_expert');
            }

            // --- STEP 5: LOG TO CENTRAL ACTIVITY FEED (HIGH RELIABILITY) ---
            console.log("[VALUATION SUBMIT] Logging to global activity feed...");
            const activityFiles = fileLinks.map(fl => ({
                url: fl.url,
                name: fl.url.split('/').pop() || 'Asset',
                category: fl.type === 'image' ? 'Evidence' : 'Document',
                type: fl.type === 'image' ? 'image' : 'pdf'
            }));

            // Find client ID by name fallback if not explicitly linked in formData
            const matchedClient = clients.find(c => c.name === formData.insuredName);

            await logClientActivity({
                client_id: matchedClient?.id,
                plate: formData.vehicle?.plate || '',
                expediente_id: formData.id || '',
                activity_type: 'valuation_request',
                summary: formData.notes || `New valuation request for ${formData.vehicle?.brand} ${formData.vehicle?.model}`,
                file_assets: activityFiles,
                raw_data: {
                    valuation: finalData,
                    ticketNumber: formData.ticketNumber
                }
            });

            setStep(5); // Success Screen
        } catch (error) {
            console.error("Submission failed", error);
            alert("Error crítico durante el envío. Revise la consola.");
        } finally {
            setLoading(false);
            setStatusMessage('');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">

            {/* STEP 5: SUCCESS */}
            {step === 5 ? (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12 text-center animate-fade-in-up">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-4">¡Gracias!</h2>
                    <p className="text-xl text-slate-600 mb-10 max-w-lg mx-auto font-medium">
                        Recibirás el informe por correo electrónico
                    </p>
                    <div className="flex justify-center">
                        <button
                            onClick={() => navigate('/valuations')}
                            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-black shadow-xl transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-widest text-sm"
                        >
                            Volver a Solicitudes
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Header & Steps */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            {formData.workOrderId && (
                                <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold border border-brand-200 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    Vinculado a OT: {formData.workOrderId}
                                </span>
                            )}
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{formData.ticketNumber}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Nueva Solicitud de Peritación</h1>
                        <p className="text-slate-500">Complete el formulario para solicitar una valoración independiente.</p>
                    </div>

                    <div className="flex justify-between items-center mb-8 px-2">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className="flex flex-col items-center flex-1 relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors ${step >= s ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {s}
                                </div>
                                <span className="text-xs mt-2 font-medium text-slate-500 uppercase">
                                    {s === 1 && 'Taller'}
                                    {s === 2 && 'Siniestro'}
                                    {s === 3 && 'Contrario'}
                                    {s === 4 && 'Docs/Info'}
                                </span>
                                {s < 4 && (
                                    <div className={`absolute top-4 left-[50%] w-full h-0.5 ${step > s ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[500px] flex flex-col justify-between">

                        {/* STEP 1: WORKSHOP DATA */}
                        {step === 1 && (
                            <div className="animate-fade-in">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">1. Datos del Taller (Solicitante)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Razón Social</label>
                                        <input type="text" value={formData.workshop?.name} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CIF/NIF</label>
                                        <input type="text" value={formData.workshop?.cif} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contacto Principal</label>
                                        <input type="text" value={formData.workshop?.contact} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Provincia</label>
                                        <input type="text" value={formData.workshop?.province} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                    </div>
                                </div>
                                <p className="mt-4 text-xs text-slate-400 italic text-center">* Estos datos se obtienen automáticamente de su Perfil de Empresa en Valora Plus.</p>
                            </div>
                        )}

                        {/* STEP 2: CLAIM DATA */}
                        {step === 2 && (
                            <div className="animate-fade-in">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">2. Datos del Siniestro y Vehículo</h3>

                                {/* CLIENT SELECTION DROPDOWN - Only for Admins */}
                                {(!currentUserId) && (
                                    <div className="mb-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                Seleccionar Cliente (Asegurado) <span className="text-red-500">*</span>
                                            </label>
                                            <button
                                                onClick={() => setShowClientModal(true)}
                                                className="text-xs bg-brand-100 text-brand-700 px-3 py-1.5 rounded-full font-bold hover:bg-brand-200 transition-colors flex items-center gap-1"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                Nuevo Cliente
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <select
                                                className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none"
                                                onChange={(e) => handleClientSelection(e.target.value)}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>-- Elegir de la Lista de Clientes --</option>
                                                {clients.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} ({c.taxId})</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-3.5 pointer-events-none text-slate-500">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 ml-1">Al seleccionar un cliente se rellenará automáticamente el Nombre del Asegurado.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Asegurado (Cliente) <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            className={`w-full p-2 border border-slate-300 rounded bg-white ${currentUserId ? 'bg-slate-100 text-slate-600' : ''}`}
                                            placeholder="Nombre completo o Empresa"
                                            value={formData.insuredName}
                                            onChange={(e) => handleInputChange('root', 'insuredName', e.target.value)}
                                            readOnly={!!currentUserId}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha del Siniestro</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border border-slate-300 rounded"
                                            value={formData.claimDate}
                                            onChange={(e) => handleInputChange('root', 'claimDate', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Siniestro</label>
                                        <select
                                            className="w-full p-2 border border-slate-300 rounded"
                                            value={formData.claimType}
                                            onChange={(e) => handleInputChange('root', 'claimType', e.target.value)}
                                        >
                                            {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Compañía de Seguros</label>
                                        <input
                                            list="insurance-options"
                                            type="text"
                                            className="w-full p-2 border border-slate-300 rounded bg-white"
                                            placeholder="Seleccionar o escribir..."
                                            value={formData.insuranceCompany}
                                            onChange={(e) => handleInputChange('root', 'insuranceCompany', e.target.value)}
                                        />
                                        <datalist id="insurance-options">
                                            {INSURANCE_COMPANIES.map(company => (
                                                <option key={company} value={company} />
                                            ))}
                                            {insuranceOptions
                                                .filter(opt => !INSURANCE_COMPANIES.includes(opt.name))
                                                .map(c => <option key={c.id} value={c.name} />)
                                            }
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Franquicia</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="p-2 border border-slate-300 rounded bg-white text-sm"
                                                value={formData.franchise?.applies ? 'yes' : 'no'}
                                                onChange={(e) => handleInputChange('franchise', 'applies', e.target.value === 'yes')}
                                            >
                                                <option value="no">Sin Franquicia</option>
                                                <option value="yes">Con Franquicia</option>
                                            </select>
                                            {formData.franchise?.applies && (
                                                <input
                                                    type="number"
                                                    className="flex-1 p-2 border border-slate-300 rounded text-sm"
                                                    placeholder="Importe €"
                                                    value={formData.franchise.amount}
                                                    onChange={(e) => handleInputChange('franchise', 'amount', parseFloat(e.target.value) || 0)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* COST CALCULATION REFERENCE FIELD */}
                                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-yellow-800">Referencia de Cálculo de Costes <span className="text-red-500">*</span></label>
                                        <button
                                            onClick={() => fetchCosts()}
                                            disabled={isLoadingCosts}
                                            className="text-xs text-yellow-600 hover:text-yellow-800 flex items-center gap-1 font-bold bg-white px-2 py-1 rounded border border-yellow-200 shadow-sm"
                                        >
                                            <svg className={`w-3 h-3 ${isLoadingCosts ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Sincronizar
                                        </button>
                                    </div>
                                    <select
                                        className={`w-full p-2 border rounded text-sm outline-none transition-all ${costOptions.length > 0 ? 'border-yellow-300 focus:ring-2 focus:ring-yellow-500' : 'border-red-300 bg-red-50'}`}
                                        value={formData.costReference || ''}
                                        onChange={(e) => handleInputChange('root', 'costReference', e.target.value)}
                                    >
                                        <option value="">-- Seleccionar un Código de Cálculo --</option>
                                        {costOptions.map((opt: HourCostCalculation) => {
                                            const owner = clients.find(c => c.id === opt.workshop_id);
                                            return (
                                                <option key={opt.id} value={opt.periodo}>
                                                    {owner ? owner.name : 'Workshop Principal'} - Tarifa {opt.periodo} ({(opt.resultado_calculo?.hourlyCost || 0).toFixed(2)}€/h)
                                                </option>
                                            );
                                        })}
                                        {costOptions.length === 0 && !isLoadingCosts && (
                                            <option disabled className="text-red-600 font-bold">
                                                ⚠️ No se encontraron cálculos para este cliente
                                            </option>
                                        )}
                                        {isLoadingCosts && (
                                            <option disabled>⏳ Consultando base de datos...</option>
                                        )}
                                    </select>
                                    <p className="text-xs text-yellow-700 mt-1 mb-4">
                                        {costOptions.length > 0
                                            ? 'Cálculos recuperados correctamente.'
                                            : 'El cliente debe haber completado y guardado su calculadora de costes.'}
                                    </p>

                                    {/* Visible Cost Summary Block */}
                                    {formData.costReference && (
                                        <div className="bg-white border border-yellow-300 rounded-lg p-3 flex justify-between items-center shadow-sm animate-fade-in">
                                            {(() => {
                                                const selected = costOptions.find(c => c.periodo === formData.costReference);
                                                if (!selected) return null;
                                                const cost = selected.resultado_calculo?.hourlyCost || 0;
                                                const margin = selected.payload_input?.margin || 0;
                                                const pvp = cost * (1 + margin / 100);
                                                return (
                                                    <>
                                                        <div className="flex gap-4">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase">Coste Interno</p>
                                                                <p className="text-sm font-bold text-slate-700">{cost.toFixed(2)}€/h</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase">Margen</p>
                                                                <p className="text-sm font-bold text-emerald-600">{margin}%</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-emerald-600 uppercase">Precio Sugerido (PVP)</p>
                                                            <p className="text-lg font-black text-emerald-600">{pvp.toFixed(2)}€/h</p>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                <h4 className="font-bold text-slate-700 mb-3">Datos del Vehículo</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Matrícula</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border border-slate-300 rounded text-sm uppercase font-mono"
                                            placeholder="1234BBB"
                                            value={formData.vehicle?.plate}
                                            onChange={(e) => handleInputChange('vehicle', 'plate', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Marca</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border border-slate-300 rounded text-sm"
                                            placeholder="Ej: Seat"
                                            value={formData.vehicle?.brand}
                                            onChange={(e) => handleInputChange('vehicle', 'brand', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Modelo</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border border-slate-300 rounded text-sm"
                                            placeholder="Ej: Ibiza"
                                            value={formData.vehicle?.model}
                                            onChange={(e) => handleInputChange('vehicle', 'model', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">VIN (Bastidor)</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border border-slate-300 rounded text-sm uppercase font-mono"
                                            placeholder="Número VIN..."
                                            value={formData.vehicle?.vin || ''}
                                            onChange={(e) => handleInputChange('vehicle', 'vin', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Kilometraje</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-slate-300 rounded text-sm"
                                            placeholder="Km actuales"
                                            value={formData.vehicle?.km}
                                            onChange={(e) => handleInputChange('vehicle', 'km', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: OPPOSING VEHICLE */}
                        {step === 3 && (
                            <div className="animate-fade-in">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">3. Vehículo Contrario</h3>

                                <div className="mb-6">
                                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={formData.opposingVehicle?.exists}
                                            onChange={(e) => handleInputChange('opposingVehicle', 'exists', e.target.checked)}
                                            className="w-5 h-5 text-brand-600"
                                        />
                                        <span className="font-bold text-slate-700">¿Hay un vehículo contrario involucrado?</span>
                                    </label>
                                </div>

                                {formData.opposingVehicle?.exists && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Matrícula del Vehículo Contrario <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-slate-300 rounded uppercase font-mono bg-white"
                                                value={formData.opposingVehicle?.plate}
                                                onChange={(e) => handleInputChange('opposingVehicle', 'plate', e.target.value)}
                                                placeholder="0000XXX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Marca/Modelo</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-slate-300 rounded"
                                                value={formData.opposingVehicle?.model}
                                                onChange={(e) => handleInputChange('opposingVehicle', 'model', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 4: FILES & DOCS & EXPERT SELECTION */}
                        {step === 4 && (
                            <div className="animate-fade-in space-y-8">
                                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">4. Documentación y Asignación de Perito</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Photos Upload */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                                            Fotos
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${uploadedPhotos.length >= 6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {uploadedPhotos.length} / 6 Mínimo
                                            </span>
                                        </h4>
                                        <label className="block w-full h-32 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-white transition-colors cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-brand-600 mb-4">
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                            <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <span className="text-sm font-medium">Añadir Fotos</span>
                                        </label>

                                        {/* Mini Grid */}
                                        <div className="grid grid-cols-4 gap-2">
                                            {uploadedPhotos.map((file, idx) => (
                                                <img key={idx} src={URL.createObjectURL(file)} className="w-full h-16 object-cover rounded border" alt={`preview ${idx}`} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Video Upload */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                                            Vídeo Explicativo
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${uploadedVideo ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                                                {uploadedVideo ? 'Adjuntado' : 'Opcional'}
                                            </span>
                                        </h4>
                                        <label className="block w-full h-32 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-white transition-colors cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-brand-600">
                                            <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                                            <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10z" /></svg>
                                            <span className="text-sm font-medium">{uploadedVideo ? uploadedVideo.name : 'Añadir Vídeo'}</span>
                                        </label>
                                    </div>

                                    {/* Documents Upload */}
                                    <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                                            Documentos e Informes PDF
                                            <span className="text-xs text-slate-400 font-normal">Opcional</span>
                                        </h4>

                                        <div className="flex flex-col gap-3">
                                            {uploadedDocs.map((file, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200 shadow-sm">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="bg-red-100 text-red-600 p-2 rounded">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700 truncate max-w-[200px] md:max-w-md">{file.name}</span>
                                                        <span className="text-xs text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                    </div>
                                                    <button onClick={() => removeDoc(idx)} className="text-red-400 hover:text-red-600 p-1">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ))}

                                            <label className="cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-4 flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-slate-500 hover:text-brand-600">
                                                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleDocUpload} />
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                <span className="font-bold text-sm">Adjuntar Documentos</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* EXPERT SELECTION - BITRIX REPLACEMENT */}
                                <div className="pt-6 border-t border-slate-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            </div>
                                            Asignar Perito (Colega de Bitrix24) <span className="text-red-500">*</span>
                                        </h4>

                                        <button
                                            onClick={() => handleRefreshBitrixUsers()}
                                            disabled={refreshingUsers}
                                            className="bg-white border border-slate-300 text-blue-600 p-2 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                                            title="Actualizar lista"
                                        >
                                            <svg className={`w-4 h-4 ${refreshingUsers ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                    </div>

                                    {(currentUserId) && formData.assignedExpertId && (
                                        <div className="mb-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-emerald-600 uppercase">Perito Asignado</p>
                                                    <p className="text-sm font-bold text-slate-800">
                                                        {bitrixUsers.find(u => u.ID === formData.assignedExpertId)?.NAME} {bitrixUsers.find(u => u.ID === formData.assignedExpertId)?.LAST_NAME || 'Cargando...'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">Automático</div>
                                        </div>
                                    )}

                                    <div className="mb-4 bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Cliente Asignado (Asegurado):</span>
                                        <span className="font-bold text-slate-800">{formData.insuredName || 'No Seleccionado'}</span>
                                    </div>

                                    {(!isBitrixConnected && !currentUserId) ? (
                                        <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                <span className="text-sm font-medium">Bitrix24 no está conectado o no se encontraron usuarios.</span>
                                            </div>
                                            <button
                                                onClick={() => navigate('/bitrix-config')}
                                                className="text-sm bg-white border border-orange-300 px-3 py-1 rounded text-orange-700 hover:bg-orange-50 font-bold"
                                            >
                                                Comprobar Configuración
                                            </button>
                                            <span className="text-xs text-orange-600 ml-4 font-bold">Modo Offline Activado</span>
                                        </div>
                                    ) : !currentUserId && (
                                        <>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <select
                                                        className="w-full p-3 border border-slate-300 rounded-lg bg-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm font-medium text-slate-700"
                                                        value={formData.assignedExpertId}
                                                        onChange={(e) => handleInputChange('root', 'assignedExpertId', e.target.value)}
                                                    >
                                                        <option value="">-- Seleccionar un Colega de Bitrix24 --</option>
                                                        {bitrixUsers.map(user => (
                                                            <option key={user.ID} value={user.ID}>
                                                                {user.NAME} {user.LAST_NAME} {user.WORK_POSITION ? `(${user.WORK_POSITION})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-4 top-3.5 pointer-events-none text-slate-500">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {formData.assignedExpertId && (
                                                <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded-lg text-sm flex items-center justify-between animate-fade-in">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                                                            BX
                                                        </div>
                                                        <div>
                                                            <p className="font-bold">Usuario de Bitrix Asignado</p>
                                                            <p className="text-xs text-blue-600">
                                                                {bitrixUsers.find(u => u.ID === formData.assignedExpertId)?.NAME} {bitrixUsers.find(u => u.ID === formData.assignedExpertId)?.LAST_NAME}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleInputChange('root', 'assignedExpertId', '')}
                                                        className="text-xs text-red-500 hover:text-red-700 font-bold uppercase"
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Controls */}
                    <div className="flex justify-between items-center mt-6">
                        {step > 1 ? (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                            >
                                Anterior
                            </button>
                        ) : (
                            <div></div> // Spacer
                        )}

                        {step < 4 ? (
                            <button
                                onClick={() => setStep(step + 1)}
                                className="bg-brand-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-brand-700 shadow-md transition-all flex items-center gap-2"
                            >
                                Siguiente Paso
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-w-[200px] justify-center"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Registrando...
                                    </>
                                ) : (
                                    'Registrar Solicitud'
                                )}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Client Modal */}
            {showClientModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-slate-800">Crear Nuevo Cliente</h2>
                            <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-8">
                            <ClientForm
                                onSubmit={handleCreateClient}
                                onCancel={() => setShowClientModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewValuation;
