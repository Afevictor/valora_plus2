
import React, { useState } from "react";
import NewAnalysis from "./analysis/NewAnalysis";
import Verification from "./analysis/Verification";
import WorkshopCosts from "./analysis/WorkshopCosts";
import Results from "./analysis/Results";

const ClientAnalysisPortal: React.FC = () => {
    const [activeStep, setActiveStep] = useState(1);
    const [caseId, setCaseId] = useState<string | null>(null);

    const nextStep = () => setActiveStep(prev => prev + 1);
    const prevStep = () => setActiveStep(prev => Math.max(1, prev - 1));

    const renderStep = () => {
        switch (activeStep) {
            case 1:
                return <NewAnalysis onNext={nextStep} setGlobalCaseId={setCaseId} />;
            case 2:
                return <Verification onNext={nextStep} onBack={prevStep} caseId={caseId || ""} />;
            case 3:
                return <WorkshopCosts onNext={nextStep} onBack={prevStep} />;
            case 4:
                return <Results onBack={prevStep} />;
            default:
                return <NewAnalysis onNext={nextStep} setGlobalCaseId={setCaseId} />;
        }
    };

    const steps = [
        { id: 1, label: "Cargar PDF" },
        { id: 2, label: "Verificar" },
        { id: 3, label: "Costes Reales" },
        { id: 4, label: "Rentabilidad" }
    ];

    return (
        <div className="max-w-7xl mx-auto min-h-screen bg-slate-50/20 px-6 pt-12 pb-24 animate-in fade-in duration-700">
            {/* Stepper Header */}
            <div className="flex items-center justify-center gap-4 mb-16 overflow-x-auto pb-4 px-4 scrollbar-hide">
                {steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                        <div className="flex items-center gap-3 shrink-0">
                            <div
                                className={`w-12 h-12 rounded-[20px] flex items-center justify-center font-black transition-all duration-500 border-2 ${activeStep >= step.id
                                        ? 'bg-brand-600 border-brand-600 text-white shadow-xl shadow-brand-200 scale-110'
                                        : 'bg-white border-slate-100 text-slate-300'
                                    }`}
                            >
                                {step.id}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap hidden sm:block ${activeStep >= step.id ? 'text-slate-900' : 'text-slate-300'
                                }`}>
                                {step.label}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`h-[2px] w-8 sm:w-16 rounded-full transition-colors duration-500 ${activeStep > step.id ? 'bg-brand-600' : 'bg-slate-100'
                                }`}></div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div className="relative">
                <div key={activeStep} className="animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-both">
                    {renderStep()}
                </div>
            </div>
        </div>
    );
};

export default ClientAnalysisPortal;
