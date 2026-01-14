
import React, { useState, useEffect } from 'react';
import { Client, RepairJob } from '../types';

interface ClientFormProps {
    initialData?: Partial<Client>;
    onSubmit: (client: Client, createReceptionTicket?: boolean) => void;
    onCancel: () => void;
    showQuickReceptionOption?: boolean;
}

// Generador de UUID Robusto
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch (e) { }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, showQuickReceptionOption = false }) => {
    const [isCompany, setIsCompany] = useState(initialData?.isCompany || false);
    const [createReceptionChecked, setCreateReceptionChecked] = useState(false);

    const [formData, setFormData] = useState<Partial<Client>>({
        id: initialData?.id || generateUUID(),
        clientType: initialData?.clientType || 'Individual',
        name: initialData?.name || '',
        taxId: initialData?.taxId || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        phoneAlternative: initialData?.phoneAlternative || '',
        address: initialData?.address || '',
        city: initialData?.city || '',
        zip: initialData?.zip || '',
        province: initialData?.province || '',
        country: initialData?.country || 'España',
        paymentMethod: initialData?.paymentMethod || 'Cash',
        paymentTerms: initialData?.paymentTerms || 'Cash',
        preferredChannel: initialData?.preferredChannel || 'WhatsApp',
        tariff: initialData?.tariff || 'General',
        billingAddress: initialData?.billingAddress || '',
        allowCommercialComms: initialData?.allowCommercialComms ?? true,
        ...initialData
    });

    const [contactPerson, setContactPerson] = useState(initialData?.contactPerson || {
        name: '', role: '', directPhone: '', directEmail: ''
    });

    const [history, setHistory] = useState<RepairJob[]>([]);

    const handleClientTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const type = e.target.value as any;
        const shouldBeCompany = ['Company', 'Fleet', 'Renting', 'Insurance'].includes(type);

        setFormData(prev => ({ ...prev, clientType: type }));
        setIsCompany(shouldBeCompany);
    };

    useEffect(() => {
        if (isCompany && formData.clientType === 'Individual') {
            setFormData(prev => ({ ...prev, clientType: 'Company' }));
        } else if (!isCompany && ['Company', 'Fleet', 'Renting', 'Insurance'].includes(formData.clientType || '')) {
            setFormData(prev => ({ ...prev, clientType: 'Individual' }));
        }
    }, [isCompany]);

    useEffect(() => {
        if (initialData?.id) {
            try {
                const saved = localStorage.getItem('vp_kanban_board');
                if (saved) {
                    const allJobs: RepairJob[] = JSON.parse(saved);
                    const clientJobs = allJobs.filter(job => job.clientId === initialData.id);
                    setHistory(clientJobs);
                }
            } catch (e) {
                console.error("Error al cargar historial del cliente", e);
            }
        }
    }, [initialData?.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setContactPerson(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!formData.name) {
            alert("El nombre es obligatorio");
            return;
        }

        const finalData: Client = {
            id: formData.id!,
            clientType: formData.clientType || 'Individual',
            isCompany: isCompany,
            name: formData.name || '',
            taxId: formData.taxId || '',
            phone: formData.phone || '',
            email: formData.email || '',
            address: formData.address || '',
            city: formData.city || '',
            zip: formData.zip || '',
            province: formData.province || '',
            country: formData.country || 'España',
            paymentMethod: formData.paymentMethod as any || 'Cash',
            paymentTerms: formData.paymentTerms as any || 'Cash',
            preferredChannel: formData.preferredChannel as any || 'Phone',
            tariff: formData.tariff as any || 'General',
            allowCommercialComms: !!formData.allowCommercialComms,
            phoneAlternative: formData.phoneAlternative,
            billingAddress: formData.billingAddress,
            contactPerson: isCompany ? contactPerson : undefined
        };

        onSubmit(finalData, createReceptionChecked);
    };

    const isValid = !!formData.name;

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            reception: 'Recepción',
            disassembly: 'Desmontaje',
            bodywork: 'Chapa/Mec',
            paint: 'Pintura',
            admin_close: 'Cierre Adm.',
            finished: 'Finalizado'
        };
        return map[status] || status;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

                <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex justify-between items-center flex-shrink-0 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {initialData?.id ? 'Perfil del Cliente' : 'Nuevo Cliente'}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {initialData?.id ? 'Gestión de datos y vista de historial.' : 'Complete todos los campos obligatorios.'}
                        </p>
                    </div>

                    <div className="flex bg-white rounded-lg p-1 border border-slate-300 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setIsCompany(false)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!isCompany ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Particular
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCompany(true)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${isCompany ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Empresa / Flota
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <form id="client-form" onSubmit={handleSubmit} className="space-y-8">

                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4 border-b pb-2">1. Identificación y Datos Fiscales</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Cliente</label>
                                    <select
                                        name="clientType"
                                        value={formData.clientType}
                                        onChange={handleClientTypeChange}
                                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="Individual">Particular</option>
                                        <option value="Company">Empresa</option>
                                        <option value="Fleet">Flota</option>
                                        <option value="Renting">Renting</option>
                                        <option value="Insurance">Aseguradora</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {isCompany ? 'Razón Social' : 'Nombre Completo'} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500"
                                        placeholder="Requerido"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {isCompany ? 'CIF' : 'DNI / NIE'}
                                    </label>
                                    <input
                                        type="text"
                                        name="taxId"
                                        value={formData.taxId}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4 border-b pb-2">2. Dirección Postal</h3>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                <div className="md:col-span-6 lg:col-span-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Completa</label>
                                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Población</label>
                                    <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">C.P.</label>
                                    <input type="text" name="zip" value={formData.zip} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Provincia</label>
                                    <input type="text" name="province" value={formData.province} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
                                    <input type="text" name="country" value={formData.country} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4 border-b pb-2">3. Detalles de Contacto</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono Principal</label>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono Alternativo</label>
                                    <input type="tel" name="phoneAlternative" value={formData.phoneAlternative} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" placeholder="Opcional" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Canal Preferido</label>
                                    <select name="preferredChannel" value={formData.preferredChannel} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded">
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Phone">Teléfono</option>
                                        <option value="Email">Email</option>
                                        <option value="SMS">SMS</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {isCompany && (
                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">4. Persona de Contacto (Empresa)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nombre de Contacto</label>
                                        <input type="text" name="name" value={contactPerson.name} onChange={handleContactChange} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Cargo</label>
                                        <input type="text" name="role" value={contactPerson.role} onChange={handleContactChange} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Teléfono Directo</label>
                                        <input type="tel" name="directPhone" value={contactPerson.directPhone} onChange={handleContactChange} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Email Directo</label>
                                        <input type="email" name="directEmail" value={contactPerson.directEmail} onChange={handleContactChange} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4 border-b pb-2">5. Comercial y Facturación</h3>

                            {isCompany && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección de Facturación (si es distinta)</label>
                                    <input type="text" name="billingAddress" value={formData.billingAddress} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded" placeholder="Dejar vacío si es la misma" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago</label>
                                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded">
                                        <option value="Cash">Efectivo</option>
                                        <option value="POS">Tarjeta / TPV</option>
                                        <option value="Transfer">Transferencia</option>
                                        <option value="Financing">Financiación</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa</label>
                                    <select name="tariff" value={formData.tariff} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded">
                                        <option value="General">General</option>
                                        <option value="Insurance">Compañía</option>
                                        <option value="Fleet">Flota / Pro</option>
                                        <option value="Preferred">VIP</option>
                                    </select>
                                </div>
                                {isCompany && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Condiciones de Pago</label>
                                        <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded">
                                            <option value="Cash">Contado</option>
                                            <option value="30 Days">30 días</option>
                                            <option value="60 Days">60 días</option>
                                            <option value="90 Days">90 días</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="allowComms"
                                    name="allowCommercialComms"
                                    checked={formData.allowCommercialComms}
                                    onChange={handleChange}
                                    className="rounded text-brand-600 focus:ring-brand-500"
                                />
                                <label htmlFor="allowComms" className="text-sm text-slate-700">Autorizo comunicaciones comerciales y recordatorios (RGPD)</label>
                            </div>
                        </div>

                        {initialData?.id && (
                            <div className="animate-fade-in">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4 border-b pb-2 flex items-center gap-2">
                                    6. Historial de Reparaciones (OTs)
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{history.length}</span>
                                </h3>

                                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                    {history.length > 0 ? (
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3">Fecha</th>
                                                    <th className="px-4 py-3">OT / ID</th>
                                                    <th className="px-4 py-3">Vehículo</th>
                                                    <th className="px-4 py-3">Tipo</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                    <th className="px-4 py-3 text-center">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {history.map((job, idx) => (
                                                    <tr key={idx} className="bg-white hover:bg-slate-50">
                                                        <td className="px-4 py-3 text-slate-600">{job.entryDate || '-'}</td>
                                                        <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">
                                                            {job.expedienteId || job.id.substring(0, 8)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-slate-800">{job.vehicle}</div>
                                                            <div className="text-xs text-slate-500">{job.plate}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            {Array.isArray(job.repairType) ? job.repairType.join(', ') : job.repairType || job.businessLine || 'General'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                                                            {job.totalAmount ? `${job.totalAmount} €` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">
                                                                {getStatusLabel(job.status)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-sm">
                                            <p>No se encontraron órdenes de trabajo para este cliente.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-between items-center rounded-b-xl flex-shrink-0">
                    {showQuickReceptionOption && !initialData?.id ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="createReception"
                                checked={createReceptionChecked}
                                onChange={(e) => setCreateReceptionChecked(e.target.checked)}
                                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                            />
                            <label htmlFor="createReception" className="text-sm font-bold text-slate-700 cursor-pointer">
                                Crear Ticket de Recepción inmediatamente
                            </label>
                        </div>
                    ) : (
                        <div></div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="client-form"
                            disabled={!isValid}
                            className={`px-6 py-2 text-white rounded-lg font-bold shadow-lg transition-all ${isValid ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-300 cursor-not-allowed'
                                }`}
                        >
                            {createReceptionChecked ? 'Guardar e Iniciar Recepción' : 'Guardar Cliente'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientForm;
