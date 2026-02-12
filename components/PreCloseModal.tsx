import React, { useState, useEffect } from 'react';
import {
    getWorkOrder,
    getTaskTimeLogsForOrder,
    getWorkOrderParts,
    getWorkOrderBilling,
    getPurchaseLinesForWorkOrder,
    getActiveHourCostCalculation,
    recordPreCloseReview
} from '../services/supabaseClient';

interface PreCloseModalProps {
    workOrderId: string;
    onClose: () => void;
    onConfirm: () => void;
}

const PreCloseModal: React.FC<PreCloseModalProps> = ({ workOrderId, onClose, onConfirm }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [reviewed, setReviewed] = useState(false);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, [workOrderId]);

    const loadData = async () => {
        setLoading(true);
        const wo = await getWorkOrder(workOrderId);
        if (!wo) {
            setLoading(false);
            return;
        }

        const currentYear = new Date().getFullYear().toString();
        const [logs, parts, billing, pLines, rateData] = await Promise.all([
            getTaskTimeLogsForOrder(workOrderId),
            getWorkOrderParts(workOrderId),
            getWorkOrderBilling(workOrderId),
            getPurchaseLinesForWorkOrder(workOrderId),
            getActiveHourCostCalculation(currentYear, wo.workshopId || '')
        ]);

        const workshopCostPerHour = rateData?.resultado_calculo?.hourlyCost || 25;

        // 1. Income (Ingresos)
        const laborIncome = billing?.labor_amount || 0;
        const laborHoursBilled = billing?.labor_hours_billed || 0;

        const partsIncome = billing?.materials_amount ||
            parts.reduce((sum: number, p: any) => sum + ((p.qty_billed || 0) * (p.price_billed || 0)), 0);

        // 2. Costs (Gastos)
        const actualLaborSeconds = logs.reduce((sum: number, log: any) => {
            const seconds = log.duration_seconds ||
                (log.ended_at ? Math.floor((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 1000) : 0);
            return sum + seconds;
        }, 0);
        const actualLaborHours = actualLaborSeconds / 3600;
        const operatorCost = actualLaborHours * workshopCostPerHour;

        const sparePartsCost = pLines.length > 0
            ? pLines.reduce((sumValue: number, line: any) => sumValue + (line.total_amount || 0), 0)
            : parts.reduce((sumValue: number, part: any) => sumValue + (part.cost_price || 0), 0);

        // 3. Margin & Warnings
        const margin = (laborIncome + partsIncome) - (operatorCost + sparePartsCost);
        const totalIncome = laborIncome + partsIncome;
        const marginPercent = totalIncome > 0 ? (margin / totalIncome) * 100 : 0;

        const warnings: string[] = [];
        if (actualLaborHours > laborHoursBilled && laborHoursBilled > 0) {
            const diff = ((actualLaborHours - laborHoursBilled) / laborHoursBilled) * 100;
            warnings.push(`Horas reales (${actualLaborHours.toFixed(1)}h) superiores a las facturadas (${laborHoursBilled.toFixed(1)}h): +${diff.toFixed(1)}%`);
        }

        if (sparePartsCost > partsIncome && partsIncome > 0) {
            const diff = ((sparePartsCost - partsIncome) / partsIncome) * 100;
            warnings.push(`Coste de recambios por encima del presupuesto: +${diff.toFixed(1)}%`);
        } else if (partsIncome > 0) {
            const diff = ((partsIncome - sparePartsCost) / partsIncome) * 100;
            warnings.push(`Recambios dentro del presupuesto: -${diff.toFixed(1)}%`);
        }

        if (marginPercent < 20) {
            warnings.push(`Margen por debajo del objetivo (>20%)`);
        }

        setData({
            vehicle: wo.vehicle || 'Vehículo desconocido',
            plate: wo.plate || 'Sin matrícula',
            laborIncome,
            operatorCost,
            partsIncome,
            sparePartsCost,
            margin,
            marginPercent,
            warnings,
            requiresReason: marginPercent < 15,
            actualLaborHours,
            laborHoursBilled
        });
        setLoading(false);
    };

    const getTrafficLight = (percent: number) => {
        if (percent >= 20) return '🟢';
        if (percent >= 15) return '🟡';
        return '🔴';
    };

    const handleConfirm = async () => {
        if (!reviewed) return;
        if (data.requiresReason && !reason.trim()) {
            alert("Por favor, indique el motivo de la baja rentabilidad.");
            return;
        }

        setIsSubmitting(true);
        try {
            const snapshot = {
                billed_amount: data.laborIncome + data.partsIncome,
                labor_cost: data.operatorCost,
                material_cost: data.sparePartsCost,
                total_cost: data.operatorCost + data.sparePartsCost,
                profit: data.margin,
                profit_percent: data.marginPercent
            };

            const review = {
                reason: reason.trim() || null
            };

            const res = await recordPreCloseReview(workOrderId, snapshot, review);
            if (res.success) {
                onConfirm();
            } else {
                alert("Error al guardar la revisión: " + res.error);
            }
        } catch (e) {
            alert("Error inesperado al cerrar.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return null;

    const totalIncome = data.laborIncome + data.partsIncome;
    const totalCost = data.operatorCost + data.sparePartsCost;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-slate-100 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-1 block">Validación de Rentabilidad Obligatoria</span>
                            <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">{data.vehicle}</h2>
                            <p className="text-slate-400 font-mono text-[10px] font-bold">{data.plate}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            Resumen Financiero
                        </h3>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-bold">Facturado (Venta):</span>
                                    <span className="font-black text-slate-800">{totalIncome.toFixed(2)}€</span>
                                </div>
                                <div className="pl-4 space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400">- Mano de Obra:</span>
                                        <span className="text-slate-600 font-bold">{data.laborIncome.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400">- Materiales:</span>
                                        <span className="text-slate-600 font-bold">{data.partsIncome.toFixed(2)}€</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-bold">Costes Reales:</span>
                                    <span className="font-black text-red-500">{totalCost.toFixed(2)}€</span>
                                </div>
                                <div className="pl-4 space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400">- Mano de Obra:</span>
                                        <span className="text-slate-600 font-bold">{data.operatorCost.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400">- Materiales:</span>
                                        <span className="text-slate-600 font-bold">{data.sparePartsCost.toFixed(2)}€</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Margen / Rentabilidad</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-black ${data.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{data.margin.toFixed(2)}€</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${data.marginPercent >= 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {data.marginPercent.toFixed(1)}% {getTrafficLight(data.marginPercent)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Análisis de Desviaciones
                        </h3>
                        <div className="space-y-2">
                            {data.warnings.map((w: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                    <div className="w-1 h-1 bg-slate-400 rounded-full" />
                                    {w}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={reviewed}
                                onChange={(e) => setReviewed(e.target.checked)}
                                className="mt-1 w-5 h-5 rounded-lg border-2 border-slate-200 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                            />
                            <span className="text-sm font-bold text-slate-700 leading-tight group-hover:text-brand-600 transition-colors">
                                He revisado la rentabilidad y confirmo el cierre de este expediente.
                            </span>
                        </label>

                        {data.requiresReason && (
                            <div className="space-y-2 animate-slide-up">
                                <label className="text-[10px] font-black text-red-500 uppercase tracking-widest block">
                                    Motivo (Requerido por margen &lt; 15%):
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Ej: Daños ocultos no peritados, retraso en piezas especiales..."
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] p-4 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 min-h-[100px]"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                        disabled={isSubmitting}
                    >
                        Volver a Revisar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!reviewed || (data.requiresReason && !reason.trim()) || isSubmitting}
                        className={`flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${(!reviewed || (data.requiresReason && !reason.trim()) || isSubmitting) ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-slate-900 hover:bg-black shadow-slate-200'}`}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Procesando...
                            </div>
                        ) : 'Confirmar y Cerrar Expediente'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreCloseModal;
