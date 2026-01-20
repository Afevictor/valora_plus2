
import React, { useState, useEffect } from 'react';
import { CalculatorStructureCosts, Employee, HourCostCalculation } from '../types';
import {
    saveHourCostCalculation,
    getEmployeesFromSupabase,
    getActiveHourCostCalculation,
    getHourCostHistory,
    deleteHourCostCalculation,
    supabase
} from '../services/supabaseClient';
import { notificationService } from '../services/notificationService';

const INITIAL_STRUCTURE: CalculatorStructureCosts = {
    rent: 0, office: 0, maintenance: 0, diesel: 0, phone: 0, electricity: 0, water: 0, waste: 0, cleaning: 0, training: 0, courtesyCar: 0, advertising: 0, banking: 0, loans: 0, courtesyExtra: 0, taxes: 0, liabilityInsurance: 0, carInsurance: 0, machineryDepreciation: 0, subcontracts: 0, other: 0
};

const STRUCTURE_LABELS: Record<keyof CalculatorStructureCosts, string> = {
    rent: 'Alquiler / Hipoteca de Local',
    office: 'Material de Oficina',
    maintenance: 'Mantenimiento del Taller',
    diesel: 'Gasóleo / Energía',
    phone: 'Internet y Teléfono',
    electricity: 'Factura Eléctrica',
    water: 'Factura de Agua',
    waste: 'Gestión de Residuos Peligrosos',
    cleaning: 'Servicios de Limpieza',
    training: 'Formación Técnica',
    courtesyCar: 'Mantenimiento Vehículo Cortesía',
    advertising: 'Marketing / Publicidad RRSS',
    banking: 'TPV y Comisiones Bancarias',
    loans: 'Intereses de Préstamos',
    courtesyExtra: 'Atención al Cliente',
    taxes: 'Impuestos y Tasas Locales',
    liabilityInsurance: 'Seguro Responsabilidad Civil',
    carInsurance: 'Seguro de Flota / Cortesía',
    machineryDepreciation: 'Amortización de Maquinaria',
    subcontracts: 'Subcontrataciones Externas',
    other: 'Otros Costes Varios'
};

