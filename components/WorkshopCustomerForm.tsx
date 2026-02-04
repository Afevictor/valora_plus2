
import React, { useState } from 'react';
import { WorkshopCustomer } from '../services/supabaseClient';

interface WorkshopCustomerFormProps {
    initialData?: Partial<WorkshopCustomer>;
    onSubmit: (customer: Partial<WorkshopCustomer>) => void;
    onCancel: () => void;
}

const WorkshopCustomerForm: React.FC<WorkshopCustomerFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<Partial<WorkshopCustomer>>({
        customer_type: 'Individual',
        full_name: '',
        phone: '',
        email: '',
        tax_id: '',
        address: '',
        city: '',
        province: '',
        postal_code: '',
        ...initialData
    });

    const isCompany = formData.customer_type === 'Company';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleType = (type: 'Individual' | 'Company') => {
        setFormData(prev => ({ ...prev, customer_type: type }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name) {
            alert('El nombre es obligatorio.');
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">
                        {initialData?.id ? 'Editar Cliente' : 'Nuevo Cliente'}
                    </h3>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-300 shadow-sm">
                        <button
                            type="button"
                            onClick={() => toggleType('Individual')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isCompany ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Particular
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleType('Company')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isCompany ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Empresa
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {isCompany ? 'Razón Social *' : 'Nombre Completo *'}
                        </label>
                        <input
                            type="text"
                            name="full_name"
                            required
                            value={formData.full_name}
                            onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder={isCompany ? "Ej. Transportes García S.L." : "Ej. Juan Pérez"}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {isCompany ? 'CIF' : 'DNI / NIF'}
                        </label>
                        <input
                            type="text"
                            name="tax_id"
                            value={formData.tax_id}
                            onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="Calle, número..."
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">C.P.</label>
                            <input
                                type="text"
                                name="postal_code"
                                value={formData.postal_code}
                                onChange={handleChange}
                                className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ciudad / Provincia</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                                placeholder="Ciudad"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6 md:mt-0">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-brand-600 text-white font-bold rounded-lg shadow-lg hover:bg-brand-700 transition-colors"
                        >
                            Guardar Cliente
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WorkshopCustomerForm;
