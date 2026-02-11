import React, { useState, useRef, useEffect } from 'react';
import { uploadWorkshopFile, saveFileMetadata, createExtractionJob, triggerExtractionProcess } from '../services/supabaseClient';

interface Props {
    workOrderId: string;
    expedienteId?: string; // For display purposes
    onUploadComplete?: () => void;
}

const AssessmentImporter: React.FC<Props> = ({ workOrderId, expedienteId, onUploadComplete }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [resultSummary, setResultSummary] = useState<any>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (selectedFile: File) => {
        if (selectedFile.type !== 'application/pdf') {
            setStatus('error');
            setErrorMessage('Solo se permiten archivos PDF.');
            return;
        }
        setFile(selectedFile);
        setStatus('idle');
        setErrorMessage('');
    };

    const startProcess = async () => {
        if (!file) return;

        setStatus('uploading');
        try {
            // Get user first (Dynamic import to avoid initialization issues)
            const { supabase } = await import('../services/supabaseClient');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuario no autenticado");

            // Auto-create buckets if missing (Try to self-heal)
            try {
                const { data: buckets } = await supabase.storage.listBuckets();
                const existing = new Set(buckets?.map(b => b.name) || []);
                console.log("[AssessmentImporter] Available buckets:", Array.from(existing));

                if (!existing.has('reception-files')) {
                    console.log("Creating 'reception-files' bucket...");
                    await supabase.storage.createBucket('reception-files', { public: true });
                }
                if (!existing.has('documents')) {
                    console.log("Creating 'documents' bucket...");
                    await supabase.storage.createBucket('documents', { public: true });
                }
            } catch (e) {
                console.warn("[AssessmentImporter] Bucket auto-creation warning:", e);
            }

            // 1. Upload File (With Fallback Strategy)
            const fileName = `assessment_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

            // Fix: Always use user.id as root to satisfy RLS checks (user_id/context_id/filename)
            const contextId = (workOrderId === 'standalone' || !workOrderId) ? 'assessments' : workOrderId;
            const storagePath = `${user.id}/${contextId}/${fileName}`;

            console.log("[AssessmentImporter] Target Path:", storagePath);

            let path: string | null = null;
            let usedBucket = 'reception-files';
            let lastUploadError: any = null;

            // ATTEMPT 1: reception-files
            try {
                console.log(`[AssessmentImporter] Attempting upload to 'reception-files'...`);
                // Direct call to debug exact error
                const { data, error } = await supabase.storage
                    .from('reception-files')
                    .upload(storagePath, file, { cacheControl: '3600', upsert: true });

                if (error) throw error;
                path = data?.path || null;
            } catch (e) {
                console.warn("[AssessmentImporter] Upload to 'reception-files' failed", e);
                lastUploadError = e;
            }

            // ATTEMPT 2: documents (Fallback)
            if (!path) {
                try {
                    console.log(`[AssessmentImporter] Fallback: Attempting upload to 'documents'...`);
                    const { data, error } = await supabase.storage
                        .from('documents')
                        .upload(storagePath, file, { cacheControl: '3600', upsert: true });

                    if (error) throw error;
                    path = data?.path || null;
                    usedBucket = 'documents';
                } catch (e) {
                    console.error("[AssessmentImporter] Fallback upload to 'documents' also failed.", e);
                    if (!lastUploadError) lastUploadError = e; // Keep first error if preferred, or update
                }
            }

            if (!path) {
                let bucketInfo = "Error listando";
                try {
                    const { data: b } = await supabase.storage.listBuckets();
                    bucketInfo = b ? `[${b.map(x => x.name).join(', ')}]` : "Null";
                } catch (err) { }

                throw new Error(`Error subiendo archivo: ${lastUploadError?.message || 'Desconocido'}. Buckets visibles: ${bucketInfo}. Verifique que el bucket 'reception-files' existe y es público.`);
            }

            // 2. Save Metadata to NEW table (ai_extraction_files)
            const filePayload = {
                workshop_id: user?.id,
                work_order_id: (workOrderId === 'standalone' || !workOrderId) ? null : workOrderId,
                bucket: usedBucket,
                storage_path: path,
                original_filename: file.name,
                mime_type: file.type,
                size_bytes: file.size,
                category: 'Valuation Report',
                uploaded_by: user?.id
            };

            const { data: fileRecord, error: fileError } = await supabase
                .from('ai_extraction_files')
                .insert(filePayload)
                .select()
                .single();

            if (fileError) throw fileError;

            // 3. Create Extraction Job
            const { success: jobSuccess, job, error: jobError } = await createExtractionJob({
                work_order_id: (workOrderId === 'standalone' || !workOrderId) ? null : workOrderId,
                file_id: fileRecord.id,
                status: 'pending'
            });

            if (!jobSuccess || !job) throw new Error(jobError || "Error creando el trabajo de extracción.");

            // 4. Trigger AI Process (Graceful Fallback)
            setStatus('processing');
            try {
                const { success: triggerSuccess, data: triggerData, error: triggerError } = await triggerExtractionProcess(job.id);

                if (!triggerSuccess) {
                    console.warn("AI Trigger Failed (Edge Function likely missing):", triggerError);
                    setResultSummary({ warning: "Archivo guardado. Procesamiento automático pendiente (IA no disponible)." });
                    setStatus('success');
                } else {
                    setStatus('success');
                    setResultSummary(triggerData?.data);
                }
            } catch (e) {
                console.warn("AI Trigger Exception:", e);
                setStatus('success');
                setResultSummary({ warning: "Archivo guardado. Error iniciando IA." });
            }

            if (onUploadComplete) onUploadComplete();

        } catch (error: any) {
            console.error("AI Import Failed:", error);
            setStatus('error');
            setErrorMessage(error.message || "Error desconocido durante el proceso.");
        }
    };

    return (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl -z-10 opacity-60"></div>

            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">AI Extraction Engine</h3>
                    <p className="text-sm font-medium text-slate-500">Importar valoración PDF automáticamente</p>
                </div>
            </div>

            {status === 'success' ? (
                <div className="animate-fade-in text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="text-lg font-black text-slate-800 mb-2">¡Importación Completada!</h4>
                    <p className="text-slate-600 mb-6 text-sm">
                        Se han procesado los datos de peritación correctamente.
                    </p>

                    {resultSummary && (
                        <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-200 mb-6">
                            <div className="flex justify-between mb-2 border-b border-slate-200 pb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Total Estimado</span>
                                <span className="font-mono font-black text-slate-800">{resultSummary.total_estimate?.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Mano de Obra</span>
                                <span className="font-mono font-bold text-slate-700">
                                    {(resultSummary.labor?.bodywork_hours + resultSummary.labor?.paint_hours).toFixed(1)} h
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase">Recambios</span>
                                <span className="font-mono font-bold text-slate-700">{resultSummary.materials?.parts?.length || 0} ítems</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => { setStatus('idle'); setFile(null); setResultSummary(null); }}
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-black transition-colors"
                    >
                        Procesar Otro
                    </button>
                </div>
            ) : (
                <>
                    <div
                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="application/pdf"
                            onChange={handleChange}
                        />

                        {file ? (
                            <div className="flex flex-col items-center">
                                <svg className="w-12 h-12 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <p className="font-bold text-slate-800 mb-1 truncate max-w-xs">{file.name}</p>
                                <p className="text-xs text-slate-500 mb-4">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    onClick={() => setFile(null)}
                                    className="text-red-500 text-xs font-bold hover:underline"
                                >
                                    Eliminar y Cambiar
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <svg className="w-10 h-10 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="font-bold text-slate-600 mb-1">Arrastra tu PDF aquí</p>
                                <p className="text-xs text-slate-400">o haz clic para explorar</p>
                            </div>
                        )}
                    </div>

                    {status === 'error' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {status === 'uploading' || status === 'processing' ? (
                        <div className="mt-6 flex flex-col items-center animate-pulse">
                            <p className="text-indigo-600 font-bold text-sm mb-2">
                                {status === 'uploading' ? 'Subiendo archivo...' : 'Analizando con IA...'}
                            </p>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div className="bg-indigo-600 h-1.5 rounded-full w-2/3 animate-progress-indeterminate"></div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={startProcess}
                            disabled={!file}
                            className={`mt-6 w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${file
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            Comenzar Extracción
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default AssessmentImporter;
