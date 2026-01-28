
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanyProfileFromSupabase, saveCompanyProfileToSupabase, supabase } from '../services/supabaseClient';
import { testBitrixConnection, clearBitrixCache, getBitrixUsers, BitrixUser, getBitrixContacts } from '../services/bitrixService';

const BitrexConfig: React.FC = () => {
    const navigate = useNavigate();
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [profileId, setProfileId] = useState<string | null>(null);

    // Default Expert State
    const [availableExperts, setAvailableExperts] = useState<BitrixUser[]>([]);
    const [selectedExpertId, setSelectedExpertId] = useState<string>('');
    const [isLoadingExperts, setIsLoadingExperts] = useState(false);

    // Load from Supabase on mount
    useEffect(() => {
        const loadConfig = async () => {
            const profile = await getCompanyProfileFromSupabase();

            // Get current user ID for the troubleshooting SQL
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setProfileId(user.id);

            if (profile?.integrations?.bitrixUrl) {
                setUrl(profile.integrations.bitrixUrl);
                setStatus('connected');
                if (profile.defaultExpertId) {
                    setSelectedExpertId(profile.defaultExpertId);
                }
            }
        };
        loadConfig();
    }, []);

    // Load Bitrix Users when connected
    useEffect(() => {
        if (status === 'connected') {
            loadExperts();
        }
    }, [status]);

    const loadExperts = async () => {
        setIsLoadingExperts(true);
        try {
            const [users, contacts] = await Promise.all([
                getBitrixUsers(),
                getBitrixContacts()
            ]);

            // Transform contacts to match BitrixUser interface roughly for the dropdown
            const mappedContacts = contacts.map((c: any) => ({
                ID: c.ID,
                NAME: c.NAME,
                LAST_NAME: c.LAST_NAME,
                WORK_POSITION: c.WORK_POSITION || 'External Contact',
                ACTIVE: true
            }));

            // Merge and deduplicate
            setAvailableExperts([...users, ...mappedContacts]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingExperts(false);
        }
    };

    const handleConnect = async () => {
        if (!url.trim()) {
            setStatus('error');
            setErrorMsg('Por favor, introduzca una URL.');
            return;
        }

        setStatus('checking');
        setIsSaving(true);
        setErrorMsg('');

        try {
            // 1. Test Connection
            const isValid = await testBitrixConnection(url.trim());

            if (isValid) {
                // 2. Save if valid
                const profile = await getCompanyProfileFromSupabase();
                if (profile) {
                    const updated = {
                        ...profile,
                        integrations: { ...profile.integrations, bitrixUrl: url.trim() }
                    };
                    await saveCompanyProfileToSupabase(updated);
                }

                // Clean up legacy fallback to ensure new URL is used
                localStorage.removeItem('vp_bitrix_config');

                // Immediate UI success
                setStatus('connected');
                clearBitrixCache();
            } else {
                setStatus('error');
                setErrorMsg('No se pudo conectar a Bitrix24. Compruebe la URL y los permisos.');
            }
        } catch (e) {
            setStatus('error');
            setErrorMsg('Error de red.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDefaultExpert = async () => {
        setIsSaving(true);
        try {
            const profile = await getCompanyProfileFromSupabase();
            if (profile) {
                const expert = availableExperts.find(u => u.ID === selectedExpertId);
                const updated = {
                    ...profile,
                    defaultExpertId: selectedExpertId,
                    defaultExpertName: expert ? `${expert.NAME} ${expert.LAST_NAME}` : ''
                };
                await saveCompanyProfileToSupabase(updated);
                alert("Configuración guardada correctamente.");
            }
        } catch (e) {
            alert("Error al guardar.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = () => {
        setStatus('idle');
        setErrorMsg('');
    };

    const handleDisconnect = async () => {
        if (window.confirm('¿Está seguro de que desea desconectar completamente y eliminar esta URL?')) {
            setStatus('idle');
            setUrl('');
            setErrorMsg('');
            setIsSaving(false);

            clearBitrixCache();
            localStorage.removeItem('vp_bitrix_config');

            const profile = await getCompanyProfileFromSupabase();
            if (profile) {
                const updated = {
                    ...profile,
                    integrations: { ...profile.integrations, bitrixUrl: '' },
                    defaultExpertId: '',
                    defaultExpertName: ''
                };
                await saveCompanyProfileToSupabase(updated);
            }
        }
    };

    const handleForceReset = () => {
        if (window.confirm("Esto borrará todo el almacenamiento local and recargará la página.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-8 animate-fade-in shadow-sm">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Configuración Bitrix24</h1>
                    <p className="text-slate-500">Gestione la conexión y la asignación automática de expertos.</p>
                </div>
                <button onClick={handleForceReset} className="text-[10px] text-slate-300 hover:text-red-400 underline uppercase font-bold">
                    Reset Forzado
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* CONNECTION BLOCK */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                        Estado de la Conexión
                    </h2>

                    {status === 'connected' ? (
                        <div className="animate-fade-in">
                            <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-6">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <div>
                                    <p className="text-emerald-800 font-bold">Conectado Correctamente</p>
                                    <p className="text-xs text-emerald-600 truncate max-w-md font-mono">{url}</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={handleEdit} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all text-sm">
                                    Cambiar URL
                                </button>
                                <button onClick={handleDisconnect} className="text-red-500 px-6 py-2 rounded-lg font-bold hover:bg-red-50 transition-all text-sm">
                                    Desconectar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">URL del Webhook de Entrada</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="https://su-dominio.bitrix24.com/rest/1/..."
                                />
                            </div>
                            <button
                                onClick={handleConnect}
                                disabled={isSaving || !url}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? "Conectando..." : "Sincronizar con Bitrix24"}
                            </button>
                        </div>
                    )}
                </div>

                {/* DEFAULT EXPERT BLOCK */}
                {status === 'connected' && (
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
                                            <option key={u.ID} value={u.ID}>{u.NAME} {u.LAST_NAME} ({u.WORK_POSITION || 'Bitrix User'})</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={loadExperts}
                                        className="p-3 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 border border-slate-200"
                                        title="Actualizar lista"
                                    >
                                        <svg className={`w-5 h-5 ${isLoadingExperts ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveDefaultExpert}
                                disabled={isSaving}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all shadow-md mt-4"
                            >
                                {isSaving ? "Guardando..." : "Guardar Configuración de Perito"}
                            </button>
                        </div>
                    </div>
                )}

                {/* TROUBLESHOOTING */}
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Soporte y Depuración</h4>
                    <p className="text-[11px] text-slate-500 mb-4 italic">Si experimenta problemas con la conexión, puede limpiar manualmente el registro usando este código en el editor SQL de Supabase:</p>
                    <code className="block bg-slate-800 text-green-400 p-4 rounded-xl text-[10px] font-mono select-all overflow-x-auto">
                        {`UPDATE company_profiles SET bitrix_webhook_url = NULL, default_expert_id = NULL WHERE id = '${profileId || 'SU_UUID'}';`}
                    </code>
                </div>
            </div>
        </div>
    );
};

export default BitrexConfig;
