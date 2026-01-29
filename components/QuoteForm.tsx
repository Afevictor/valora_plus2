
import React, { useState, useEffect } from 'react';
import { Quote, Opportunity, Client, QuoteStatus, RepairType, RepairJob } from '../types';
import { getClientsFromSupabase, getWorkOrdersFromSupabase } from '../services/supabaseClient';

interface QuoteFormProps {
    onSubmit: (quote: Quote, opportunity?: Opportunity) => void;
    onCancel: () => void;
}

const QuoteForm: React.FC<QuoteFormProps> = ({ onSubmit, onCancel }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [workOrders, setWorkOrders] = useState<RepairJob[]>([]);

    // Quote State
    const [refId] = useState(`QT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`);
    const [createdAt] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState<string>('');
    const [status, setStatus] = useState<QuoteStatus>('Draft');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('');

    // Opportunity State
    const [addOpportunity, setAddOpportunity] = useState(false);
    const [oppDescription, setOppDescription] = useState('');
    const [oppValue, setOppValue] = useState('');
    const [oppDate, setOppDate] = useState('');
    const [oppType, setOppType] = useState<RepairType>('Maintenance');

    useEffect(() => {
        const loadData = async () => {
            const [cData, wData] = await Promise.all([
                getClientsFromSupabase(),
                getWorkOrdersFromSupabase()
            ]);
            setClients(cData);
            setWorkOrders(wData);
        };
        loadData();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedClientId) {
            alert("Por favor, seleccione un cliente.");
            return;
        }
        if (!amount) {
            alert("Por favor, introduzca un importe para el presupuesto.");
            return;
        }

        const newQuote: Quote = {
            id: window.crypto.randomUUID(),
            number: refId,
            clientId: selectedClientId,
            workOrderId: selectedWorkOrderId,
            vehicleId: '',
            date: createdAt,
            total: parseFloat(amount),
            status: status,
            lines: []
        };

        let newOpp: Opportunity | undefined = undefined;

        if (addOpportunity) {
            if (!oppDescription || !oppValue || !oppDate) {
                alert("Por favor, complete todos los campos de la Oportunidad.");
                return;
            }
            newOpp = {
                id: window.crypto.randomUUID(),
                number: `OPP-${Date.now()}`,
                clientId: selectedClientId,
                workOrderId: selectedWorkOrderId,
                vehicleId: '',
                type: oppType,
                description: oppDescription,
                estimatedValue: parseFloat(oppValue),
                contactDate: oppDate,
                status: 'Pending'
            };
        }

        onSubmit(newQuote, newOpp);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">Nuevo Presupuesto</h2>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">

                    {/* QUOTE SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ID Referencia</label>
                            <input type="text" value={refId} disabled className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Creado el</label>
                            <input type="date" value={createdAt} disabled className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-600" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Orden de Trabajo (OT) <span className="text-red-500">*</span></label>
                            <select
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500"
                                value={selectedWorkOrderId}
                                onChange={(e) => {
                                    const woId = e.target.value;
                                    setSelectedWorkOrderId(woId);
                                    const wo = workOrders.find(w => w.id === woId);
                                    if (wo && wo.clientId) {
                                        setSelectedClientId(wo.clientId);
                                    }
                                }}
                                required
                            >
                                <option value="">-- Seleccionar OT --</option>
                                {workOrders.map(wo => (
                                    <option key={wo.id} value={wo.id}>{wo.expedienteId} - {wo.vehicle} ({wo.plate})</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Cliente Asociado</label>
                            <div className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-600">
                                {selectedClientId ? (clients.find(c => c.id === selectedClientId)?.name || 'Cargando...') : 'Seleccione una OT primero'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Importe Total (€) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 font-bold"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Estado</label>
                            <select
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                            >
                                <option value="Draft">Borrador</option>
                                <option value="Sent">Enviado</option>
                                <option value="Accepted">Aceptado</option>
                                <option value="Rejected">Rechazado</option>
                            </select>
                        </div>
                    </div>

                    {/* OPPORTUNITY TOGGLE */}
                    <div className="border-t border-slate-200 pt-6">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={addOpportunity}
                                    onChange={(e) => setAddOpportunity(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700">¿Añadir Oportunidad Futura?</span>
                        </label>

                        {addOpportunity && (
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 animate-fade-in space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Tipo de Oportunidad</label>
                                    <select
                                        className="w-full p-2 border border-purple-200 rounded text-sm"
                                        value={oppType}
                                        onChange={(e) => setOppType(e.target.value as RepairType)}
                                    >
                                        <option value="Maintenance">Mantenimiento</option>
                                        <option value="Tyres">Neumáticos</option>
                                        <option value="BodyPaint">Chapa y Pintura</option>
                                        <option value="Mechanics">Mecánica</option>
                                        <option value="MOT">ITV</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-purple-200 rounded text-sm"
                                        placeholder="ej. Cambio de pastillas de freno"
                                        value={oppDescription}
                                        onChange={(e) => setOppDescription(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Valor Est. (€)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-purple-200 rounded text-sm"
                                            value={oppValue}
                                            onChange={(e) => setOppValue(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Fecha Seguimiento</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border border-purple-200 rounded text-sm"
                                            value={oppDate}
                                            onChange={(e) => setOppDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-bold shadow-md"
                        >
                            Guardar {addOpportunity ? 'Presupuesto y Oportunidad' : 'Presupuesto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuoteForm;