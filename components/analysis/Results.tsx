
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import { ArrowLeft, Download, Share2, TrendingUp, TrendingDown, Target, Zap, Clock } from "lucide-react";

interface ResultsProps {
    onBack: () => void;
}

const Results: React.FC<ResultsProps> = ({ onBack }) => {
    // Semi-mocked data based on the verification and workshop costs steps
    const summaryData = {
        ingresos_aseguradora: 4644.71,
        costes_reales: 3422.50,
        margen_bruto: 1222.21,
        porcentaje_margen: 26.3,
        rating: "Bueno",
        ratingColor: "text-emerald-500 bg-emerald-50",
    };

    const costBreakdown = [
        { name: "Repuestos", value: 942.16, color: "#3b82f6" },
        { name: "M.O. Chapa", value: 1681.50, color: "#10b981" },
        { name: "M.O. Pintura", value: 1251.10, color: "#f59e0b" },
    ];

    const comparisonData = [
        { name: "Aseguradora", valor: 4644.71 },
        { name: "Coste Real", valor: 3422.50 },
        { name: "Margen", valor: 1222.21 },
    ];

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8 px-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Informe de Rentabilidad Real</h1>
                    <p className="text-lg text-slate-500 font-medium">Análisis final del expediente Jaguar XF (5654LGR)</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={onBack} className="border-slate-200">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Atrás
                    </Button>
                    <Button variant="outline" className="border-slate-200">
                        <Share2 className="mr-2 h-4 w-4" />
                        Compartir
                    </Button>
                    <Button className="bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-200">
                        <Download className="mr-2 h-4 w-4" />
                        Descargar Informe
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 px-4">
                <Card className="border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="text-[10px] font-black uppercase text-blue-600 border-blue-100">Ingresos</Badge>
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Ingresos</p>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(summaryData.ingresos_aseguradora)}</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="text-[10px] font-black uppercase text-red-600 border-red-100">Costes</Badge>
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Costes</p>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(summaryData.costes_reales)}</p>
                    </CardContent>
                </Card>

                <Card className="border-brand-100 shadow-xl shadow-brand-50 bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                                <Target className="h-5 w-5" />
                            </div>
                            <Badge className="bg-brand-600 text-white text-[10px] font-black uppercase border-none">Margen Bruto</Badge>
                        </div>
                        <p className="text-sm font-bold text-brand-400 uppercase tracking-widest mb-1">Rentabilidad</p>
                        <p className="text-2xl font-black text-brand-700">{formatCurrency(summaryData.margen_bruto)}</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${summaryData.ratingColor}`}>
                            <Zap className="h-4 w-4" />
                            <span className="font-bold uppercase text-xs tracking-widest">{summaryData.rating}</span>
                        </div>
                        <p className="text-5xl font-black text-slate-900 mb-1">{summaryData.porcentaje_margen}%</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Margen sobre venta</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 px-4 mb-8">
                <Card className="border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800">Comparativa Global</CardTitle>
                        <CardDescription>Aseguradora vs Coste Real vs Margen</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={60}>
                                    {comparisonData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 2 ? '#4f46e5' : index === 0 ? '#3b82f6' : '#cbd5e1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800">Estructura de Costes</CardTitle>
                        <CardDescription>Distribución porcentual de los costes reales</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={costBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {costBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-4 pr-8">
                            {costBreakdown.map((entry, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{entry.name}</span>
                                    <span className="text-sm font-black text-slate-900 ml-auto">{formatCurrency(entry.value)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="px-4">
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-none shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <CardContent className="p-10 relative z-10">
                        <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center shrink-0 shadow-xl shadow-brand-500/20">
                                <Zap className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Análisis Ejecutivo AI</h3>
                                <div className="space-y-4 text-slate-300 font-medium leading-relaxed max-w-4xl">
                                    <p>
                                        El expediente presenta una <span className="text-emerald-400 font-black italic">rentabilidad bruta del 26.3%</span>.
                                        Este margen está 4 puntos por encima de la media de tu taller para esta aseguradora.
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-8 mt-6">
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                                                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Puntos Fuertes</span>
                                            </div>
                                            <p className="text-sm">Optimización excelente en la compra de repuestos (32% de descuento medio). La eficiencia en chapa ha sido del 105% respecto al baremo.</p>
                                        </div>
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Clock className="h-4 w-4 text-amber-400" />
                                                <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Oportunidad</span>
                                            </div>
                                            <p className="text-sm">El tiempo de materiales de pintura es ligeramente superior a lo estimado. Revisa la dosificación para maximizar el margen de pintura.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Results;
