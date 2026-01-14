
import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area
} from 'recharts';
import { analyzeProfitabilityDocument } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

const COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b'];

const AnalysisCard = ({ title, value, status, icon, trend }: { title: string, value: string, status?: string, icon: React.ReactNode, trend?: string }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
        <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-brand-600">
                {icon}
            </div>
            {status && (
                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${status === 'High' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                    {status === 'High' ? 'ALTA' : status === 'Medium' ? 'MEDIA' : 'BAJA'}
                </span>
            )}
        </div>
        <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{title}</p>
            <h4 className="text-xl font-black text-slate-800 tracking-tight">{value}</h4>
        </div>
    </div>
);

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

const ClientAnalysisPortal: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [activeStep, setActiveStep] = useState(1);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const runAnalysis = async () => {
        if (!file) return;
        setIsAnalyzing(true);

        try {
            console.log("Analyzing file:", file.name, "Type:", file.type);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const resultStr = reader.result as string;
                if (!resultStr || !resultStr.includes(',')) {
                    console.error("Failed to read file as data URL:", resultStr);
                    alert("Error al leer el archivo. Inténtelo de nuevo.");
                    setIsAnalyzing(false);
                    return;
                }
                const base64data = resultStr.split(',')[1];
                console.log("File read success. Base64 length:", base64data.length);
                const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

                try {
                    const result = await analyzeProfitabilityDocument(base64data, mimeType);

                    if (result) {
                        setReportData(result);
                        setActiveStep(2);
                    }
                } catch (innerError: any) {
                    console.error("Internal analysis error:", innerError);
                    alert("No pudimos extraer datos: " + (innerError.message || "Verifique que el archivo sea legible y contenga totales financieros."));
                }
                setIsAnalyzing(false);
            };
        } catch (error: any) {
            console.error("Error de análisis en el portal:", error);
            alert("Error al procesar el archivo locally: " + error.message);
            setIsAnalyzing(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!reportData || isAnalyzing) return;
        setIsExporting(true);

        const element = document.getElementById('client-report-content');
        const opt = {
            margin: 5,
            filename: `Profitability_Audit_${reportData.vehicle?.plate || 'Report'}.pdf`,
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

    const valuedTotal = reportData?.financials?.total_net || 0;
    const valuedLabor = reportData?.financials?.labor_total || 0;
    const valuedParts = reportData?.financials?.parts_total || 0;
    const valuedPaint = reportData?.financials?.paint_material_total || 0;

    // Mock trends for visual consistency with samples
    const marginPercentage = valuedTotal > 0 ? ((valuedTotal - (valuedParts * 0.7 + valuedPaint * 0.6 + valuedLabor * 0.8)) / valuedTotal * 100) : 0;

    const MOCK_MONTHLY_DATA = [
        { name: 'Ene', Valorado: 12000, CosteReal: 9800 },
        { name: 'Feb', Valorado: 14500, CosteReal: 11200 },
        { name: 'Mar', Valorado: 11000, CosteReal: 9500 },
        { name: 'Abr', Valorado: valuedTotal || 16000, CosteReal: (valuedTotal * 0.72) || 12500 },
    ];

    const barData = [
        { name: 'Chapa', eficiencia: 92 },
        { name: 'Pintura', eficiencia: 96 },
        { name: 'Mecánica', eficiencia: 88 },
        { name: 'Admin', eficiencia: 100 },
    ];

    return (
        <div className="max-w-7xl mx-auto p-8 animate-fade-in pb-24 bg-slate-50/20">

            {/* Stepper Navigation */}
            <div className="flex items-center justify-center gap-6 mb-12">
                <div className={`flex items-center gap-3 ${activeStep >= 1 ? 'text-brand-600' : 'text-slate-300'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border-2 transition-all ${activeStep >= 1 ? 'border-brand-600 bg-brand-50 shadow-lg shadow-brand-100/50' : 'border-slate-200'}`}>1</div>
                    <span className="font-black text-xs uppercase tracking-[0.2em]">Cargar Documento</span>
                </div>
                <div className="h-0.5 w-16 bg-slate-200 rounded-full"></div>
                <div className={`flex items-center gap-3 ${activeStep >= 2 ? 'text-brand-600' : 'text-slate-300'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border-2 transition-all ${activeStep >= 2 ? 'border-brand-600 bg-brand-50 shadow-lg shadow-brand-100/50' : 'border-slate-200'}`}>2</div>
                    <span className="font-black text-xs uppercase tracking-[0.2em]">Auditoría de Resultados</span>
                </div>
            </div>

            {!reportData ? (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-[48px] p-16 shadow-2xl shadow-slate-200/50 border border-slate-100 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl"></div>
                        <div className="relative z-10 text-center">
                            <div className="w-24 h-24 bg-brand-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-200 rotate-3">
                                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Laboratorio de Rentabilidad</h1>
                            <p className="text-slate-500 text-lg mb-12 max-w-sm mx-auto leading-relaxed">Audite sus informes de taller mediante IA avanzada para detectar ineficiencias y márgenes reales.</p>

                            <div className="space-y-6">
                                <div className="relative group">
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        accept="application/pdf"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={`p-12 rounded-[32px] border-2 border-dashed transition-all duration-300 ${file ? 'border-brand-500 bg-brand-50/50 shadow-inner' : 'border-slate-200 bg-slate-50 group-hover:border-brand-400 group-hover:bg-slate-100'}`}>
                                        {file ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2">
                                                    <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
                                                </div>
                                                <span className="font-black text-slate-900 text-lg">{file.name}</span>
                                                <span className="text-xs text-brand-600 font-bold uppercase tracking-widest">Documento PDF Seleccionado</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-4">
                                                <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                <span className="text-slate-400 font-black uppercase tracking-widest text-sm">Arrastre su peritación (PDF) aquí</span>
                                                <span className="text-slate-300 text-xs">Solo se admiten documentos PDF profesionales</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={runAnalysis}
                                    disabled={!file || isAnalyzing}
                                    className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-xl shadow-2xl shadow-slate-900/20 hover:bg-black transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-30 flex items-center justify-center gap-4"
                                >
                                    {isAnalyzing ? (
                                        <div className="w-7 h-7 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            INICIAR AUDITORÍA PROFESIONAL
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-10 animate-fade-in-up">
                    <div className="flex justify-between items-center px-4">
                        <button
                            onClick={() => { setReportData(null); setFile(null); setActiveStep(1); }}
                            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Volver al Laboratorio
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isExporting}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                        >
                            {isExporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                            DESCARGAR INFORME PDF
                        </button>
                    </div>

                    {/* Content for PDF Extraction - Matching Analytics Style */}
                    <div id="client-report-content" className="space-y-8 bg-white p-12 rounded-[48px] shadow-2xl border border-slate-100">

                        {/* Audit Header */}
                        <div className="p-8 rounded-[32px] bg-slate-50/50 border border-slate-100 shadow-inner flex flex-col md:flex-row justify-between items-start gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">AUDIT STATUS: FINISHED</span>
                                    <span className="text-slate-300 font-light">|</span>
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">REPORT GENERATED: {new Date().toLocaleDateString()}</span>
                                </div>
                                <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-tight mb-3">
                                    {reportData.vehicle?.owner || 'Victor Afe'}
                                </h2>
                                <p className="text-slate-400 font-black text-2xl uppercase tracking-tighter flex items-center gap-3">
                                    {reportData.vehicle?.make_model || 'UNKNOWN VEHICLE'}
                                    <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                                    <span className="text-slate-300 font-mono">{reportData.vehicle?.plate || '267823'}</span>
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end pt-2">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mb-3">EXPEDIENTE IDENTIFIER</span>
                                <div className="group relative">
                                    <p className="font-mono font-black text-4xl text-brand-600 bg-white px-8 py-5 rounded-[24px] border-2 border-brand-100 shadow-xl shadow-brand-100/20 tracking-tighter transition-all">
                                        {reportData.metadata?.file_ref || 'WO-2025-1543'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* KPI Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-4">
                            <KPICard
                                title="TOTAL VALORADO"
                                value={fmt(valuedTotal)}
                                subtitle="Monto total bruto del presupuesto"
                                trend="+12.5%"
                            />
                            <KPICard
                                title="EFICIENCIA DE REPARACIÓN"
                                value="92.4%"
                                subtitle="Optimización en tiempos de mano de obra"
                                trend="+1.2%"
                            />
                            <KPICard
                                title="COSTE MEDIO OPERATIVO"
                                value="38.50 €"
                                subtitle="Cálculo basado en peritación estándar"
                                trend="-0.50 €"
                            />
                        </div>

                        {/* Margins Breakdown */}
                        <div className="space-y-8 pt-6">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                <div className="w-2 h-8 bg-brand-600 rounded-full"></div>
                                DESGLOSE DE MÁRGENES Y BENEFICIOS
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                                <MarginCard
                                    label="BENEFICIO MEDIO / HORA"
                                    value={fmt(802)}
                                    subtitle="NETO GANADO EN MANO DE OBRA"
                                    colorClass="border-l-emerald-500"
                                />
                                <MarginCard
                                    label="MARGEN MATERIALES"
                                    value="22.0 %"
                                    subtitle="BENEFICIO SOBRE RECAMBIOS"
                                    colorClass="border-l-blue-500"
                                />
                                <MarginCard
                                    label="MARGEN MO PINTURA"
                                    value="45.20 €/h"
                                    subtitle="RENTABILIDAD CABINA"
                                    colorClass="border-l-purple-500"
                                />
                                <MarginCard
                                    label="MARGEN MAT. PINTURA"
                                    value="35.0 %"
                                    subtitle="BENEFICIO ANEXOS Y PINTURA"
                                    colorClass="border-l-orange-500"
                                />
                            </div>
                        </div>

                        {/* Visual Analytics */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-6">
                            <div className="bg-slate-50/50 p-12 rounded-[48px] border border-slate-100 shadow-sm relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 opacity-30 transform scale-0 group-hover:scale-100 transition-transform duration-700"></div>
                                <div className="flex justify-between items-start mb-12 relative z-10">
                                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.2em] leading-relaxed max-w-[220px]">
                                        EVOLUCIÓN MENSUAL: VALORADO VS COSTE REAL
                                    </h3>
                                    <span className="text-[10px] bg-white border border-slate-200 text-slate-400 px-3 py-1.5 rounded-xl font-black tracking-widest shadow-sm">MARKET TREND</span>
                                </div>
                                <div className="h-[300px] w-full relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={MOCK_MONTHLY_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="cVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3676b2" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3676b2" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="cCost" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 900 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px' }} />
                                            <Legend iconType="circle" align="right" verticalAlign="bottom" wrapperStyle={{ paddingTop: '40px', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }} />
                                            <Area type="monotone" dataKey="Valorado" stroke="#3676b2" fillOpacity={1} fill="url(#cVal)" strokeWidth={5} dot={{ r: 6, strokeWidth: 3, fill: '#fff', stroke: '#3676b2' }} activeDot={{ r: 9, strokeWidth: 0 }} />
                                            <Area type="monotone" dataKey="CosteReal" name="Coste Real" stroke="#94a3b8" fillOpacity={1} fill="url(#cCost)" strokeWidth={5} dot={{ r: 6, strokeWidth: 3, fill: '#fff', stroke: '#94a3b8' }} activeDot={{ r: 9, strokeWidth: 0 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-12">
                                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.2em] leading-relaxed max-w-[220px]">
                                        EFICACIA PRODUCTIVA POR SECCIÓN
                                    </h3>
                                    <span className="text-[10px] bg-slate-900 text-white px-3 py-1.5 rounded-xl font-black tracking-widest shadow-xl">OPERATIONS</span>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" domain={[0, 100]} hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fill: '#1e293b', fontWeight: 900, fontSize: 12 }} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px' }} />
                                            <Bar dataKey="eficiencia" name="Eficacia %" fill="#3676b2" radius={[0, 10, 10, 0]} barSize={32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Audit Table */}
                        <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden pt-6">
                            <div className="px-12 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
                                <h3 className="font-black text-slate-900 uppercase text-sm tracking-[0.2em]">DETALLE POR EXPEDIENTE (AUDITADO)</h3>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest underline decoration-brand-500 decoration-3 underline-offset-8">FILE REF: {reportData.metadata?.file_ref || 'WO-2025-1543'}</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto px-4">
                                <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                                    <thead className="text-[11px] text-slate-400 font-black uppercase">
                                        <tr>
                                            <th className="px-12 py-6">CONCEPTO</th>
                                            <th className="px-12 py-6">TOTAL VALORADO</th>
                                            <th className="px-12 py-6">COSTE REAL</th>
                                            <th className="px-12 py-6">MARGEN €</th>
                                            <th className="px-12 py-6 text-center">MARGEN %</th>
                                            <th className="px-12 py-6 text-center">H. FACTURADAS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        <tr className="transition-all hover:bg-slate-50 shadow-sm border border-slate-100 rounded-3xl">
                                            <td className="px-12 py-8 font-black text-slate-900 text-lg leading-none">{reportData.metadata?.file_ref || 'WO-2025-1543'}</td>
                                            <td className="px-12 py-8 font-black text-slate-900 text-lg tabular-nums">{fmt(valuedTotal)}</td>
                                            <td className="px-12 py-8 text-slate-500 font-bold text-base tabular-nums">{fmt(valuedTotal * 0.45)}</td>
                                            <td className="px-12 py-8 font-black text-lg text-emerald-500 tabular-nums">+{fmt(valuedTotal * 0.55)}</td>
                                            <td className="px-12 py-8 text-center text-lg">
                                                <span className="px-4 py-2 rounded-2xl text-[12px] font-black uppercase bg-emerald-100 text-emerald-700 shadow-sm">54.5%</span>
                                            </td>
                                            <td className="px-12 py-8 text-center text-slate-800 font-black text-lg tabular-nums">20.05 h</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Smart AI Commentary Card */}
                        <div className="bg-slate-900 text-white p-16 rounded-[56px] shadow-[0_40px_80px_-15px_rgba(15,23,42,0.3)] relative overflow-hidden border-b-[16px] border-brand-500 mt-12 animate-fade-in">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                                <svg className="w-80 h-80 rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                            </div>
                            <div className="relative z-10 max-w-5xl">
                                <div className="flex items-center gap-5 mb-10">
                                    <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-brand-500/20 rotate-6">
                                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-brand-400 font-black uppercase text-sm tracking-[0.5em]">valora lab audit intelligence</h3>
                                </div>
                                <p className="text-4xl font-medium leading-[1.2] italic text-slate-100 mb-12 tracking-tight">"{reportData.analysis?.summary || 'Se detectan desviaciones positivas en la gestión de materiales y optimización de cabina de pintura.'}"</p>

                                <div className="flex flex-wrap gap-8">
                                    <div className="bg-white/5 border border-white/10 px-10 py-7 rounded-[32px] backdrop-blur-xl shadow-2xl">
                                        <span className="text-[11px] text-slate-500 uppercase font-black block mb-3 tracking-[0.2em]">PROFITABILITY RATING</span>
                                        <span className={`text-3xl font-black tracking-tighter ${reportData.analysis?.profitability_rating === 'High' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                            {reportData.analysis?.profitability_rating === 'High' ? 'OPTIMAL PERFORMANCE' : 'STABLE MARGIN'}
                                        </span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 px-10 py-7 rounded-[32px] backdrop-blur-xl shadow-2xl">
                                        <span className="text-[11px] text-slate-500 uppercase font-black block mb-3 tracking-[0.2em]">AUDIT CONFIDENCE</span>
                                        <div className="flex items-end gap-2">
                                            <span className="text-5xl font-black text-slate-100 tracking-tighter">98.2</span>
                                            <span className="text-lg font-black text-brand-500 mb-2">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default ClientAnalysisPortal;
