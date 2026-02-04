import React, { useState, useEffect } from 'react';
import { ValuationRequest, HourCostCalculation } from '../types';
import {
    getValuationsFromSupabase,
    updateValuationStage,
    deleteValuation,
    getCostCalculations,
    saveAnonymizedValuation,
    updateValuationExpert,
    supabase
} from '../services/supabaseClient';
import {
    getBitrixContacts,
    pushValuationToBitrix,
    BitrixUser
} from '../services/bitrixService';

const AdminValuationsQueue: React.FC = () => {
    const [pendingValuations, setPendingValuations] = useState<ValuationRequest[]>([]);
    const [bitrixContacts, setBitrixContacts] = useState<BitrixUser[]>([]);
    const [costOptions, setCostOptions] = useState<HourCostCalculation[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [viewingValuation, setViewingValuation] = useState<ValuationRequest | null>(null);
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [costSelections, setCostSelections] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [valuations, contacts, costs] = await Promise.all([
                getValuationsFromSupabase(),
                getBitrixContacts(),
                getCostCalculations()
            ]);

            const pending = valuations.filter(v => v.claimsStage === 'pending_admin');
            setPendingValuations(pending);

            const mappedContacts = contacts.map((c: any) => ({
                ID: `contact_${c.ID}`,
                NAME: c.NAME,
                LAST_NAME: c.LAST_NAME,
                WORK_POSITION: c.WORK_POSITION || 'Contacto Externo',
                ACTIVE: true,
                IS_CONTACT: true
            } as BitrixUser));
            setBitrixContacts(mappedContacts);
            setCostOptions(costs);

            const initialAssignments: Record<string, string> = {};
            const initialCostSelections: Record<string, string> = {};
            pending.forEach(v => {
                if (v.assignedExpertId) initialAssignments[v.id] = v.assignedExpertId;
                if (v.costReference) initialCostSelections[v.id] = v.costReference;
            });
            setAssignments(initialAssignments);
            setCostSelections(initialCostSelections);
        } catch (error) {
            console.error("Error fetching queue data:", error);
            showNotification("Error al cargar los datos", "error");
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAssignmentChange = (valuationId: string, expertId: string) => {
        setAssignments(prev => ({ ...prev, [valuationId]: expertId }));
    };

    const handleCostChange = (valuationId: string, periodo: string) => {
        setCostSelections(prev => ({ ...prev, [valuationId]: periodo }));
    };

    const handleApprove = async (valuation: ValuationRequest) => {
        const expertId = assignments[valuation.id];
        const periodo = costSelections[valuation.id] || valuation.costReference;

        if (!expertId) {
            alert("Por favor, asigne un perito antes de aprobar.");
            return;
        }

        setProcessingId(valuation.id);
        try {
            const selectedCost = costOptions.find(c => c.periodo === periodo);
            let expertIsContact = false;
            let finalExpertId = expertId;

            if (expertId.startsWith('contact_')) {
                expertIsContact = true;
                finalExpertId = expertId.replace('contact_', '');
            }

            const dataForBitrix = {
                ...valuation,
                assignedExpertId: finalExpertId,
                costReference: periodo
            };
            const fileLinks = [
                ...(valuation.photos || []).map(url => ({ url, type: 'image' as const })),
                ...(valuation.documents || []).map(url => ({ url, type: 'doc' as const })),
                ...(valuation.videoUrl ? [{ url: valuation.videoUrl, type: 'video' as const }] : [])
            ];

            const bitrixResult = await pushValuationToBitrix(
                dataForBitrix,
                fileLinks,
                selectedCost,
                valuation.workshop_id,
                expertIsContact
            );

            if (!bitrixResult.success) throw new Error(`Error en Bitrix: ${bitrixResult.error}`);

            const nameParts = (valuation.insuredName || '').trim().split(' ');
            await saveAnonymizedValuation({
                valuation_id: valuation.id,
                order_number: valuation.vehicle?.plate || '',
                registration_number: valuation.vehicle?.plate || '',
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                photos: valuation.photos || [],
                mileage: valuation.vehicle?.km || 0,
                labour_cost: selectedCost?.resultado_calculo?.hourlyCost || 0
            });

            await updateValuationExpert(valuation.id, expertId);
            await updateValuationStage(valuation.id, 'analytics'); // Move directly to Historial
            showNotification("Solicitud aprobada y archivada en el Historial", "success");
            setPendingValuations(prev => prev.filter(v => v.id !== valuation.id));
        } catch (error: any) {
            console.error("Approve failed:", error);
            showNotification(error.message || "Fallo al aprobar la solicitud", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDecline = async (id: string) => {
        if (!window.confirm("¿Seguro que desea rechazar y eliminar esta solicitud?")) return;
        setProcessingId(id);
        try {
            const success = await deleteValuation(id);
            if (success) {
                showNotification("Solicitud eliminada", "success");
                setPendingValuations(prev => prev.filter(v => v.id !== id));
            } else {
                showNotification("Error al eliminar", "error");
            }
        } catch (error) {
            showNotification("Error crítico al eliminar", "error");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in relative">
            {notification && (
                <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in-up ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="font-bold text-sm">{notification.message}</span>
                </div>
            )}

            {/* DETAIL MODAL */}
            {viewingValuation && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Detalle de Solicitud</h2>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{viewingValuation.ticketNumber}</p>
                            </div>
                            <button onClick={() => setViewingValuation(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-4">Datos del Taller</h4>
                                        <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <DetailItem label="Nombre Fiscal" value={viewingValuation.workshop.name} />
                                            <DetailItem label="CIF/NIF" value={viewingValuation.workshop.cif} />
                                            <DetailItem label="Contacto" value={viewingValuation.workshop.contact} />
                                            <DetailItem label="Provincia" value={viewingValuation.workshop.province} />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-4">Información del Siniestro</h4>
                                        <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <DetailItem label="Asegurado" value={viewingValuation.insuredName} highlight />
                                            <DetailItem label="Compañía" value={viewingValuation.insuranceCompany} />
                                            <DetailItem label="Tipo" value={viewingValuation.claimType} />
                                            <DetailItem label="Fecha Siniestro" value={viewingValuation.claimDate} />
                                            <DetailItem label="Franquicia" value={viewingValuation.franchise?.applies ? `${viewingValuation.franchise.amount} €` : 'No aplica'} />
                                            <DetailItem label="Referencia de Costes" value={viewingValuation.costReference} />
                                            <DetailItem label="Declaración Jurada" value={viewingValuation.declarationAccepted ? 'Aceptada ✅' : 'No aceptada ❌'} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-4">Vehículo del Cliente</h4>
                                        <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <DetailItem label="Marca/Modelo" value={`${viewingValuation.vehicle.brand} ${viewingValuation.vehicle.model}`} highlight />
                                            <DetailItem label="Matrícula" value={viewingValuation.vehicle.plate} />
                                            <DetailItem label="Bastidor (VIN)" value={viewingValuation.vehicle.vin || 'No proporcionado'} />
                                            <DetailItem label="Kilometraje" value={`${viewingValuation.vehicle.km} km`} />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-4">Vehículo Contrario</h4>
                                        <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            <DetailItem label="¿Existe contrario?" value={viewingValuation.opposingVehicle?.exists ? 'SÍ' : 'NO'} />
                                            {viewingValuation.opposingVehicle?.exists && (
                                                <>
                                                    <DetailItem label="Matrícula Contrario" value={viewingValuation.opposingVehicle.plate} />
                                                    <DetailItem label="Modelo Contrario" value={viewingValuation.opposingVehicle.model} />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100">
                                <h4 className="text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-6">Archivos y Evidencias</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Fotografías ({viewingValuation.photos?.length || 0})</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {viewingValuation.photos?.map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-500 transition-all">
                                                    <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Documentos ({viewingValuation.documents?.length || 0})</p>
                                            <div className="space-y-2">
                                                {viewingValuation.documents?.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                        Documento Adicional {i + 1}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                        {viewingValuation.videoUrl && (
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Video de Daños</p>
                                                <a href={viewingValuation.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors text-xs font-bold">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                    Ver Video de Peritación
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setViewingValuation(null)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">Cerrar Vista</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-10">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Cola de Aprobación</h1>
                <p className="text-slate-500 font-medium">Valide las solicitudes de peritación antes de enviarlas al sistema externo.</p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando cola de revisión...</p>
                </div>
            ) : pendingValuations.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-2">No hay solicitudes pendientes</h2>
                    <p className="text-slate-400 font-medium">Todas las solicitudes han sido procesadas o rechazadas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {pendingValuations.map(valuation => (
                        <div key={valuation.id} className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow relative group">
                            <div className="flex flex-col lg:flex-row">
                                <div className="p-6 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/30">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">{valuation.ticketNumber}</span>
                                        <span className="text-slate-400 text-[10px] font-bold uppercase">{valuation.requestDate}</span>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 mb-1">{valuation.workshop.name}</h3>
                                    <p className="text-slate-500 font-bold text-sm mb-4">{valuation.workshop.province} - {valuation.workshop.contact}</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase">Vehículo:</span><span className="text-slate-700 font-black">{valuation.vehicle.brand} {valuation.vehicle.model}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase">Matrícula:</span><span className="text-slate-700 font-black">{valuation.vehicle.plate}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase">Asegurado:</span><span className="text-slate-700 font-black">{valuation.insuredName}</span></div>
                                    </div>
                                    <button onClick={() => setViewingValuation(valuation)} className="mt-6 w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        Ver Todo el Formulario
                                    </button>
                                </div>
                                <div className="p-6 lg:flex-1">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Evidencias ({valuation.photos?.length || 0})</h4>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {valuation.photos?.map((url, i) => <img key={i} src={url} alt="Evidencia" className="w-20 h-20 rounded-lg object-cover border border-slate-200 flex-shrink-0" />)}
                                        {(!valuation.photos || valuation.photos.length === 0) && <div className="w-20 h-20 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
                                    </div>
                                    <div className="mt-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Compañía de Seguros:</h4>
                                        <p className="text-sm text-slate-700 font-bold">{valuation.insuranceCompany || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="p-6 lg:w-1/4 flex flex-col justify-center gap-4 bg-slate-50/30">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asignar Perito:</label>
                                    <select className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-brand-500 outline-none" value={assignments[valuation.id] || ''} onChange={(e) => handleAssignmentChange(valuation.id, e.target.value)} disabled={processingId === valuation.id}>
                                        <option value="">-- Seleccionar Perito --</option>
                                        {bitrixContacts.map(c => <option key={c.ID} value={c.ID}>{c.NAME} {c.LAST_NAME}</option>)}
                                    </select>

                                    <div className="mt-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Referencia de Costes *</label>
                                        <select
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-brand-500 outline-none mb-2"
                                            value={costSelections[valuation.id] || ''}
                                            onChange={(e) => handleCostChange(valuation.id, e.target.value)}
                                            disabled={processingId === valuation.id}
                                        >
                                            <option value="">-- Seleccionar Tarifa --</option>
                                            {costOptions.map(c => <option key={c.id} value={c.periodo}>{c.periodo}</option>)}
                                        </select>

                                        {(() => {
                                            const selected = costOptions.find(c => c.periodo === (costSelections[valuation.id] || valuation.costReference));
                                            if (!selected) return null;
                                            const hourlyCost = selected.resultado_calculo?.hourlyCost || 0;
                                            return (
                                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50">
                                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-amber-200/20">
                                                        <div>
                                                            <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest opacity-70">Coste Interno</p>
                                                            <p className="text-[10px] font-black text-slate-900">{hourlyCost.toFixed(2)}€/h</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest opacity-70">Margen</p>
                                                            <p className="text-[10px] font-black text-emerald-600">20%</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest opacity-70 mb-0.5">Precio Sugerido (PVP)</p>
                                                        <p className="text-sm font-black text-emerald-600">{(hourlyCost * 1.2).toFixed(2)}€/h</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => handleApprove(valuation)} disabled={processingId === valuation.id} className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
                                            {processingId === valuation.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><svg className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Aprobar Solicitud</>}
                                        </button>
                                        <button onClick={() => handleDecline(valuation.id)} disabled={processingId === valuation.id} className="w-full bg-white text-red-600 border border-red-100 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg> Rechazar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
            `}} />
        </div>
    );
};

const DetailItem = ({ label, value, highlight }: { label: string, value: any, highlight?: boolean }) => (
    <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className={`text-sm ${highlight ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>{value || 'N/A'}</span>
    </div>
);

export default AdminValuationsQueue;
