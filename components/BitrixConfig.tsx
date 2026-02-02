
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getBitrixSettingsFromSupabase, saveBitrixSettingsToSupabase } from '../services/supabaseClient';
import { getBitrixUsers, BitrixUser, getBitrixContacts } from '../services/bitrixService';

const BitrixConfig: React.FC = () => {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);

    // Default Expert State
    const [availableExperts, setAvailableExperts] = useState<BitrixUser[]>([]);
    const [selectedExpertId, setSelectedExpertId] = useState<string>('');
    const [isLoadingExperts, setIsLoadingExperts] = useState(false);

    // Load from Supabase on mount
    useEffect(() => {
        const loadConfig = async () => {
            const settings = await getBitrixSettingsFromSupabase();
            if (settings?.default_expert_id) {
                setSelectedExpertId(settings.default_expert_id);
            }
        };
        loadConfig();
        loadExperts();
    }, []);

    const loadExperts = async () => {
        setIsLoadingExperts(true);
        try {
            // ONLY fetch CRM Contacts as per user request
            const contacts = await getBitrixContacts();

            // Transform contacts to match BitrixUser interface
            const mappedContacts = contacts.map((c: any) => ({
                ID: `contact_${c.ID}`, // Use prefixed ID for consistency
                NAME: c.NAME,
                LAST_NAME: c.LAST_NAME,
                WORK_POSITION: c.WORK_POSITION || 'Contacto Externo',
                ACTIVE: true,
                IS_CONTACT: true
            }));

            setAvailableExperts(mappedContacts);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingExperts(false);
        }
    };

    const handleSaveDefaultExpert = async () => {
        setIsSaving(true);
        try {
            const expert = availableExperts.find(u => u.ID === selectedExpertId);
            // We use a placeholder here because the actual URL is hardcoded in the service
            await saveBitrixSettingsToSupabase(
                'GLOBAL_MANAGED',
                selectedExpertId,
                expert ? `${expert.NAME} ${expert.LAST_NAME}` : ''
            );
            alert("✅ Configuración de perito guardada correctamente.");
        } catch (e: any) {
            console.error("Save Expert Error:", e);
            alert(`❌ Error al guardar el perito: ${e.message || 'Error de base de datos'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-8 animate-fade-in shadow-sm">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Configuración Bitrix24</h1>
                <p className="text-slate-500">Gestione la asignación automática de expertos para las peritaciones.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* STATUS SUMMARY */}
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                        <p className="text-emerald-800 font-bold">Conexión Global Activa</p>
                        <p className="text-xs text-emerald-600">El sistema está sincronizado automáticamente con la instancia maestra de Bitrix24.</p>
                    </div>
                </div>

                {/* DEFAULT EXPERT BLOCK */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 animate-fade-in-up">
                    <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                        Asignación Automática de Perito
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">Seleccione el contacto de Bitrix que aparecerá por defecto en las solicitudes de sus clientes.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Perito / Contacto Asignado</label>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all shadow-sm bg-white"
                                    value={selectedExpertId}
                                    onChange={e => setSelectedExpertId(e.target.value)}
                                    disabled={isLoadingExperts}
                                >
                                    <option value="">-- Sin asignar (Manual) --</option>
                                    {availableExperts.map(u => (
                                        <option key={u.ID} value={u.ID}>{u.NAME} {u.LAST_NAME} ({u.WORK_POSITION || 'Bitrix Contact'})</option>
                                    ))}
                                </select>
                                <button
                                    onClick={loadExperts}
                                    className="p-3 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
                                    title="Actualizar lista"
                                >
                                    <svg className={`w-5 h-5 ${isLoadingExperts ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveDefaultExpert}
                            disabled={isSaving}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all shadow-md mt-4 disabled:opacity-50"
                        >
                            {isSaving ? "Guardando..." : "Guardar Configuración de Perito"}
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <p className="text-[11px] text-slate-500 leading-relaxed italic text-center">
                        Nota: El Webhook de Bitrix24 ahora está gestionado internamente por el sistema central para garantizar la máxima seguridad y compatibilidad.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BitrixConfig;
