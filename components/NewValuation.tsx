

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ValuationRequest, WorkOrder, Client, HourCostCalculation } from '../types';
import { saveValuationToSupabase, getClientsFromSupabase, getCostCalculations, uploadChatAttachment, saveClientToSupabase, getCompanyProfileFromSupabase } from '../services/supabaseClient';
import { getBitrixUsers, BitrixUser, pushValuationToBitrix } from '../services/bitrixService';
import ClientForm from './ClientForm';

const CLAIM_TYPES = ['Collision', 'Theft', 'Fire', 'Glass', 'Weather', 'Vandalism', 'Own Damage'];

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
      claimType: 'Collision',
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

  // Load Data on Mount
  useEffect(() => {
      const loadData = async () => {
          // 1. Fetch Company Profile for Workshop Data
          const profile = await getCompanyProfileFromSupabase();
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

          // 2. Fetch Bitrix Users (Replces local Experts) - FORCE REFRESH TRUE
          await handleRefreshBitrixUsers();

          // 3. Fetch Clients & Insurance Companies
          const allClients = await getClientsFromSupabase();
          if (allClients) {
              setClients(allClients);
              // Filter for insurance dropdown
              const insurers = allClients.filter(c => c.clientType === 'Insurance' || c.clientType === 'Company');
              setInsuranceOptions(insurers);
          }

          // 4. Fetch Cost Calculations
          const costs = await getCostCalculations();
          setCostOptions(costs || []);
      };
      loadData();
  }, []);

  const handleRefreshBitrixUsers = async () => {
      setRefreshingUsers(true);
      const bUsers = await getBitrixUsers(true); // Force Refresh
      if (bUsers.length > 0) {
          setBitrixUsers(bUsers);
          setIsBitrixConnected(true);
      } else {
          setIsBitrixConnected(false);
          setBitrixUsers([]);
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
                    insuredName: linkedJob.insuredName || `Client WO ${linkedJob.clientId}`,
                    insuranceCompany: linkedJob.insurance?.company || '',
                    claimDate: linkedJob.entryDate, // Default to entry date if unknown
                }));
            }
        }
    }
  }, [location.state]);

  // Files State
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);

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
              // Fixed: insured_name -> insuredName
              insuredName: selected.name,
              // Potentially autofill other fields if necessary
          }));
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
          // Fixed: insured_name -> insuredName
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
      if (!formData.assignedExpertId) {
          alert("Please select a Bitrix24 User to assign as the Expert.");
          return;
      }
      if (!formData.insuredName) {
          alert("Please specify the Client (Insured Name).");
          return;
      }
      if (!formData.costReference) {
          alert("You must select a Cost Calculation Reference.");
          return;
      }

      setLoading(true);
      
      try {
          // --- STEP 1: UPLOAD FILES TO CLOUD ---
          setStatusMessage('Uploading attachments to cloud...');
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
          if (uploadedVideo) {
              const url = await uploadChatAttachment(uploadedVideo);
              if (url) fileLinks.push({ url, type: 'video' });
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
              documents: docUrls // Save real cloud URLs
          } as ValuationRequest;

          // --- STEP 3: SAVE TO VALORA PLUS DB ---
          // This ensures the data appears in history regardless of Bitrix success
          setStatusMessage('Saving to Valora Plus Database...');
          
          // Local Storage (Backup)
          const existing = JSON.parse(localStorage.getItem('vp_valuations') || '[]');
          localStorage.setItem('vp_valuations', JSON.stringify([...existing, finalData]));

          // Supabase
          const result = await saveValuationToSupabase(finalData);
          
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
          setStatusMessage('Pushing data to Bitrix24 CRM...');
          
          // Fixed: reference_code -> periodo
          const selectedCost = costOptions.find(c => c.periodo === formData.costReference);

          const bitrixResult = await pushValuationToBitrix(finalData, fileLinks, selectedCost);

          if (!bitrixResult) {
              console.warn("Bitrix push failed, but local data saved.");
              // Alert user but proceed to success because the Valuation Request IS created locally
              alert("Valuation request created locally, but failed to push to Bitrix24. Please check Bitrix connection.");
          }

          setStep(5); // Success Screen
      } catch (error) {
          console.error("Submission failed", error);
          alert("Critical error during submission. Check console.");
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
               <h2 className="text-3xl font-bold text-slate-900 mb-4">Request Registered!</h2>
               <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto">
                   Your file <strong>{formData.ticketNumber}</strong> has been successfully created
                   {formData.workOrderId && <span> and linked to Work Order <strong>{formData.workOrderId}</strong></span>}.
                   <br/>Check "Claims History" to view the record.
               </p>
               <div className="flex justify-center gap-4">
                 <button 
                    onClick={() => navigate('/claims-planner')}
                    className="bg-brand-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-brand-700 shadow-lg"
                 >
                     Go to Planner
                 </button>
                 <button 
                    onClick={() => navigate('/history-claims')}
                    className="bg-white text-slate-600 border border-slate-300 px-8 py-3 rounded-lg font-bold hover:bg-slate-50"
                 >
                     View in History
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
                                Linked to WO: {formData.workOrderId}
                            </span>
                        )}
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{formData.ticketNumber}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">New Appraisal Request</h1>
                    <p className="text-slate-500">Complete the form to request an independent valuation.</p>
                </div>

                <div className="flex justify-between items-center mb-8 px-2">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className="flex flex-col items-center flex-1 relative">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors ${step >= s ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                 {s}
                             </div>
                             <span className="text-xs mt-2 font-medium text-slate-500 uppercase">
                                {s === 1 && 'Workshop'}
                                {s === 2 && 'Claim'}
                                {s === 3 && 'Opposing'}
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
                            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">1. Workshop Data (Requester)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-100">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
                                    <input type="text" value={formData.workshop?.name} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">VAT ID</label>
                                    <input type="text" value={formData.workshop?.cif} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Main Contact</label>
                                    <input type="text" value={formData.workshop?.contact} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Province</label>
                                    <input type="text" value={formData.workshop?.province} disabled className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-slate-600 cursor-not-allowed" />
                                </div>
                            </div>
                            <p className="mt-4 text-xs text-slate-400 italic text-center">* These data are automatically pulled from your Valora Plus Company Profile.</p>
                        </div>
                    )}

                    {/* STEP 2: CLAIM DATA */}
                    {step === 2 && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">2. Claim & Vehicle Data</h3>
                            
                            {/* CLIENT SELECTION DROPDOWN */}
                            <div className="mb-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        Select Client (Insured) <span className="text-red-500">*</span>
                                    </label>
                                    <button 
                                        onClick={() => setShowClientModal(true)}
                                        className="text-xs bg-brand-100 text-brand-700 px-3 py-1.5 rounded-full font-bold hover:bg-brand-200 transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        New Client
                                    </button>
                                </div>
                                <div className="relative">
                                    <select 
                                        className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none"
                                        onChange={(e) => handleClientSelection(e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Choose from Client List --</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.taxId})</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-3.5 pointer-events-none text-slate-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 ml-1">Selecting a client will automatically fill in the Insured Name below.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Insured Name (Client) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-300 rounded bg-white" 
                                        placeholder="Full Name or Company"
                                        value={formData.insuredName}
                                        onChange={(e) => handleInputChange('root', 'insuredName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Claim Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-2 border border-slate-300 rounded"
                                        value={formData.claimDate}
                                        onChange={(e) => handleInputChange('root', 'claimDate', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Claim Type</label>
                                    <select 
                                        className="w-full p-2 border border-slate-300 rounded"
                                        value={formData.claimType}
                                        onChange={(e) => handleInputChange('root', 'claimType', e.target.value)}
                                    >
                                        {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Company</label>
                                    <select 
                                        className="w-full p-2 border border-slate-300 rounded"
                                        value={formData.insuranceCompany}
                                        onChange={(e) => handleInputChange('root', 'insuranceCompany', e.target.value)}
                                    >
                                        <option value="">Select Company...</option>
                                        {insuranceOptions.length > 0 ? (
                                            insuranceOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                        ) : (
                                            <option disabled>No insurance companies in Contacts</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* COST CALCULATION REFERENCE FIELD */}
                            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <label className="block text-sm font-bold text-yellow-800 mb-2">Cost Calculation Reference <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full p-2 border border-yellow-300 rounded text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                                    value={formData.costReference || ''}
                                    onChange={(e) => handleInputChange('root', 'costReference', e.target.value)}
                                >
                                    <option value="">-- Select a Calculation Code --</option>
                                    {costOptions.length > 0 ? (
                                        costOptions.map((opt: HourCostCalculation) => (
                                            <option key={opt.periodo} value={opt.periodo}>
                                                {opt.periodo} ({(opt.resultado_calculo?.hourlyCost || 0).toFixed(2)}€/h - {new Date(opt.created_at).toLocaleDateString()})
                                            </option>
                                        ))
                                    ) : (
                                        <option disabled>No cost calculations saved yet.</option>
                                    )}
                                </select>
                                <p className="text-xs text-yellow-700 mt-1">You must select a valid cost calculation from the Cost Calculator module.</p>
                            </div>
                            
                            <h4 className="font-bold text-slate-700 mb-3">Vehicle Data</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Brand</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-300 rounded text-sm"
                                        value={formData.vehicle?.brand}
                                        onChange={(e) => handleInputChange('vehicle', 'brand', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Model</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-300 rounded text-sm"
                                        value={formData.vehicle?.model}
                                        onChange={(e) => handleInputChange('vehicle', 'model', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Plate</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-300 rounded text-sm uppercase font-mono"
                                        value={formData.vehicle?.plate}
                                        onChange={(e) => handleInputChange('vehicle', 'plate', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Km</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2 border border-slate-300 rounded text-sm"
                                        value={formData.vehicle?.km}
                                        onChange={(e) => handleInputChange('vehicle', 'km', parseInt(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: OPPOSING VEHICLE */}
                    {step === 3 && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">3. Opposing Vehicle</h3>
                            
                            <div className="mb-6">
                                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input 
                                        type="checkbox"
                                        checked={formData.opposingVehicle?.exists}
                                        onChange={(e) => handleInputChange('opposingVehicle', 'exists', e.target.checked)}
                                        className="w-5 h-5 text-brand-600"
                                    />
                                    <span className="font-bold text-slate-700">Is there an opposing vehicle involved?</span>
                                </label>
                            </div>

                            {formData.opposingVehicle?.exists && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Opposing Plate</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2 border border-slate-300 rounded uppercase font-mono"
                                            value={formData.opposingVehicle?.plate}
                                            onChange={(e) => handleInputChange('opposingVehicle', 'plate', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Brand/Model</label>
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
                            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">4. Documentation & Expert Assignment</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Photos Upload */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                                        Photos
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${uploadedPhotos.length >= 6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {uploadedPhotos.length} / 6 Minimum
                                        </span>
                                    </h4>
                                    <label className="block w-full h-32 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-white transition-colors cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-brand-600 mb-4">
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                        <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-sm font-medium">Add Photos</span>
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
                                        Explanatory Video
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${uploadedVideo ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                                            {uploadedVideo ? 'Attached' : 'Optional'}
                                        </span>
                                    </h4>
                                    <label className="block w-full h-32 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-white transition-colors cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-brand-600">
                                        <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                                        <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10z" /></svg>
                                        <span className="text-sm font-medium">{uploadedVideo ? uploadedVideo.name : 'Add Video'}</span>
                                    </label>
                                </div>

                                {/* Documents Upload */}
                                <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                                        Documents & PDF Reports
                                        <span className="text-xs text-slate-400 font-normal">Optional</span>
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
                                            <span className="font-bold text-sm">Attach Documents</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* EXPERT SELECTION - BITRIX REPLACEMENT */}
                            <div className="pt-6 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        </div>
                                        Assign Expert (Bitrix24 Colleague) <span className="text-red-500">*</span>
                                    </h4>
                                    
                                    {/* SMALL REFRESH BUTTON */}
                                    <button 
                                        onClick={handleRefreshBitrixUsers} 
                                        disabled={refreshingUsers}
                                        className="bg-white border border-slate-300 text-blue-600 p-2 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                                        title="Refresh list"
                                    >
                                        <svg className={`w-4 h-4 ${refreshingUsers ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Selected Client Reminder */}
                                <div className="mb-4 bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Assigned Client (Insured):</span>
                                    <span className="font-bold text-slate-800">{formData.insuredName || 'Not Selected'}</span>
                                </div>
                                
                                {!isBitrixConnected ? (
                                    <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            <span className="text-sm font-medium">Bitrix24 not connected or no users found.</span>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/bitrix-config')} 
                                            className="text-sm bg-white border border-orange-300 px-3 py-1 rounded text-orange-700 hover:bg-orange-50 font-bold"
                                        >
                                            Check Config
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <select 
                                                    className="w-full p-3 border border-slate-300 rounded-lg bg-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm font-medium text-slate-700"
                                                    value={formData.assignedExpertId}
                                                    onChange={(e) => handleInputChange('root', 'assignedExpertId', e.target.value)}
                                                >
                                                    <option value="">-- Select a Colleague from Bitrix24 --</option>
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

                                        {/* Selection Summary */}
                                        {formData.assignedExpertId && (
                                            <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded-lg text-sm flex items-center justify-between animate-fade-in">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                                                        BX
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">Assigned Bitrix User</p>
                                                        <p className="text-xs text-blue-600">
                                                            {bitrixUsers.find(u => u.ID === formData.assignedExpertId)?.NAME} {bitrixUsers.find(u => u.ID === formData.assignedExpertId)?.LAST_NAME}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleInputChange('root', 'assignedExpertId', '')}
                                                    className="text-xs text-red-500 hover:text-red-700 font-bold uppercase"
                                                >
                                                    Remove
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
                            Back
                        </button>
                    ) : (
                        <div></div> // Spacer
                    )}

                    {step < 4 ? (
                        <button 
                            onClick={() => setStep(step + 1)}
                            className="bg-brand-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-brand-700 shadow-md transition-all flex items-center gap-2"
                        >
                            Next Step
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    ) : (
                        <button 
                            onClick={handleSubmit}
                            disabled={loading || !isBitrixConnected}
                            className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-w-[200px] justify-center"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span className="text-xs">{statusMessage || 'Sending...'}</span>
                                </div>
                            ) : (
                                <>
                                    Confirm & Push to Bitrix
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </>
                            )}
                        </button>
                    )}
                </div>
           </>
       )}

       {/* CLIENT FORM MODAL */}
       {showClientModal && (
           <ClientForm 
               onSubmit={handleCreateClient}
               onCancel={() => setShowClientModal(false)}
               showQuickReceptionOption={false}
           />
       )}
    </div>
  );
};

export default NewValuation;
