
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Calculator, AlertCircle, DollarSign } from "lucide-react";

const WorkshopCosts = ({ onNext, onBack }: { onNext: () => void, onBack: () => void }) => {
    const { toast } = useToast();

    const [costs, setCosts] = useState({
        repuestos_compra: "",
        mo_chapa_horas_reales: "",
        mo_chapa_coste_hora: "",
        mo_pintura_horas_reales: "",
        mo_pintura_coste_hora: "",
        consumibles_pintura: "",
        subcontratas: "",
        otros_costes: "",
        notas: ""
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleInputChange = (field: string, value: string) => {
        setCosts(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        const requiredFields = [
            'repuestos_compra',
            'mo_chapa_horas_reales',
            'mo_chapa_coste_hora',
            'mo_pintura_horas_reales',
            'mo_pintura_coste_hora',
            'consumibles_pintura'
        ];

        requiredFields.forEach(field => {
            const val = costs[field as keyof typeof costs];
            if (!val || parseFloat(val) < 0) {
                newErrors[field] = "Obligatorio";
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const calculateTotal = () => {
        const repuestos = parseFloat(costs.repuestos_compra) || 0;
        const mo_chapa = (parseFloat(costs.mo_chapa_horas_reales) || 0) * (parseFloat(costs.mo_chapa_coste_hora) || 0);
        const mo_pintura = (parseFloat(costs.mo_pintura_horas_reales) || 0) * (parseFloat(costs.mo_pintura_coste_hora) || 0);
        const consumibles = parseFloat(costs.consumibles_pintura) || 0;
        const subcontratas = parseFloat(costs.subcontratas) || 0;
        const otros = parseFloat(costs.otros_costes) || 0;

        return repuestos + mo_chapa + mo_pintura + consumibles + subcontratas + otros;
    };

    const formatCurrency = (value: number | string) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return isNaN(num) ? "0,00 €" : num.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' €';
    };

    const handleCalculate = () => {
        if (!validateForm()) {
            toast({
                title: "Errores en el formulario",
                description: "Por favor, completa los campos marcados.",
                variant: "destructive"
            });
            return;
        }
        onNext();
    };

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8 px-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Costes Reales del Taller</h1>
                    <p className="text-lg text-slate-500">Introduce los costes reales para este expediente</p>
                </div>
                <Button variant="outline" onClick={onBack} className="border-slate-200">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Atrás
                </Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-100 shadow-sm">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="flex items-center gap-2 text-slate-800">
                                <DollarSign className="h-5 w-5 text-brand-600" />
                                <span>Repuestos y Materiales</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div>
                                <Label htmlFor="repuestos_compra" className="text-slate-700 font-bold mb-2 block">Coste real de compra (€)</Label>
                                <Input
                                    id="repuestos_compra"
                                    type="number"
                                    placeholder="0.00"
                                    value={costs.repuestos_compra}
                                    onChange={(e) => handleInputChange('repuestos_compra', e.target.value)}
                                    className={errors.repuestos_compra ? "border-red-500 bg-red-50" : "border-slate-200 focus:border-brand-500"}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-100 shadow-sm">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="text-slate-800">Mano de Obra - Chapa</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="mo_chapa_horas_reales" className="text-slate-700 font-bold mb-2 block">Horas reales</Label>
                                    <Input
                                        id="mo_chapa_horas_reales"
                                        type="number"
                                        value={costs.mo_chapa_horas_reales}
                                        onChange={(e) => handleInputChange('mo_chapa_horas_reales', e.target.value)}
                                        className={errors.mo_chapa_horas_reales ? "border-red-500" : "border-slate-200"}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="mo_chapa_coste_hora" className="text-slate-700 font-bold mb-2 block">Coste/Hora (€)</Label>
                                    <Input
                                        id="mo_chapa_coste_hora"
                                        type="number"
                                        value={costs.mo_chapa_coste_hora}
                                        onChange={(e) => handleInputChange('mo_chapa_coste_hora', e.target.value)}
                                        className={errors.mo_chapa_coste_hora ? "border-red-500" : "border-slate-200"}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-100 shadow-sm">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="text-slate-800">Mano de Obra - Pintura</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="mo_pintura_horas_reales" className="text-slate-700 font-bold mb-2 block">Horas reales</Label>
                                    <Input
                                        id="mo_pintura_horas_reales"
                                        type="number"
                                        value={costs.mo_pintura_horas_reales}
                                        onChange={(e) => handleInputChange('mo_pintura_horas_reales', e.target.value)}
                                        className={errors.mo_pintura_horas_reales ? "border-red-500" : "border-slate-200"}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="mo_pintura_coste_hora" className="text-slate-700 font-bold mb-2 block">Coste/Hora (€)</Label>
                                    <Input
                                        id="mo_pintura_coste_hora"
                                        type="number"
                                        value={costs.mo_pintura_coste_hora}
                                        onChange={(e) => handleInputChange('mo_pintura_coste_hora', e.target.value)}
                                        className={errors.mo_pintura_coste_hora ? "border-red-500" : "border-slate-200"}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-100 shadow-sm">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="text-slate-800">Insumos y Adicionales</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="consumibles_pintura" className="text-slate-700 font-bold mb-2 block">Consumibles Pintura (€)</Label>
                                <Input
                                    id="consumibles_pintura"
                                    type="number"
                                    value={costs.consumibles_pintura}
                                    onChange={(e) => handleInputChange('consumibles_pintura', e.target.value)}
                                    className={errors.consumibles_pintura ? "border-red-500" : "border-slate-200"}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="subcontratas" className="text-slate-700 font-bold mb-2 block">Subcontratas (€)</Label>
                                    <Input id="subcontratas" type="number" value={costs.subcontratas} onChange={(e) => handleInputChange('subcontratas', e.target.value)} className="border-slate-200" />
                                </div>
                                <div>
                                    <Label htmlFor="otros_costes" className="text-slate-700 font-bold mb-2 block">Otros (€)</Label>
                                    <Input id="otros_costes" type="number" value={costs.otros_costes} onChange={(e) => handleInputChange('otros_costes', e.target.value)} className="border-slate-200" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="notas" className="text-slate-700 font-bold mb-2 block">Notas adicionales</Label>
                                <Textarea id="notas" value={costs.notas} onChange={(e) => handleInputChange('notas', e.target.value)} className="border-slate-200" placeholder="Añade cualquier observación relevante..." />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="sticky top-8 border-brand-100 shadow-xl shadow-brand-50 bg-white">
                        <CardHeader className="bg-brand-600 text-white rounded-t-xl">
                            <CardTitle className="flex items-center gap-2">
                                <Calculator className="h-5 w-5" />
                                <span>Resumen Operativo</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Repuestos:</span>
                                    <span className="font-bold text-slate-800">{formatCurrency(costs.repuestos_compra)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">M.O. Chapa:</span>
                                    <span className="font-bold text-slate-800">
                                        {formatCurrency((parseFloat(costs.mo_chapa_horas_reales) || 0) * (parseFloat(costs.mo_chapa_coste_hora) || 0))}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">M.O. Pintura:</span>
                                    <span className="font-bold text-slate-800">
                                        {formatCurrency((parseFloat(costs.mo_pintura_horas_reales) || 0) * (parseFloat(costs.mo_pintura_coste_hora) || 0))}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-slate-50 pt-3">
                                    <span className="text-slate-500">Insumos/Varios:</span>
                                    <span className="font-bold text-slate-800">
                                        {formatCurrency((parseFloat(costs.consumibles_pintura) || 0) + (parseFloat(costs.subcontratas) || 0) + (parseFloat(costs.otros_costes) || 0))}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-xs text-slate-400 font-black uppercase mb-1 tracking-widest">Total Costes Reales</p>
                                <p className="text-4xl font-black text-brand-700 tracking-tighter">{formatCurrency(calculateTotal())}</p>
                            </div>

                            <Button
                                onClick={handleCalculate}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-8 rounded-2xl shadow-xl shadow-brand-200 transition-all text-lg"
                            >
                                CALCULAR RENTABILIDAD
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>

                            <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <AlertCircle className="h-4 w-4 text-brand-400 mt-0.5" />
                                <p>Asegúrate de incluir todos los costes directos para un cálculo preciso del margen real.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default WorkshopCosts;
