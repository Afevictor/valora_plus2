
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const NewAnalysis = ({ onNext, setGlobalCaseId }: { onNext: () => void, setGlobalCaseId: (id: string) => void }) => {
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file: File) => {
        if (file.type !== 'application/pdf') {
            toast({
                title: "Tipo de archivo no válido",
                description: "Por favor, sube únicamente archivos PDF.",
                variant: "destructive"
            });
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            toast({
                title: "Archivo demasiado grande",
                description: "El archivo no puede superar los 20MB.",
                variant: "destructive"
            });
            return;
        }

        setUploadedFile(file);
        simulateUpload(file);
    };

    const simulateUpload = async (file: File) => {
        setIsUploading(true);
        // Mimicking the original behavior but simplified for integration
        setTimeout(() => {
            setIsUploading(false);
            const mockCaseId = `case-${Date.now()}`;
            setGlobalCaseId(mockCaseId);
            toast({
                title: "PDF subido correctamente",
                description: "Datos extraídos y procesados (Simulado).",
            });
        }, 2000);
    };

    const removeFile = () => {
        setUploadedFile(null);
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">
                    Nuevo Análisis de Rentabilidad
                </h1>
                <p className="text-lg text-slate-500">
                    Sube la valoración PDF de la aseguradora para comenzar
                </p>
            </div>

            <Card className="mb-8 border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                        <Upload className="h-5 w-5 text-brand-600" />
                        <span>Subir PDF de Valoración</span>
                    </CardTitle>
                    <CardDescription>
                        Formatos compatibles: Audatex, GT Motive, Solera. Máx 20MB
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!uploadedFile ? (
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300",
                                dragActive
                                    ? "border-brand-500 bg-brand-50"
                                    : "border-slate-200 hover:border-brand-400 hover:bg-slate-50"
                            )}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <div className="flex flex-col items-center space-y-4">
                                <div className={cn(
                                    "p-4 rounded-full transition-colors",
                                    dragActive ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                    <Upload className="h-8 w-8" />
                                </div>
                                <div>
                                    <p className="text-lg font-medium text-slate-900 mb-2">
                                        Arrastra tu PDF aquí o haz clic para seleccionar
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        PDF de valoración de Audatex, GT Motive o Solera
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="mt-4 border-brand-200 text-brand-700 hover:bg-brand-50"
                                    onClick={() => document.getElementById('file-input')?.click()}
                                >
                                    Seleccionar Archivo
                                </Button>
                                <input
                                    id="file-input"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileInput}
                                    className="hidden"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl p-6 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="p-3 bg-brand-600 text-white rounded-lg shadow-md">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{uploadedFile.name}</p>
                                        <p className="text-sm text-slate-500">
                                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    {isUploading ? (
                                        <div className="flex items-center space-x-2 text-brand-600 font-bold">
                                            <div className="animate-spin h-4 w-4 border-2 border-brand-600 border-t-transparent rounded-full"></div>
                                            <span className="text-sm">Procesando...</span>
                                        </div>
                                    ) : (
                                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-red-500"
                                        onClick={removeFile}
                                        disabled={isUploading}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <Card className="border-slate-100 bg-white">
                    <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="h-6 w-6 text-brand-500 mt-1" />
                            <div>
                                <h3 className="font-bold text-slate-800 mb-2">Datos que extraemos</h3>
                                <ul className="text-sm text-slate-500 space-y-1">
                                    <li>• Total repuestos y materiales</li>
                                    <li>• Horas de mano de obra</li>
                                    <li>• Precios por hora de trabajo</li>
                                    <li>• Materiales de pintura</li>
                                    <li>• Datos del vehículo</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 bg-white">
                    <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                            <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-1" />
                            <div>
                                <h3 className="font-bold text-slate-800 mb-2">Proceso automático</h3>
                                <ul className="text-sm text-slate-500 space-y-1">
                                    <li>• Reconocimiento OCR</li>
                                    <li>• Validación de coherencia</li>
                                    <li>• Verificación manual</li>
                                    <li>• Cálculo de márgenes</li>
                                    <li>• Informe PDF automático</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {uploadedFile && !isUploading && (
                <Card className="bg-brand-600 text-white shadow-xl shadow-brand-100 border-none transition-all">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold mb-1">¡Perfecto!</h3>
                                <p className="text-brand-100 opacity-90">
                                    Tu PDF se ha procesado correctamente. Continúa al siguiente paso.
                                </p>
                            </div>
                            <Button
                                onClick={onNext}
                                className="bg-white text-brand-600 hover:bg-brand-50 font-bold px-8"
                            >
                                Verificar Datos
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default NewAnalysis;
