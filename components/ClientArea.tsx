
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
    const [activeTab, setActiveTab] = useState<'profile' | 'staff'>('profile');
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


    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const [profile, dbEmployees] = await Promise.all([
                getCompanyProfileFromSupabase(),
                getEmployeesFromSupabase()
            ]);

            if (profile) setCompany(profile);
            if (dbEmployees) setStaff(dbEmployees);

            setIsLoading(false);
        };
        loadData();
    }, []);

    const handleSaveCompany = async () => {
        setIsLoading(true);
        await saveCompanyProfileToSupabase(company);
        setIsLoading(false);
        alert('Perfil de empresa actualizado.');
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
        if (window.confirm('¿Está seguro de que desea eliminar a este empleado?')) {
            setIsLoading(true);
            await deleteEmployeeFromSupabase(id);
            setStaff(staff.filter(s => s.id !== id));
            setIsLoading(false);
        }
    };


    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Gestión de Mi Taller</h1>
            </div>

            <div className="border-b border-slate-200 mb-8 flex space-x-8">
                <button onClick={() => setActiveTab('profile')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'profile' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>Datos Fiscales</button>
                <button onClick={() => setActiveTab('staff')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'staff' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>Equipo y Estructura</button>
            </div>

            {activeTab === 'profile' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-slate-900">Company Information</h2>
                        <button onClick={handleSaveCompany} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-brand-700 uppercase tracking-wider">Save Changes</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">COMPANY NAME</label>
                            <input type="text" value={company.companyName} onChange={e => setCompany({ ...company, companyName: e.target.value })} className="w-full rounded border-slate-300 p-2 text-slate-700 font-medium" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">CIF / NIF</label>
                            <input type="text" value={company.cif} onChange={e => setCompany({ ...company, cif: e.target.value })} className="w-full rounded border-slate-300 p-2 text-slate-700 font-medium" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">FISCAL DIRECTORATE</label>
                            <input type="text" value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} className="w-full rounded border-slate-300 p-2 text-slate-700 font-medium" />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'staff' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Estructura Organizativa</h2>
                            <p className="text-xs text-slate-500">Defina aquí los salarios y la productividad real de su equipo.</p>
                        </div>
                        <button onClick={() => { setIsAddingStaff(true); setNewStaff({ department: 'Workshop', role: 'Mechanic L1', active: true, annualSalary: 0, es_productivo: true, porcentaje_productivo: 100 }); }} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Nuevo Empleado
                        </button>
                    </div>

                    {isAddingStaff && (
                        <div className="mb-8 bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-inner animate-fade-in">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Editor de Perfil de Empleado</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                                    <input type="text" className="w-full p-2 border rounded text-sm" value={newStaff.fullName || ''} onChange={e => setNewStaff({ ...newStaff, fullName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                                    <input type="email" className="w-full p-2 border rounded text-sm" value={newStaff.email || ''} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo Operativo</label>
                                    <select className="w-full p-2 border rounded text-sm" value={newStaff.role} onChange={e => handleRoleChange(e.target.value as EmployeeRole)}>
                                        {NORMALIZED_ROLES.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salario Bruto Anual (€)</label>
                                    <input type="number" className="w-full p-2 border rounded text-sm font-bold text-brand-600" value={newStaff.annualSalary || 0} onChange={e => setNewStaff({ ...newStaff, annualSalary: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Personal</label>
                                    <div className="flex items-center gap-4 mt-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={newStaff.es_productivo} onChange={e => setNewStaff({ ...newStaff, es_productivo: e.target.checked })} className="w-4 h-4 text-brand-600" />
                                            ¿Es Productivo?
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Productividad Real (%)</label>
                                    <input type="number" min="0" max="100" className="w-full p-2 border rounded text-sm" value={newStaff.porcentaje_productivo || 0} onChange={e => setNewStaff({ ...newStaff, porcentaje_productivo: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6 justify-end border-t pt-4">
                                <button onClick={() => setIsAddingStaff(false)} className="text-slate-500 text-sm px-4 py-2 font-bold hover:text-slate-700">Cancelar</button>
                                <button onClick={handleAddStaff} className="bg-brand-600 text-white text-sm px-6 py-2 rounded-lg font-bold shadow hover:bg-brand-700">Guardar Empleado</button>
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
                                    <div className="flex gap-1">
                                        <button onClick={() => { setIsAddingStaff(true); setNewStaff(person); }} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all" title="Editar">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => handleDeleteStaff(person.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                                    <div>
                                        <p className="text-slate-400 font-bold uppercase">Salario Anual</p>
                                        <p className="font-bold text-slate-700">{person.annualSalary?.toLocaleString()} €</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 font-bold uppercase">Prod. Real</p>
                                        <p className={`font-bold ${person.es_productivo ? 'text-green-600' : 'text-slate-500'}`}>
                                            {person.es_productivo ? `${person.porcentaje_productivo}%` : 'No Prod.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
};

export default ClientArea;
