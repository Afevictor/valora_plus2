
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

const Verification = ({ onNext, onBack, caseId, extracted }: { onNext: () => void, onBack: () => void, caseId: string, extracted?: any }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [confidence] = useState(0.95);

    // Initial mock data as fallback
    const [extractedData, setExtractedData] = useState({
        metadata: {
            matricula: "2117FSM",
            bastidor: "WDD2040081A032770",
            fabricante: "MERCEDES-BENZ",
            modelo: "C Berlina (BM 204)",
            fecha: "2025-11-07",
            referencia: "EXP253651",
            sistema: "SILVERDAT",
            precio_hora: "40.00"
        },
        totales: {
            repuestos_total: "324.09",
            mo_chapa_ut: "20.05",
            mo_chapa_eur: "802.00",
            mo_pintura_ut: "23.65",
            mo_pintura_eur: "946.00",
            mat_pintura_eur: "1012.70",
            subtotal_neto: "3084.79",
            iva: "647.81",
            total_con_iva: "3732.60"
        }
    });

    useEffect(() => {
        if (extracted && extracted.success) {
            setExtractedData({
                metadata: {
                    matricula: extracted.vehicle.plate || "S/D",
                    bastidor: extracted.vehicle.vin || "S/D",
                    fabricante: extracted.vehicle.brand || "S/D",
                    modelo: extracted.vehicle.make_model || "S/D",
                    fecha: new Date().toISOString().split('T')[0],
                    referencia: "EXTRACTED",
                    sistema: "AUTO",
                    precio_hora: "40.00"
                },
                totales: {
                    repuestos_total: extracted.financials.parts_total?.toString() || "0",
                    mo_chapa_ut: "0",
                    mo_chapa_eur: extracted.financials.labor_total?.toString() || "0",
                    mo_pintura_ut: "0",
                    mo_pintura_eur: extracted.financials.paint_labor?.toString() || "0",
                    mat_pintura_eur: extracted.financials.paint_material?.toString() || "0",
                    subtotal_neto: extracted.financials.total_net?.toString() || "0",
                    iva: (extracted.financials.total_net * 0.21).toString(),
                    total_con_iva: extracted.financials.total_gross?.toString() || "0"
                }
            });
        }
    }, [extracted]);

    const handleInputChange = (section: string, field: string, value: string) => {
        setExtractedData(prev => ({
            ...prev,
            [section]: {
                ...prev[section as keyof typeof prev],
                [field]: value
            }
        }));
    };

    const formatCurrency = (value: string) => {
        const num = parseFloat(value);
        return isNaN(num) ? value : num.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' €';
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        Verificar Datos Extraídos
                    </h1>
                    <p className="text-lg text-slate-500">
                        Revisa y corrige los datos extraídos del PDF antes de continuar
                    </p>
                </div>
                <Button variant="outline" onClick={onBack} className="border-slate-200">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Atrás
                </Button>
            </div>

            <Card className="mb-6 border-slate-200">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            {confidence >= 0.8 ? (
                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="h-6 w-6 text-orange-500" />
                            )}
                            <div>
                                <p className="font-bold text-slate-800">
                                    Confianza de extracción: {(confidence * 100).toFixed(0)}%
                                </p>
                                <p className="text-sm text-slate-500">
                                    {confidence >= 0.8
                                        ? "Los datos se han extraído con alta precisión"
                                        : "Revisa cuidadosamente los campos marcados"
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(!isEditing)}
                            className="border-brand-200 text-brand-700 hover:bg-brand-50"
                        >
                            <Edit3 className="mr-2 h-4 w-4" />
                            {isEditing ? 'Finalizar edición' : 'Editar datos'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <Card className="border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800">Datos del Vehículo</CardTitle>
                        <CardDescription>Información básica extraída del expediente</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="matricula">Matrícula</Label>
                                <Input
                                    id="matricula"
                                    value={extractedData.metadata.matricula}
                                    onChange={(e) => handleInputChange('metadata', 'matricula', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                            <div>
                                <Label htmlFor="fecha">Fecha</Label>
                                <Input
                                    id="fecha"
                                    type="date"
                                    value={extractedData.metadata.fecha}
                                    onChange={(e) => handleInputChange('metadata', 'fecha', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="bastidor">Número de bastidor</Label>
                            <Input
                                id="bastidor"
                                value={extractedData.metadata.bastidor}
                                onChange={(e) => handleInputChange('metadata', 'bastidor', e.target.value)}
                                readOnly={!isEditing}
                                className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="fabricante">Fabricante</Label>
                                <Input
                                    id="fabricante"
                                    value={extractedData.metadata.fabricante}
                                    onChange={(e) => handleInputChange('metadata', 'fabricante', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                            <div>
                                <Label htmlFor="modelo">Modelo</Label>
                                <Input
                                    id="modelo"
                                    value={extractedData.metadata.modelo}
                                    onChange={(e) => handleInputChange('metadata', 'modelo', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="referencia">Referencia</Label>
                                <Input
                                    id="referencia"
                                    value={extractedData.metadata.referencia}
                                    onChange={(e) => handleInputChange('metadata', 'referencia', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                            <div>
                                <Label htmlFor="sistema">Sistema</Label>
                                <Input
                                    id="sistema"
                                    value={extractedData.metadata.sistema}
                                    onChange={(e) => handleInputChange('metadata', 'sistema', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800">Importes Aseguradora</CardTitle>
                        <CardDescription>Totales extraídos de la valoración (sin IVA)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="repuestos_total">Total Repuestos</Label>
                            <div className="relative">
                                <Input
                                    id="repuestos_total"
                                    value={extractedData.totales.repuestos_total}
                                    onChange={(e) => handleInputChange('totales', 'repuestos_total', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="mo_chapa_eur">M.O. Chapa (€)</Label>
                                <Input
                                    id="mo_chapa_eur"
                                    value={extractedData.totales.mo_chapa_eur}
                                    onChange={(e) => handleInputChange('totales', 'mo_chapa_eur', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                            <div>
                                <Label htmlFor="mo_pintura_eur">M.O. Pintura (€)</Label>
                                <Input
                                    id="mo_pintura_eur"
                                    value={extractedData.totales.mo_pintura_eur}
                                    onChange={(e) => handleInputChange('totales', 'mo_pintura_eur', e.target.value)}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="mat_pintura_eur">Materiales Pintura (€)</Label>
                            <Input
                                id="mat_pintura_eur"
                                value={extractedData.totales.mat_pintura_eur}
                                onChange={(e) => handleInputChange('totales', 'mat_pintura_eur', e.target.value)}
                                readOnly={!isEditing}
                                className={!isEditing ? "bg-slate-50 border-slate-100" : "border-brand-200"}
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100 mt-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-black">Subtotal Neto</p>
                                    <p className="text-2xl font-black text-slate-900">{formatCurrency(extractedData.totales.subtotal_neto)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase font-black">Total con IVA</p>
                                    <p className="text-xl font-bold text-slate-800">{formatCurrency(extractedData.totales.total_con_iva)}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-brand-600 text-white shadow-xl shadow-brand-100 border-none transition-all">
                <CardContent className="p-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Datos verificados</h3>
                            <p className="text-brand-100 opacity-90">
                                Continúa al siguiente paso para introducir los costes reales de tu taller
                            </p>
                        </div>
                        <Button
                            onClick={onNext}
                            className="bg-white text-brand-600 hover:bg-brand-50 font-bold px-8 shadow-lg"
                        >
                            Introducir Costes
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Verification;
