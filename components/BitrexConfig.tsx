
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanyProfileFromSupabase, saveBitrixConfig } from '../services/supabaseClient';
import { testBitrixConnection, clearBitrixCache } from '../services/bitrixService';

const BitrexConfig: React.FC = () => {
    const navigate = useNavigate();
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Load from Supabase on mount
    useEffect(() => {
        const loadConfig = async () => {
            const profile = await getCompanyProfileFromSupabase();
            if (profile?.integrations?.bitrixUrl) {
                setUrl(profile.integrations.bitrixUrl);
                setStatus('connected');
            }
        };
        loadConfig();
    }, []);

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
                // Fire and forget the DB save to prevent UI blocking
                saveBitrixConfig(url.trim()).then(success => {
                    if (!success) console.warn("Background save to DB failed");
                });

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

    const handleEdit = () => {
        // Switches the view to 'idle' so the input form appears with the current URL populated
        setStatus('idle');
        setErrorMsg('');
    };

    const handleDisconnect = async () => {
        if (window.confirm('¿Está seguro de que desea desconectar completamente y eliminar esta URL?')) {
            // IMMEDIATE UI UPDATE
            setStatus('idle');
            setUrl(''); // Clear the input
            setErrorMsg('');
            setIsSaving(false);

            // Clear Caches
            clearBitrixCache();
            localStorage.removeItem('vp_bitrix_config');

            // Background DB Update
            await saveBitrixConfig('');
        }
    };

    const handleForceReset = () => {
        if (window.confirm("Esto borrará todo el almacenamiento local y recargará la página. Úselo si la aplicación está bloqueada.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8 animate-fade-in">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Conectar Bitrix24</h1>
                    <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-200 uppercase tracking-wide mb-4">
                        Modo Integración Cloud
                    </div>
                    <p className="text-slate-500 leading-relaxed">
                        Conéctese a su instancia de Bitrix24 para habilitar el chat con expertos directamente desde el panel.
                    </p>
                </div>
                <button onClick={handleForceReset} className="text-[10px] text-slate-300 hover:text-red-400 underline whitespace-nowrap ml-4">
                    Reset Forzado
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">

                {status === 'connected' ? (
                    <div className="text-center py-8 animate-fade-in-up">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Bitrix24 Conectado</h3>
                        <p className="text-slate-500 mb-6 text-sm bg-slate-50 p-2 rounded break-all font-mono border border-slate-100">{url}</p>

                        <div className="flex flex-col gap-3 max-w-xs mx-auto">
                            <button onClick={() => navigate('/valuations')} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition-colors">
                                Ir a Chats
                            </button>

                            <div className="flex gap-2">
                                <button onClick={handleEdit} className="flex-1 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                                    Editar URL
                                </button>
                                <button onClick={handleDisconnect} disabled={isSaving} className="flex-1 bg-white border border-red-200 text-red-500 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                                    Desconectar
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">URL del Webhook de Entrada de Bitrix24</label>
                            <input
                                type="text"
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all outline-none text-sm ${status === 'error' ? 'border-red-300 ring-red-100' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
                                value={url}
                                onChange={e => { setUrl(e.target.value); setStatus('idle'); }}
                                placeholder="https://su-dominio.bitrix24.com/rest/1/..."
                            />
                            <div className="flex gap-2 mt-2">
                                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold border border-slate-200">PERMISOS REQUERIDOS:</span>
                                <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-700 font-mono border border-blue-100">user</span>
                                <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-700 font-mono border border-blue-100">im</span>
                                <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-700 font-mono border border-blue-100">crm</span>
                            </div>
                        </div>

                        {status === 'error' && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {errorMsg || 'Por favor, introduzca una URL válida.'}
                            </div>
                        )}

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ¿Cómo obtener esta URL?
                            </h3>
                            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                                <li>Abra Bitrix24 → <strong>Recursos para Desarrolladores</strong> → <strong>Otros</strong> → <strong>Webhook de Entrada</strong>.</li>
                                <li>Seleccione los siguientes permisos:
                                    <ul className="list-disc pl-4 mt-1 mb-1">
                                        <li><strong>CRM</strong> (crm)</li>
                                        <li><strong>Chat y Notificaciones</strong> (im)</li>
                                        <li><strong>Usuarios</strong> (user)</li>
                                    </ul>
                                </li>
                                <li>Copie la <strong>URL del Webhook</strong> generada.</li>
                            </ol>
                        </div>

                        <div className="flex gap-3">
                            {/* Cancel button if editing (url exists but status is idle) */}
                            {url && (
                                <button
                                    onClick={() => setStatus('connected')}
                                    className="px-6 py-3 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                onClick={handleConnect}
                                disabled={isSaving || !url}
                                className="flex-1 bg-[#00AEEF] text-white py-3 rounded-lg font-bold hover:bg-[#009bd5] transition-all disabled:opacity-70 shadow-md flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Probando Conexión...
                                    </>
                                ) : (
                                    'Guardar y Conectar'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Resolución de Problemas</h4>
                    <p className="text-xs text-slate-500 mb-2">Si no puede desconectar mediante el botón, ejecute este SQL en su Editor de Supabase:</p>
                    <div className="relative group">
                        <code className="block bg-slate-800 text-green-400 p-3 rounded text-xs font-mono select-all overflow-x-auto whitespace-pre-wrap">
                            {`UPDATE company_profile SET raw_data = jsonb_set(raw_data, '{integrations,bitrixUrl}', '""');`}
                        </code>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-white/50 bg-black/50 px-2 py-1 rounded">Copiar y Ejecutar en Editor SQL</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BitrexConfig;
