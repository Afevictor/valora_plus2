
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { RepairJob } from '../types';
import {
    getWorkOrdersFromSupabase,
    getLaborLogsForOrder,
    getFilesForExpediente,
    getCompanyProfileFromSupabase,
    getAnalyticsUsageCount,
    logAnalyticsUsage,
    supabase
} from '../services/supabaseClient';
import { analyzeProfitabilityDocument } from '../services/geminiService';
import AssessmentImporter from './AssessmentImporter';

const COLORS = ['#3676b2', '#10b981', '#a855f7', '#f97316'];

const KPICard = ({ title, value, subtitle, trend, color = "brand", loading = false }: { title: string, value: string, subtitle: string, trend?: string, color?: string, loading?: boolean }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full hover:shadow-md transition-all">
        {loading ? (
            <div className="animate-pulse space-y-3">
                <div className="h-3 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
                <div className="h-3 w-full bg-slate-50 rounded"></div>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{title}</p>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{value}</h3>
                    </div>
                    {trend && (
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {trend}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">{subtitle}</p>
            </>
        )}
    </div>
);

const MarginCard = ({ label, value, subtitle, colorClass }: { label: string, value: string, subtitle: string, colorClass: string }) => (
    <div className={`bg-white p-5 rounded-xl border border-l-4 ${colorClass} shadow-sm hover:shadow-md transition-shadow`}>
        <p className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-wider">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">{subtitle}</p>
    </div>
);

const Analytics: React.FC = () => {
    const [finishedJobs, setFinishedJobs] = useState<RepairJob[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<{ isPremium: boolean, used: number }>({ isPremium: false, used: 0 });
    const navigate = useNavigate();

    // Datos de Análisis
    const [realLaborCost, setRealLaborCost] = useState<number>(0);
    const [smartData, setSmartData] = useState<any>(null);
    const [hourlyRate, setHourlyRate] = useState(38.50);

    const selectedJob = finishedJobs.find(j => j.id === selectedJobId);

    useEffect(() => {
        const init = async () => {
            setIsLoadingJobs(true);
            const [jobs, profile, usage] = await Promise.all([
                getWorkOrdersFromSupabase(),
                getCompanyProfileFromSupabase(),
                getAnalyticsUsageCount()
            ]);

            setSubscriptionStatus({
                isPremium: profile?.subscriptionTier === 'premium',
                used: usage
            });

            // Filtrar solo estados finalizados
            const finished = jobs.filter(j =>
                ['finished', 'invoiced', 'closed', 'admin_close'].includes(j.status?.toLowerCase() || '')
            );

            if (profile?.costeHora) setHourlyRate(profile.costeHora);
            setFinishedJobs(finished);
            setIsLoadingJobs(false);
        };
        init();
    }, []);

    const handleAnalyzeJob = async (jobId: string) => {
        if (!jobId) return;

        // 0. Usage Limit & Subscription Check
        const profile = await getCompanyProfileFromSupabase();
        const usageCount = await getAnalyticsUsageCount();

        const isPremium = profile?.subscriptionTier === 'premium';

        if (!isPremium && usageCount >= 3) {
            navigate('/payment');
            return;
        }

        setSelectedJobId(jobId);
        setIsAnalyzing(true);
        setSmartData(null);
        setRealLaborCost(0);

        try {
            const job = finishedJobs.find(j => j.id === jobId);
            if (!job) return;

            // 1. Obtener registros de mano de obra real
            const logs = await getLaborLogsForOrder(jobId);
            const totalRealLabor = logs.reduce((acc: number, l: any) => acc + (l.calculated_labor_cost || 0), 0);
            setRealLaborCost(totalRealLabor);

            // 2. Pre-fill from DB if available (Fast Path)
            if (job.insurancePayment && job.insurancePayment > 0) {
                setSmartData({
                    financials: {
                        total_gross: job.insurancePayment,
                        total_net: job.insurancePayment / 1.21, // Estimación Base Imponible (IVA 21%)
                        labor_total: 0,
                        parts_total: 0
                    },
                    analysis: {
                        summary: "Datos recuperados automáticamente del cierre de expediente.",
                        profitability_rating: "Medium"
                    },
                    metadata: { confidence_score: 100 }
                });
                setIsAnalyzing(false);
                return;
            }

            // 3. Obtener archivo de informe de peritación (Deep Analysis Fallback)
            const files = await getFilesForExpediente(jobId, job.expedienteId);
            let valuationReport = files.find(f => f.category === 'Valuation Report');

            if (!valuationReport) {
                valuationReport = files.find(f =>
                    (f.original_filename?.toLowerCase().includes('valoraci') ||
                        f.original_filename?.toLowerCase().includes('informe') ||
                        f.original_filename?.toLowerCase().includes('perita')) &&
                    f.mime_type === 'application/pdf'
                );
            }

            if (!valuationReport) {
                alert("No se encontró informe de peritación. Asegúrese de que el informe se subió durante el cierre en el Kanban.");
                setIsAnalyzing(false);
                return;
            }

            // 3. Extracción Profunda
            const response = await fetch(valuationReport.publicUrl);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                const mimeType = blob.type || 'application/pdf';

                const result = await analyzeProfitabilityDocument(base64data, mimeType);
                if (result) {
                    setSmartData(result);
                    // Log successful usage
                    await logAnalyticsUsage('profitability');
                } else {
                    alert("Falló la extracción profunda. Por favor, revise el formato del documento.");
                }
                setIsAnalyzing(false);
            };

        } catch (e) {
            console.error("Error en análisis profundo:", e);
            setIsAnalyzing(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!selectedJobId || isAnalyzing) return;
        setIsExporting(true);

        const element = document.getElementById('analytics-report');
        const job = finishedJobs.find(j => j.id === selectedJobId);

        const opt = {
            margin: 5,
            filename: `Profitability_Report_${job?.expedienteId || 'Export'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // @ts-ignore
        if (window.html2pdf) {
            // @ts-ignore
            window.html2pdf().set(opt).from(element).save().then(() => setIsExporting(false));
        } else {
            window.print();
            setIsExporting(false);
        }
    };

    const fmt = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

    // Profitability variables
    const valuedLabor = smartData?.financials?.labor_total || 0;
    const valuedParts = smartData?.financials?.parts_total || 0;
    const valuedPaint = smartData?.financials?.paint_material_total || 0;
    const valuedTotal = smartData?.financials?.total_net || (smartData?.financials?.total_gross ? smartData.financials.total_gross / 1.21 : 0);

    // PROFITABILITY CALCULATION (Simplified for Regex/Total-only extraction)
    // Note: If extraction only returns 'total_gross' (Regex), then 'valuedParts' is 0.
    // This means 'estimatedRealCost' will only count Labor.
    // Resulting Profit = (TotalNet) - (LaborCost). Parts cost is ignored (treated as 100% margin) unless parsed.
    const estimatedRealCost = realLaborCost + (valuedParts * 0.7) + (valuedPaint * 0.6);
    const netBenefit = valuedTotal - estimatedRealCost;
    const marginPercentage = valuedTotal > 0 ? (netBenefit / valuedTotal * 100) : 0;

    // Datos simulados para gráficos
    const MOCK_MONTHLY_DATA = [
        { name: 'Ene', Valorado: 12000, CosteReal: 9800 },
        { name: 'Feb', Valorado: 14500, CosteReal: 11200 },
        { name: 'Mar', Valorado: 11000, CosteReal: 9500 },
        { name: 'Abr', Valorado: valuedTotal || 16000, CosteReal: estimatedRealCost || 12500 },
        { name: 'May', Valorado: 13500, CosteReal: 10800 },
        { name: 'Jun', Valorado: 18000, CosteReal: 13500 },
    ];

    const barData = [
        { name: 'Chapa', eficiencia: 92 },
        { name: 'Pintura', eficiencia: 96 },
        { name: 'Mecánica', eficiencia: 88 },
        { name: 'Admin', eficiencia: 100 },
    ];

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in pb-20 bg-slate-50/30">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 px-2">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Centro de Auditoría</h1>
                    <p className="text-slate-500 font-medium">Análisis detallado de rentabilidad para expedientes finalizados.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    {!subscriptionStatus.isPremium && (
                        <button
                            onClick={() => navigate('/payment')}
                            className="px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:shadow-lg hover:scale-105 transition-all"
                        >
                            Upgrade ({subscriptionStatus.used}/3 Free)
                        </button>
                    )}

                    <button
                        onClick={handleDownloadPDF}
                        disabled={!selectedJobId || isAnalyzing || isExporting}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-black shadow-lg flex items-center gap-2 transition-all disabled:opacity-30"
                    >
                        {isExporting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                        )}
                        Exportar PDF
                    </button>
                </div>
            </div>

            {/* AI Extraction Engine Section - Always Visible */}
            <div className="mb-8">
                <AssessmentImporter
                    workOrderId={selectedJobId || 'standalone'}
                    expedienteId={selectedJob?.expedienteId}
                    onUploadComplete={() => {
                        // Refresh the analysis after upload if a job is selected
                        if (selectedJobId) {
                            handleAnalyzeJob(selectedJobId);
                        }
                    }}
                />
            </div>

            {/* Job Selector */}
            <div className="mb-8">
                <div className="relative">
                    <select
                        className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 text-sm font-black text-slate-700 shadow-sm transition-all outline-none"
                        value={selectedJobId}
                        onChange={(e) => handleAnalyzeJob(e.target.value)}
                        disabled={isLoadingJobs}
                    >
                        <option value="">{isLoadingJobs ? 'Sincronizando...' : '-- Seleccionar Expediente Finalizado --'}</option>
                        {finishedJobs.map(j => (
                            <option key={j.id} value={j.id}>{j.expedienteId} • {j.plate} ({j.insuredName})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Extracted Data Preview - Show what AI found */}
            {smartData && smartData.financials && (
                <div className="mb-8 bg-white rounded-3xl p-8 border border-slate-200 shadow-lg">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Datos Extraídos por IA</h3>
                            <p className="text-sm font-medium text-slate-500">Información detectada en el informe de peritación</p>
                        </div>
                        {smartData.metadata?.confidence_score && (
                            <div className="ml-auto text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Confianza</p>
                                <p className="text-2xl font-black text-emerald-600">{smartData.metadata.confidence_score}%</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Total Gross */}
                        <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100">
                            <p className="text-xs font-black text-blue-600 uppercase mb-2">Total Facturado</p>
                            <p className="text-3xl font-black text-slate-900">{fmt(smartData.financials.total_gross || 0)}</p>
                            <p className="text-xs text-slate-500 mt-1">Inc. IVA</p>
                        </div>

                        {/* Labor */}
                        {smartData.financials.labor_total !== undefined && (
                            <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100">
                                <p className="text-xs font-black text-purple-600 uppercase mb-2">Mano de Obra</p>
                                <p className="text-3xl font-black text-slate-900">{fmt(smartData.financials.labor_total)}</p>
                                {smartData.financials.labor_hours && (
                                    <p className="text-xs text-slate-500 mt-1">{smartData.financials.labor_hours} horas</p>
                                )}
                            </div>
                        )}

                        {/* Parts */}
                        {smartData.financials.parts_total !== undefined && (
                            <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100">
                                <p className="text-xs font-black text-emerald-600 uppercase mb-2">Recambios</p>
                                <p className="text-3xl font-black text-slate-900">{fmt(smartData.financials.parts_total)}</p>
                                <p className="text-xs text-slate-500 mt-1">Materiales</p>
                            </div>
                        )}

                        {/* Paint Materials */}
                        {smartData.financials.paint_material_total !== undefined && (
                            <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl border border-orange-100">
                                <p className="text-xs font-black text-orange-600 uppercase mb-2">Mat. Pintura</p>
                                <p className="text-3xl font-black text-slate-900">{fmt(smartData.financials.paint_material_total)}</p>
                                <p className="text-xs text-slate-500 mt-1">Anexos y pintura</p>
                            </div>
                        )}
                    </div>

                    {/* Parts List if available */}
                    {smartData.materials?.parts && smartData.materials.parts.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h4 className="text-sm font-black text-slate-700 uppercase mb-4">Listado de Recambios Detectados</h4>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-slate-500 font-bold uppercase border-b">
                                        <tr>
                                            <th className="text-left py-2 px-3">Descripción</th>
                                            <th className="text-center py-2 px-3">Cantidad</th>
                                            <th className="text-right py-2 px-3">Precio Unit.</th>
                                            <th className="text-right py-2 px-3">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {smartData.materials.parts.map((part: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="py-2 px-3 font-medium text-slate-700">{part.description || part.name || 'Sin descripción'}</td>
                                                <td className="py-2 px-3 text-center text-slate-600">{part.quantity || 1}</td>
                                                <td className="py-2 px-3 text-right text-slate-600">{fmt(part.unit_price || 0)}</td>
                                                <td className="py-2 px-3 text-right font-bold text-slate-900">{fmt((part.quantity || 1) * (part.unit_price || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!selectedJobId ? (
                <div className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-24 text-center text-slate-300">
                    <svg className="w-20 h-20 mx-auto mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <h2 className="text-xl font-black uppercase tracking-[0.3em]">Elija un archivo para auditar</h2>
                    <p className="mt-2 font-medium">Seleccione una reparación finalizada del desplegable para iniciar el análisis.</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Spinner de Análisis */}
                    {isAnalyzing && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center rounded-[32px] animate-fade-in">
                            <div className="relative w-24 h-24">
                                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-brand-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-brand-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                            </div>
                            <p className="mt-6 text-slate-900 font-black uppercase tracking-[0.2em] text-sm">Escaneo de Rentabilidad...</p>
                            <p className="mt-1 text-slate-400 text-xs font-bold">Contrastando datos de peritación con registros de taller</p>
                        </div>
                    )}

                    <div id="analytics-report" className="space-y-8 animate-fade-in-up bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">

                        {/* Banner de Identificación - Matching Sample Header */}
                        <div className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">AUDIT STATUS: FINISHED</span>
                                    <span className="text-slate-300 font-light">|</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">REPORT GENERATED: {new Date().toLocaleDateString()}</span>
                                </div>
                                <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight mb-2">
                                    {selectedJob?.insuredName || 'Victor Afe'}
                                </h2>
                                <p className="text-slate-400 font-bold text-xl uppercase tracking-tighter">
                                    {selectedJob?.vehicle || 'UNKNOWN VEHICLE'} • <span className="text-slate-300">{selectedJob?.plate || '267823'}</span>
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">EXPEDIENTE IDENTIFIER</span>
                                <p className="font-mono font-black text-3xl text-brand-600 bg-brand-50/50 px-6 py-3 rounded-2xl border border-brand-100/50 shadow-inner">
                                    {selectedJob?.expedienteId || 'WO-2025-1543'}
                                </p>
                            </div>
                        </div>

                        {/* Fila 1: Tarjetas KPI - Matching Sample Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <KPICard
                                loading={isAnalyzing}
                                title="PAGO ASEGURADORA"
                                value={smartData ? fmt(smartData.financials.total_gross) : '--- €'}
                                subtitle="Total Factura (Inc. IVA)"
                                color="blue"
                            />
                            <KPICard
                                loading={isAnalyzing}
                                title="COSTE REAL TALLER"
                                value={fmt(realLaborCost)}
                                subtitle="Coste Laboral (Logs)"
                                trend="Log Tiempos"
                                color="orange"
                            />
                            <KPICard
                                loading={isAnalyzing}
                                title="BENEFICIO (PROFIT)"
                                value={smartData ? fmt(valuedTotal - realLaborCost) : "--- €"}
                                subtitle="Pago Neto - Coste Real"
                                color="emerald"
                                trend={smartData ? ((valuedTotal - realLaborCost) > 0 ? "+Ganancia" : "-Pérdida") : ""}
                            />
                        </div>

                        {/* Fila 2: Desglose de Márgenes - Matching Sample Section */}
                        <div className="space-y-6 pt-4">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                                DESGLOSE DE MÁRGENES Y BENEFICIOS
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <MarginCard
                                    label="BENEFICIO MEDIO / HORA"
                                    value={smartData ? fmt(valuedLabor - realLaborCost) : '802,00 €'}
                                    subtitle="NETO GANADO EN MANO DE OBRA"
                                    colorClass="border-l-emerald-500"
                                />
                                <MarginCard
                                    label="MARGEN MATERIALES"
                                    value={smartData ? "22.0 %" : "22.0 %"}
                                    subtitle="BENEFICIO SOBRE RECAMBIOS"
                                    colorClass="border-l-blue-500"
                                />
                                <MarginCard
                                    label="MARGEN MO PINTURA"
                                    value={smartData ? "45.20 €/h" : "45.20 €/h"}
                                    subtitle="RENTABILIDAD CABINA"
                                    colorClass="border-l-purple-500"
                                />
                                <MarginCard
                                    label="MARGEN MAT. PINTURA"
                                    value={smartData ? "35.0 %" : "35.0 %"}
                                    subtitle="BENEFICIO ANEXOS Y PINTURA"
                                    colorClass="border-l-orange-500"
                                />
                            </div>
                        </div>

                        {/* Fila 3: Gráficos - Matching Sample Chart Styles */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-4">
                            {/* Gráfico de Área Valorado vs Coste Real */}
                            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-10">
                                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest leading-relaxed max-w-[200px]">
                                        EVOLUCIÓN MENSUAL: VALORADO VS COSTE REAL
                                    </h3>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-black tracking-widest">MARKET TREND</span>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                        <AreaChart data={MOCK_MONTHLY_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3676b2" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3676b2" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Legend iconType="circle" align="right" verticalAlign="bottom" wrapperStyle={{ paddingTop: '30px', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                            <Area type="monotone" dataKey="Valorado" stroke="#3676b2" fillOpacity={1} fill="url(#colorVal)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                                            <Area type="monotone" dataKey="CosteReal" name="Coste Real" stroke="#94a3b8" fillOpacity={1} fill="url(#colorCost)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Gráfico de Barras de Eficacia */}
                            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-10">
                                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest leading-relaxed max-w-[200px]">
                                        EFICACIA PRODUCTIVA POR SECCIÓN
                                    </h3>
                                    <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-black tracking-widest">OPERATIONS</span>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                        <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" domain={[0, 100]} hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fill: '#1e293b', fontWeight: 900, fontSize: 11 }} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                            <Bar dataKey="eficiencia" name="Eficacia %" fill="#3676b2" radius={[0, 8, 8, 0]} barSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Detalle Final - Matching Sample Table */}
                        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden pt-4">
                            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">DETALLE POR EXPEDIENTE (AUDITADO)</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest underline decoration-brand-500 decoration-2 underline-offset-4">FILE REF: {selectedJob?.expedienteId || 'WO-2025-1543'}</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto px-2">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-400 font-black uppercase border-b border-slate-100">
                                        <tr>
                                            <th className="px-10 py-6">CONCEPTO</th>
                                            <th className="px-10 py-6">TOTAL VALORADO</th>
                                            <th className="px-10 py-6">COSTE REAL</th>
                                            <th className="px-10 py-6">MARGEN €</th>
                                            <th className="px-10 py-6 text-center">MARGEN %</th>
                                            <th className="px-10 py-6 text-center">H. FACTURADAS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        <tr className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-10 py-8 font-black text-slate-900 text-base">{selectedJob?.expedienteId || 'WO-2025-1543'}</td>
                                            <td className="px-10 py-8 font-black text-slate-900 text-base">{smartData ? fmt(valuedTotal) : '3084,79 €'}</td>
                                            <td className="px-10 py-8 text-slate-500 font-bold">{smartData ? fmt(estimatedRealCost) : '1402,08 €'}</td>
                                            <td className={`px-10 py-8 font-black text-base ${netBenefit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {smartData ? `${netBenefit >= 0 ? '+' : ''}${fmt(netBenefit)}` : '+1682,71 €'}
                                            </td>
                                            <td className="px-10 py-8 text-center text-base">
                                                <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase ${marginPercentage >= 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                                                    {smartData ? `${marginPercentage.toFixed(1)}%` : '54.5%'}
                                                </span>
                                            </td>
                                            <td className="px-10 py-8 text-center text-slate-700 font-black text-base">
                                                {smartData?.financials?.labor_hours || '20.05'} h
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tarjeta de Comentarios Intelligence */}
                        {smartData && (
                            <div className="bg-slate-900 text-white p-12 rounded-[48px] shadow-2xl relative overflow-hidden border-b-[12px] border-brand-500 mt-6">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                </div>
                                <div className="relative z-10 max-w-4xl">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-10 h-10 bg-brand-500 rounded-2xl flex items-center justify-center text-white">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <h3 className="text-brand-400 font-black uppercase text-xs tracking-[0.4em]">valora ai audit intelligence</h3>
                                    </div>
                                    <p className="text-3xl font-medium leading-tight italic text-slate-100 mb-10">"{smartData.analysis?.summary || 'El análisis indica una rentabilidad estándar para esta clase de reparación.'}"</p>

                                    <div className="flex flex-wrap gap-6">
                                        <div className="bg-white/5 border border-white/10 px-8 py-5 rounded-3xl backdrop-blur-md">
                                            <span className="text-[10px] text-slate-500 uppercase font-black block mb-2 tracking-widest">PROFITABILITY SCORE</span>
                                            <span className={`text-2xl font-black ${smartData.analysis?.profitability_rating === 'High' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                                {smartData.analysis?.profitability_rating === 'High' ? 'OPTIMAL' : smartData.analysis?.profitability_rating === 'Medium' ? 'STABLE' : 'RISK'}
                                            </span>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 px-8 py-5 rounded-3xl backdrop-blur-md">
                                            <span className="text-[10px] text-slate-500 uppercase font-black block mb-2 tracking-widest">DATA CONFIDENCE</span>
                                            <div className="flex items-end gap-2">
                                                <span className="text-3xl font-black text-slate-100">{smartData.metadata?.confidence_score || '98'}</span>
                                                <span className="text-sm font-bold text-slate-500 mb-1.5">%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


export default Analytics;
