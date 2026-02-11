import React, { useState, useEffect } from 'react';
import { getWorkOrder, getTaskTimeLogsForOrder, getWorkOrderParts, getWorkOrderBilling, getPurchaseLinesForWorkOrder, getActiveHourCostCalculation } from '../services/supabaseClient';

interface PreCloseModalProps {
    workOrderId: string;
    onClose: () => void;
    onConfirm: () => void;
}

const PreCloseModal: React.FC<PreCloseModalProps> = ({ workOrderId, onClose, onConfirm }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
        // prioritize billing table, fallback to work order total
        const laborIncome = billing?.labor_amount || 0;
        const partsIncome = billing?.materials_amount ||
            parts.reduce((sum: number, p: any) => sum + ((p.qty_billed || 0) * (p.price_billed || 0)), 0);

        // 2. Costs (Gastos)
        const operatorCost = logs.reduce((sum: number, log: any) => {
            const seconds = log.duration_seconds ||
                (log.ended_at ? Math.floor((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 1000) : 0);
            return sum + (seconds / 3600 * workshopCostPerHour);
        }, 0);

        const sparePartsCost = pLines.length > 0
            ? pLines.reduce((sumValue: number, line: any) => sumValue + (line.total_amount || 0), 0)
            : parts.reduce((sumValue: number, part: any) => sumValue + (part.cost_price || 0), 0);

        setData({
            vehicle: wo.vehicle || 'Vehículo desconocido',
            plate: wo.plate || 'Sin matrícula',
            laborIncome,
            operatorCost,
            partsIncome,
            sparePartsCost,
            margin: (laborIncome + partsIncome) - (operatorCost + sparePartsCost)
        });
        setLoading(false);
    };

    if (loading) return null;

    const totalIncome = data.laborIncome + data.partsIncome;
    const totalCost = data.operatorCost + data.sparePartsCost;
    const marginPercent = totalIncome > 0 ? (data.margin / totalIncome) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-100">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-1 block">Cierre de Expediente</span>
                            <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">{data.vehicle}</h2>
                            <p className="text-slate-400 font-mono text-[10px] font-bold">{data.plate}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-10">
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Desglose de Ingresos</h3>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">Mano de Obra</span>
                                <span className="font-black text-slate-800">{data.laborIncome.toFixed(2)}€</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">Recambios</span>
                                <span className="font-black text-slate-800">{data.partsIncome.toFixed(2)}€</span>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-sm font-black text-slate-800">TOTAL INGRESOS</span>
                                <span className="text-xl font-black text-brand-600">{totalIncome.toFixed(2)}€</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Desglose de Costes</h3>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">Coste Operario</span>
                                <span className="font-black text-slate-800">{data.operatorCost.toFixed(2)}€</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">Coste Recambios</span>
                                <span className="font-black text-slate-800">{data.sparePartsCost.toFixed(2)}€</span>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-sm font-black text-slate-800">TOTAL COSTES</span>
                                <span className="text-xl font-black text-red-500">{(data.operatorCost + data.sparePartsCost).toFixed(2)}€</span>
                            </div>
                        </div>
                    </div>

                    <div className={`p-6 rounded-[24px] border-2 transition-all ${data.margin >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${data.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Margen Bruto de la Reparación</p>
                                <p className={`text-4xl font-black tracking-tighter ${data.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {data.margin.toFixed(2)}€
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rentabilidad</p>
                                <p className={`text-2xl font-black ${data.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {marginPercent.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                        Volver a Revisar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
                    >
                        Confirmar y Cerrar Expediente
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreCloseModal;