const CostCalculator: React.FC = () => {
    const currentYear = new Date().getFullYear().toString();
    const [workshopId, setWorkshopId] = useState<string | null>(null);
    const [staff, setStaff] = useState<Employee[]>([]);
    const [structure, setStructure] = useState<CalculatorStructureCosts>(INITIAL_STRUCTURE);
    const [hoursPerDay, setHoursPerDay] = useState<number>(8);
    const [daysPerYear, setDaysPerYear] = useState<number>(218);
    const [selectedPeriod, setSelectedPeriod] = useState(currentYear);
    const [margin, setMargin] = useState<number>(20); // Default 20% margin
    const [isSaving, setIsSaving] = useState(false);
    const [activeCalc, setActiveCalc] = useState<HourCostCalculation | null>(null);
    const [history, setHistory] = useState<HourCostCalculation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const [results, setResults] = useState({
        totalSalary: 0,
        totalStructure: 0,
        productiveCapacity: 0,
        fteProductives: 0,
        hourlyCost: 0
    });

    const yearOptions = Array.from({ length: 4 }, (_, i) => (parseInt(currentYear) - i).toString());

    const fetchData = async (wId: string) => {
        const [empData, currentCalc, historyData] = await Promise.all([
            getEmployeesFromSupabase(),
            getActiveHourCostCalculation(selectedPeriod, wId),
            getHourCostHistory(wId)
        ]);
        setStaff(empData);
        setHistory(historyData);

        if (currentCalc) {
            setActiveCalc(currentCalc);
            setStructure(currentCalc.payload_input.structure || INITIAL_STRUCTURE);
            setHoursPerDay(currentCalc.payload_input.hoursPerDay || 8);
            setDaysPerYear(currentCalc.payload_input.daysPerYear || 218);
            setMargin(currentCalc.payload_input.margin || 20);
        } else {
            setActiveCalc(null);
            if (selectedPeriod !== currentYear) {
                setStructure(INITIAL_STRUCTURE);
            }
        }
    };

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setWorkshopId(user.id);
                fetchData(user.id);
            }
        };
        init();
    }, [selectedPeriod]);

    useEffect(() => {
        const totalSalary = staff.reduce((acc, s) => acc + (s.annualSalary || 0), 0);
        const totalStructure = (Object.values(structure) as number[]).reduce((acc: number, val: number) => acc + (val || 0), 0);

        const totalPotentialHours = staff.reduce((acc, s) => {
            if (!s.es_productivo) return acc;
            const individualCapacity = (s.porcentaje_productivo / 100) * hoursPerDay * daysPerYear;
            return acc + individualCapacity;
        }, 0);

        const hourlyCost = totalPotentialHours > 0
            ? (totalSalary + totalStructure) / totalPotentialHours
            : 0;

        setResults({
            totalSalary,
            totalStructure,
            productiveCapacity: totalPotentialHours,
            fteProductives: totalPotentialHours / (hoursPerDay * daysPerYear),
            hourlyCost
        });
    }, [staff, structure, hoursPerDay, daysPerYear]);

    const handleSave = async () => {
        if (results.hourlyCost <= 0 || !workshopId) {
            alert("Introduzca datos de coste antes de guardar.");
            return;
        }

        if (selectedPeriod !== currentYear && !activeCalc) {
            alert("No se pueden crear nuevos registros para años archivados.");
            return;
        }

        setIsSaving(true);

        try {
            const payload: any = {
                workshop_id: workshopId,
                periodo: selectedPeriod,
                payload_input: {
                    structure,
                    hoursPerDay,
                    daysPerYear,
                    structure,
                    hoursPerDay,
                    daysPerYear,
                    margin,
                    staffSnapshot: staff.map(s => ({ id: s.id, name: s.fullName, salary: s.annualSalary, prod: s.porcentaje_productivo }))
                },
                resultado_calculo: results,
            };

            const data = await saveHourCostCalculation(payload);

            if (data) {
                notificationService.add({
                    type: 'success',
                    title: 'Sincronizado',
                    message: `Tarifa horaria para ${selectedPeriod} actualizada en la base de datos.`
                });
                await fetchData(workshopId);
            }
        } catch (e: any) {
            console.error("Error al guardar:", e);
            alert(`Error de almacenamiento: ${e.message || 'Por favor, compruebe su conexión.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteHistoryItem = async (id: string) => {
        if (window.confirm("¿Eliminar permanentemente este registro de auditoría?")) {
            const success = await deleteHourCostCalculation(id);
            if (success && workshopId) {
                notificationService.add({ type: 'info', title: 'Eliminado', message: 'Registro borrado.' });
                setHistory(prev => prev.filter(h => h.id !== id));
                if (activeCalc?.id === id) await fetchData(workshopId);
            }
        }
    };

    const isLocked = selectedPeriod !== currentYear;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-in pb-20">

            {/* Cabecera Dashboard */}
            <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-brand-500">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-white">Coste Hora Auditable</h1>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${activeCalc ? 'bg-green-500' : 'bg-yellow-500'}`}>
                            {activeCalc ? 'Activo en Nube' : 'Sesión no guardada'}
                        </span>
                        {isLocked && (
                            <span className="bg-red-500 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Histórico Bloqueado
                            </span>
                        )}
                    </div>
                    <p className="text-slate-400">Análisis científico de rentabilidad basado en costes reales de personal e infraestructura.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white/10 p-4 rounded-xl text-center min-w-[160px] backdrop-blur-md border border-white/20">
                        <p className="text-xs text-slate-300 uppercase font-bold mb-1">Coste Interno / Hr</p>
                        <p className="text-4xl font-bold text-white">{results.hourlyCost.toFixed(2)} €</p>
                    </div>
                    <button onClick={() => setShowHistory(!showHistory)} className={`p-4 rounded-xl text-center transition-all border ${showHistory ? 'bg-brand-500 border-brand-400 shadow-lg' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}>
                        <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-[10px] font-bold uppercase">Registros Auditoría</p>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                <div className="lg:col-span-2 space-y-8">

                    {/* Tabla de Personal */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="font-bold text-slate-700 uppercase text-xs tracking-wider">
                                Mapa de Personal del Taller
                            </h2>
                            <span className="text-sm font-bold text-brand-600">{results.totalSalary.toLocaleString()} € / Año</span>
                        </div>
                        <div className="p-6 overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-slate-400 uppercase font-black border-b border-slate-100">
                                    <tr>
                                        <th className="py-3">Empleado</th>
                                        <th className="py-3">Cargo</th>
                                        <th className="py-3 text-center">% Prod.</th>
                                        <th className="py-3 text-right">Salario Bruto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {staff.length === 0 ? (
                                        <tr><td colSpan={4} className="py-4 text-center text-slate-400">No se encontró personal. Configure su equipo en "Mi Taller".</td></tr>
                                    ) : staff.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 font-bold text-slate-800">{s.fullName}</td>
                                            <td className="py-4 text-slate-500">{s.role}</td>
                                            <td className="py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-bold ${s.es_productivo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    {s.es_productivo ? `${s.porcentaje_productivo}%` : 'No Prod'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right font-mono font-bold text-slate-700">{s.annualSalary.toLocaleString()} €</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Grid de Gastos Estructurales */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Gastos Fijos Anuales</h2>
                            <span className="text-sm font-bold text-brand-600">{results.totalStructure.toLocaleString()} € / Año</span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(STRUCTURE_LABELS).map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 truncate" title={label}>{label}</label>
                                    <input
                                        type="number"
                                        disabled={isLocked}
                                        className={`w-full p-2 border border-slate-200 rounded text-sm focus:border-brand-500 font-bold text-slate-700 transition-all ${isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'bg-white hover:border-slate-300'}`}
                                        value={structure[key as keyof CalculatorStructureCosts] || ''}
                                        onChange={(e) => setStructure({ ...structure, [key]: Number(e.target.value) })}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Panel de Variables */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-brand-50 px-6 py-4 border-b border-brand-100">
                            <h2 className="font-bold text-brand-900 uppercase text-xs">Variables de Capacidad</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tighter">Horas de Jornada</label>
                                <input type="number" disabled={isLocked} className={`w-full p-2 border border-slate-300 rounded font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={hoursPerDay} onChange={e => setHoursPerDay(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tighter">Días Productivos / Año</label>
                                <input type="number" disabled={isLocked} className={`w-full p-2 border border-slate-300 rounded font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={daysPerYear} onChange={e => setDaysPerYear(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* Sales Price Module */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
                            <h2 className="font-bold text-emerald-900 uppercase text-xs">Precio de Venta Sugerido</h2>
                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">Rentabilidad</span>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-tighter">Margen de Beneficio</label>
                                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{margin}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    disabled={isLocked}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    value={margin}
                                    onChange={e => setMargin(Number(e.target.value))}
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Coste Hora</p>
                                    <p className="text-xl font-bold text-slate-700">{results.hourlyCost.toFixed(2)} €</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase">Precio Venta</p>
                                    <p className="text-2xl font-black text-emerald-600">
                                        {(results.hourlyCost * (1 + margin / 100)).toFixed(2)} €
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar de Acciones */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Año Fiscal del Informe</label>
                        <select
                            className="w-full p-3 border border-slate-300 rounded-lg font-bold text-slate-800 mb-6 focus:ring-2 focus:ring-brand-500 outline-none"
                            value={selectedPeriod}
                            onChange={e => setSelectedPeriod(e.target.value)}
                        >
                            {yearOptions.map(yr => (
                                <option key={yr} value={yr}>
                                    {yr === currentYear ? `Actual (${yr})` : `Histórico (${yr})`}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={handleSave}
                            disabled={isSaving || results.hourlyCost <= 0 || (isLocked && !activeCalc)}
                            className={`w-full py-4 rounded-lg font-black text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isLocked && !activeCalc ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'
                                }`}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Guardando...
                                </>
                            ) : activeCalc ? 'Actualizar Tarifas Guardadas' : 'Activar Cálculo'}
                        </button>
                        {isLocked && <p className="text-[10px] text-red-500 mt-2 text-center font-bold uppercase tracking-widest">Modo Lectura para Histórico</p>}
                    </div>

                    {/* Panel de Registros / Auditoría */}
                    {showHistory && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 animate-fade-in-up">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Registros Guardados</h3>
                                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
                            </div>
                            <div className="space-y-3">
                                {history.length === 0 ? <p className="text-xs text-slate-400 text-center">No hay registros guardados.</p> : history.map(h => (
                                    <div key={h.id} className={`p-3 rounded-lg border text-xs group relative transition-all ${h.periodo === currentYear ? 'bg-white border-brand-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                        <button
                                            onClick={() => handleDeleteHistoryItem(h.id)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                                        >
                                            &times;
                                        </button>
                                        <div className="flex justify-between font-bold">
                                            <span>Año {h.periodo}</span>
                                            <span className="text-brand-600 uppercase">Auditado</span>
                                        </div>
                                        <div className="flex justify-between mt-1 text-slate-500">
                                            <span>{new Date(h.created_at).toLocaleDateString()}</span>
                                            <span className="font-mono font-bold text-slate-700">{h.resultado_calculo.hourlyCost.toFixed(2)} €/h</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CostCalculator;
