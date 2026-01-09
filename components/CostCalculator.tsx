
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
  rent: 'Premises Rent / Mortgage', 
  office: 'Office Supplies', 
  maintenance: 'Shop Maintenance', 
  diesel: 'Diesel / Energy', 
  phone: 'Internet & Phone', 
  electricity: 'Electricity Bill', 
  water: 'Water Bill', 
  waste: 'Hazardous Waste Management', 
  cleaning: 'Cleaning Services', 
  training: 'Technical Training', 
  courtesyCar: 'Courtesy Vehicle Maintenance', 
  advertising: 'Marketing / Social Ads', 
  banking: 'POS & Bank Fees', 
  loans: 'Business Loan Interests', 
  courtesyExtra: 'Customer Hospitality', 
  taxes: 'Local Business Taxes', 
  liabilityInsurance: 'Liability Insurance', 
  carInsurance: 'Fleet Insurance', 
  machineryDepreciation: 'Equipment Amortization', 
  subcontracts: 'External Subcontracts', 
  other: 'Miscellaneous Costs'
};

const CostCalculator: React.FC = () => {
  const currentYear = new Date().getFullYear().toString();
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [structure, setStructure] = useState<CalculatorStructureCosts>(INITIAL_STRUCTURE);
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [daysPerYear, setDaysPerYear] = useState<number>(218);
  const [selectedPeriod, setSelectedPeriod] = useState(currentYear);
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
          console.log("Loaded Rate Record:", selectedPeriod, "ID:", currentCalc.id);
          setActiveCalc(currentCalc);
          setStructure(currentCalc.payload_input.structure || INITIAL_STRUCTURE);
          setHoursPerDay(currentCalc.payload_input.hoursPerDay || 8);
          setDaysPerYear(currentCalc.payload_input.daysPerYear || 218);
      } else {
          setActiveCalc(null);
          // If switching to a new year, start fresh but keep current results if it's currentYear
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
        alert("Enter cost data before saving.");
        return;
    }

    if (selectedPeriod !== currentYear && !activeCalc) {
        alert("Cannot create new records for archived years.");
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
              staffSnapshot: staff.map(s => ({ id: s.id, name: s.fullName, salary: s.annualSalary, prod: s.porcentaje_productivo })) 
            },
            resultado_calculo: results,
        };

        // Note: The DB UNIQUE(workshop_id, periodo) constraint handles the "Update" logic.
        // Supabase will automatically update the row if the workshop + year combo exists.
        const data = await saveHourCostCalculation(payload);

        if (data) {
            notificationService.add({
                type: 'success',
                title: 'Cloud Synced',
                message: `Hourly rate for ${selectedPeriod} updated in database.`
            });
            await fetchData(workshopId);
        }
    } catch (e: any) {
        console.error("Save Error:", e);
        alert(`Storage Error: ${e.message || 'Please check your internet and Supabase connection.'}`);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (window.confirm("Permanently remove this audit record?")) {
      const success = await deleteHourCostCalculation(id);
      if (success && workshopId) {
        notificationService.add({ type: 'info', title: 'Removed', message: 'Record deleted.' });
        setHistory(prev => prev.filter(h => h.id !== id));
        if (activeCalc?.id === id) await fetchData(workshopId);
      }
    }
  };

  const isLocked = selectedPeriod !== currentYear;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-in pb-20">
      
      {/* Header Dashboard */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-brand-500">
          <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Auditable Hourly Cost</h1>
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${activeCalc ? 'bg-green-500' : 'bg-yellow-500'}`}>
                    {activeCalc ? 'Cloud Active' : 'Unsaved Session'}
                </span>
                {isLocked && (
                    <span className="bg-red-500 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Archive Locked
                    </span>
                )}
              </div>
              <p className="text-slate-400">Scientific profitability analysis based on real personnel and infrastructure overhead.</p>
          </div>
          <div className="flex gap-4">
              <div className="bg-white/10 p-4 rounded-xl text-center min-w-[160px] backdrop-blur-md border border-white/20">
                  <p className="text-xs text-slate-300 uppercase font-bold mb-1">Internal Cost / Hr</p>
                  <p className="text-4xl font-bold text-white">{results.hourlyCost.toFixed(2)} €</p>
              </div>
              <button onClick={() => setShowHistory(!showHistory)} className={`p-4 rounded-xl text-center transition-all border ${showHistory ? 'bg-brand-500 border-brand-400 shadow-lg' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}>
                  <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-[10px] font-bold uppercase">Audit logs</p>
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
              
              {/* Personnel Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h2 className="font-bold text-slate-700 uppercase text-xs tracking-wider">
                          Shop Personnel Map
                      </h2>
                      <span className="text-sm font-bold text-brand-600">{results.totalSalary.toLocaleString()} € / Year</span>
                  </div>
                  <div className="p-6 overflow-x-auto">
                      <table className="w-full text-xs text-left">
                          <thead className="text-slate-400 uppercase font-black border-b border-slate-100">
                              <tr>
                                  <th className="py-3">Employee</th>
                                  <th className="py-3">Role</th>
                                  <th className="py-3 text-center">Prod. %</th>
                                  <th className="py-3 text-right">Gross Salary</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {staff.length === 0 ? (
                                <tr><td colSpan={4} className="py-4 text-center text-slate-400">No personnel found. Configure your team in "My Workshop".</td></tr>
                              ) : staff.map(s => (
                                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-4 font-bold text-slate-800">{s.fullName}</td>
                                      <td className="py-4 text-slate-500">{s.role}</td>
                                      <td className="py-4 text-center">
                                          <span className={`px-2 py-0.5 rounded-full font-bold ${s.es_productivo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                              {s.es_productivo ? `${s.porcentaje_productivo}%` : 'Non-Prod'}
                                          </span>
                                      </td>
                                      <td className="py-4 text-right font-mono font-bold text-slate-700">{s.annualSalary.toLocaleString()} €</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Structural Costs Grid */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h2 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Fixed Annual Expenses</h2>
                      <span className="text-sm font-bold text-brand-600">{results.totalStructure.toLocaleString()} € / Year</span>
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
                                  onChange={(e) => setStructure({...structure, [key]: Number(e.target.value)})}
                              />
                          </div>
                      ))}
                   </div>
              </div>
          </div>

          <div className="space-y-8">
              {/* Targets Panel */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-brand-50 px-6 py-4 border-b border-brand-100">
                      <h2 className="font-bold text-brand-900 uppercase text-xs">Capacity Variables</h2>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tighter">Shift Hours</label>
                          <input type="number" disabled={isLocked} className={`w-full p-2 border border-slate-300 rounded font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={hoursPerDay} onChange={e => setHoursPerDay(Number(e.target.value))} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tighter">Productive Days / Year</label>
                          <input type="number" disabled={isLocked} className={`w-full p-2 border border-slate-300 rounded font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={daysPerYear} onChange={e => setDaysPerYear(Number(e.target.value))} />
                      </div>
                  </div>
              </div>

              {/* Action Sidebar */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Reporting Fiscal Year</label>
                  <select 
                      className="w-full p-3 border border-slate-300 rounded-lg font-bold text-slate-800 mb-6 focus:ring-2 focus:ring-brand-500 outline-none"
                      value={selectedPeriod}
                      onChange={e => setSelectedPeriod(e.target.value)}
                  >
                      {yearOptions.map(yr => (
                        <option key={yr} value={yr}>
                            {yr === currentYear ? `Current (${yr})` : `Archive (${yr})`}
                        </option>
                      ))}
                  </select>

                  <button 
                      onClick={handleSave}
                      disabled={isSaving || results.hourlyCost <= 0 || (isLocked && !activeCalc)}
                      className={`w-full py-4 rounded-lg font-black text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        isLocked && !activeCalc ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'
                      }`}
                  >
                      {isSaving ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Saving...
                        </>
                      ) : activeCalc ? 'Update Stored Rates' : 'Activate Calculation'}
                  </button>
                  {isLocked && <p className="text-[10px] text-red-500 mt-2 text-center font-bold uppercase tracking-widest">Read Only Mode for History</p>}
              </div>

              {/* Logs / Audit Panel */}
              {showHistory && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 animate-fade-in-up">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Stored Logs</h3>
                        <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
                      </div>
                      <div className="space-y-3">
                          {history.length === 0 ? <p className="text-xs text-slate-400 text-center">No stored logs.</p> : history.map(h => (
                              <div key={h.id} className={`p-3 rounded-lg border text-xs group relative transition-all ${h.periodo === currentYear ? 'bg-white border-brand-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                  <button 
                                      onClick={() => handleDeleteHistoryItem(h.id)}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                                  >
                                      &times;
                                  </button>
                                  <div className="flex justify-between font-bold">
                                      <span>Year {h.periodo}</span>
                                      <span className="text-brand-600">AUDITED</span>
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
