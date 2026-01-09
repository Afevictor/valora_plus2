
import React, { useState, useEffect } from 'react';
import { CompanyProfile, Employee, Department, EmployeeRole, NORMALIZED_ROLES } from '../types';
import { 
    getCompanyProfileFromSupabase, 
    saveCompanyProfileToSupabase, 
    getEmployeesFromSupabase, 
    saveEmployeeToSupabase, 
    deleteEmployeeFromSupabase,
    saveUserPins,
    getUserPins,
    supabase
} from '../services/supabaseClient';

const ClientArea: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [company, setCompany] = useState<CompanyProfile>({
      companyName: '', cif: '', address: '', city: '', zipCode: '', province: '', email: '', phone: '', costeHora: 0, pvpManoObra: 0
  });
  const [staff, setStaff] = useState<Employee[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState<Partial<Employee>>({ 
      department: 'Workshop', 
      role: 'Mechanic L1', 
      active: true,
      annualSalary: 0,
      es_productivo: true,
      porcentaje_productivo: 100
  });

  // Security Management State
  const [securityLoading, setSecurityLoading] = useState(false);
  const [pins, setPins] = useState({ Admin: '', Operator: '', Admin_Staff: '' });
  const [isEditingPins, setIsEditingPins] = useState(false);

  useEffect(() => {
      const loadData = async () => {
          setIsLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          
          const [profile, dbEmployees, dbPins] = await Promise.all([
              getCompanyProfileFromSupabase(),
              getEmployeesFromSupabase(),
              user ? getUserPins(user.id) : Promise.resolve(null)
          ]);

          if (profile) setCompany(profile);
          if (dbEmployees) setStaff(dbEmployees);
          if (dbPins) setPins(dbPins);
          
          setIsLoading(false);
      };
      loadData();
  }, []);

  const handleSaveCompany = async () => {
    setIsLoading(true);
    await saveCompanyProfileToSupabase(company);
    setIsLoading(false);
    alert('Company profile updated.');
  };

  const handleRoleChange = (roleName: EmployeeRole) => {
    const roleDef = NORMALIZED_ROLES.find(r => r.id === roleName);
    setNewStaff({
      ...newStaff,
      role: roleName,
      es_productivo: roleDef?.isProductive ?? false,
      porcentaje_productivo: roleDef?.defaultPercentage ?? 0
    });
  };

  const handleAddStaff = async () => {
    if (!newStaff.fullName || !newStaff.email || !newStaff.role) return;
    setIsLoading(true);
    const member: Employee = {
      id: (newStaff as any).id || crypto.randomUUID(),
      fullName: newStaff.fullName,
      role: newStaff.role as EmployeeRole,
      department: newStaff.department as Department,
      skills: [],
      email: newStaff.email,
      mobile: newStaff.mobile || '',
      active: true,
      annualSalary: Number(newStaff.annualSalary) || 0,
      es_productivo: !!newStaff.es_productivo,
      porcentaje_productivo: Number(newStaff.porcentaje_productivo) || 0
    };
    await saveEmployeeToSupabase(member);
    setStaff(prev => {
        const filtered = prev.filter(s => s.id !== member.id);
        return [...filtered, member];
    });
    setIsAddingStaff(false);
    setIsLoading(false);
  };

  const handleDeleteStaff = async (id: string) => {
    if (window.confirm('Delete this employee?')) {
      setIsLoading(true);
      await deleteEmployeeFromSupabase(id);
      setStaff(staff.filter(s => s.id !== id));
      setIsLoading(false);
    }
  };

  const handleSavePins = async () => {
      // Basic validation
      if (pins.Admin.length !== 6 || pins.Operator.length !== 6 || pins.Admin_Staff.length !== 6) {
          alert("All PINs must be exactly 6 digits.");
          return;
      }

      setSecurityLoading(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              await saveUserPins(user.id, pins);
              setIsEditingPins(false);
              alert("Security settings saved to Supabase.");
          }
      } catch (e) {
          alert("Error saving security configuration.");
      } finally {
          setSecurityLoading(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Workshop Management</h1>
      </div>

      <div className="border-b border-slate-200 mb-8 flex space-x-8">
          <button onClick={() => setActiveTab('profile')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'profile' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>Fiscal Data</button>
          <button onClick={() => setActiveTab('staff')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'staff' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>Team & Structure</button>
          <button onClick={() => setActiveTab('security')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'security' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>Security & Access</button>
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in">
           <div className="flex justify-between items-center mb-6">
             <h2 className="text-lg font-semibold text-slate-900">Company Information</h2>
             <button onClick={handleSaveCompany} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-brand-700">Save Changes</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Name</label>
              <input type="text" value={company.companyName} onChange={e => setCompany({...company, companyName: e.target.value})} className="w-full rounded border-slate-300 p-2" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">VAT ID / Tax ID</label>
              <input type="text" value={company.cif} onChange={e => setCompany({...company, cif: e.target.value})} className="w-full rounded border-slate-300 p-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fiscal Address</label>
              <input type="text" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} className="w-full rounded border-slate-300 p-2" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Organizational Structure</h2>
                <p className="text-xs text-slate-500">Define salaries and real productivity of your team here.</p>
            </div>
            <button onClick={() => { setIsAddingStaff(true); setNewStaff({ department: 'Workshop', role: 'Mechanic L1', active: true, annualSalary: 0, es_productivo: true, porcentaje_productivo: 100 }); }} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Employee
            </button>
          </div>

          {isAddingStaff && (
             <div className="mb-8 bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-inner animate-fade-in">
                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Employee Profile Editor</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" value={newStaff.fullName || ''} onChange={e => setNewStaff({...newStaff, fullName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input type="email" className="w-full p-2 border rounded text-sm" value={newStaff.email || ''} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Operational Role</label>
                        <select className="w-full p-2 border rounded text-sm" value={newStaff.role} onChange={e => handleRoleChange(e.target.value as EmployeeRole)}>
                            {NORMALIZED_ROLES.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gross Annual Salary (€)</label>
                        <input type="number" className="w-full p-2 border rounded text-sm font-bold text-brand-600" value={newStaff.annualSalary || 0} onChange={e => setNewStaff({...newStaff, annualSalary: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Staff Type</label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={newStaff.es_productivo} onChange={e => setNewStaff({...newStaff, es_productivo: e.target.checked})} className="w-4 h-4 text-brand-600" />
                            Is Productive?
                          </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Real Productivity (%)</label>
                        <input type="number" min="0" max="100" className="w-full p-2 border rounded text-sm" value={newStaff.porcentaje_productivo || 0} onChange={e => setNewStaff({...newStaff, porcentaje_productivo: Number(e.target.value)})} />
                    </div>
                </div>
                <div className="flex gap-2 mt-6 justify-end border-t pt-4">
                    <button onClick={() => setIsAddingStaff(false)} className="text-slate-500 text-sm px-4 py-2 font-bold hover:text-slate-700">Cancel</button>
                    <button onClick={handleAddStaff} className="bg-brand-600 text-white text-sm px-6 py-2 rounded-lg font-bold shadow hover:bg-brand-700">Save Employee</button>
                </div>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staff.map(person => (
                  <div key={person.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${person.es_productivo ? 'bg-brand-600' : 'bg-slate-400'}`}>
                                  {person.fullName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{person.fullName}</h4>
                                  <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">{person.role}</p>
                              </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setIsAddingStaff(true); setNewStaff(person); }} className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button onClick={() => handleDeleteStaff(person.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                          <div>
                              <p className="text-slate-400 font-bold uppercase">Annual Salary</p>
                              <p className="font-bold text-slate-700">{person.annualSalary?.toLocaleString()} €</p>
                          </div>
                          <div>
                              <p className="text-slate-400 font-bold uppercase">Real Prod.</p>
                              <p className={`font-bold ${person.es_productivo ? 'text-green-600' : 'text-slate-500'}`}>
                                  {person.es_productivo ? `${person.porcentaje_productivo}%` : 'Non Prod.'}
                              </p>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-xl font-black text-slate-900">Access Management</h2>
                <p className="text-slate-500 text-sm mt-1">Manage 6-digit PINs stored in Supabase for role-based authentication.</p>
            </div>

            <div className="space-y-6">
                <div className="bg-slate-50 p-8 rounded-3xl space-y-6 shadow-inner border border-slate-100">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Admin PIN (6 digits)</label>
                        <input 
                            type="text" 
                            maxLength={6}
                            disabled={!isEditingPins}
                            className={`w-full font-mono text-xl p-3 border rounded-xl transition-all ${isEditingPins ? 'bg-white border-brand-300 ring-2 ring-brand-50' : 'bg-slate-100 border-transparent'}`}
                            value={pins.Admin}
                            onChange={e => setPins({...pins, Admin: e.target.value.replace(/\D/g, '')})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Operator PIN (6 digits)</label>
                        <input 
                            type="text" 
                            maxLength={6}
                            disabled={!isEditingPins}
                            className={`w-full font-mono text-xl p-3 border rounded-xl transition-all ${isEditingPins ? 'bg-white border-brand-300 ring-2 ring-brand-50' : 'bg-slate-100 border-transparent'}`}
                            value={pins.Operator}
                            onChange={e => setPins({...pins, Operator: e.target.value.replace(/\D/g, '')})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Staff PIN (6 digits)</label>
                        <input 
                            type="text" 
                            maxLength={6}
                            disabled={!isEditingPins}
                            className={`w-full font-mono text-xl p-3 border rounded-xl transition-all ${isEditingPins ? 'bg-white border-brand-300 ring-2 ring-brand-50' : 'bg-slate-100 border-transparent'}`}
                            value={pins.Admin_Staff}
                            onChange={e => setPins({...pins, Admin_Staff: e.target.value.replace(/\D/g, '')})}
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    {isEditingPins ? (
                        <>
                            <button 
                                onClick={() => setIsEditingPins(false)}
                                className="flex-1 bg-white border border-slate-300 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSavePins}
                                disabled={securityLoading}
                                className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                            >
                                {securityLoading ? <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : null}
                                SAVE CHANGES
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setIsEditingPins(true)}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-black shadow-lg hover:bg-black transition-all flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            MANAGE ACCESS KEYS
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientArea;
