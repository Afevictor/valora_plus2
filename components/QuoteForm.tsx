import React, { useState, useEffect } from 'react';
import { Quote, Opportunity, Client, QuoteStatus, RepairType } from '../types';
import { getClientsFromSupabase } from '../services/supabaseClient';

interface QuoteFormProps {
    onSubmit: (quote: Quote, opportunity?: Opportunity) => void;
    onCancel: () => void;
}

const QuoteForm: React.FC<QuoteFormProps> = ({ onSubmit, onCancel }) => {
    const [clients, setClients] = useState<Client[]>([]);
    
    // Quote State
    const [refId] = useState(`QT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`);
    const [createdAt] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState<string>('');
    const [status, setStatus] = useState<QuoteStatus>('Draft');
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    // Opportunity State
    const [addOpportunity, setAddOpportunity] = useState(false);
    const [oppDescription, setOppDescription] = useState('');
    const [oppValue, setOppValue] = useState('');
    const [oppDate, setOppDate] = useState('');
    const [oppType, setOppType] = useState<RepairType>('Maintenance');

    useEffect(() => {
        const loadClients = async () => {
            const data = await getClientsFromSupabase();
            setClients(data);
        };
        loadClients();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedClientId) {
            alert("Please select a client.");
            return;
        }
        if (!amount) {
            alert("Please enter a quote amount.");
            return;
        }

        const newQuote: Quote = {
            id: refId,
            clientId: selectedClientId,
            vehicleId: '', // Ideally would select vehicle too, but keeping it simple as requested
            date: createdAt,
            total: parseFloat(amount),
            status: status,
            lines: [] // Empty lines for now as per requirement "amount" input
        };

        let newOpp: Opportunity | undefined = undefined;

        if (addOpportunity) {
            if (!oppDescription || !oppValue || !oppDate) {
                alert("Please fill in all Opportunity fields.");
                return;
            }
            newOpp = {
                id: `OPP-${Date.now()}`,
                clientId: selectedClientId,
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
                    <h2 className="text-lg font-bold text-slate-800">New Quote</h2>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
                    
                    {/* QUOTE SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference ID</label>
                            <input type="text" value={refId} disabled className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Created At</label>
                            <input type="date" value={createdAt} disabled className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-600" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Client <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500"
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Client --</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.taxId ? `(${c.taxId})` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Total Amount (€) <span className="text-red-500">*</span></label>
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
                            <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                            <select 
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                            >
                                <option value="Draft">Draft</option>
                                <option value="Sent">Sent</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Rejected">Rejected</option>
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
                            <span className="text-sm font-bold text-slate-700">Add Future Opportunity?</span>
                        </label>

                        {addOpportunity && (
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 animate-fade-in space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Opportunity Type</label>
                                    <select 
                                        className="w-full p-2 border border-purple-200 rounded text-sm"
                                        value={oppType}
                                        onChange={(e) => setOppType(e.target.value as RepairType)}
                                    >
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Tyres">Tyres</option>
                                        <option value="BodyPaint">Body & Paint</option>
                                        <option value="Mechanics">Mechanics</option>
                                        <option value="MOT">MOT (ITV)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Description</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-purple-200 rounded text-sm"
                                        placeholder="e.g. Change brake pads"
                                        value={oppDescription}
                                        onChange={(e) => setOppDescription(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Est. Value (€)</label>
                                        <input 
                                            type="number" 
                                            className="w-full p-2 border border-purple-200 rounded text-sm"
                                            value={oppValue}
                                            onChange={(e) => setOppValue(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Follow-up Date</label>
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
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-bold shadow-md"
                        >
                            Save Quote {addOpportunity && '& Opportunity'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuoteForm;