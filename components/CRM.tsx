
import React, { useState, useEffect } from 'react';
import { Quote, Opportunity, Client, RepairJob } from '../types';
import { getQuotes, getOpportunities, saveQuote, saveOpportunity, getClientsFromSupabase, deleteQuote, deleteOpportunity, getWorkOrdersFromSupabase } from '../services/supabaseClient';
import QuoteForm from './QuoteForm';

const CRM: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'quotes' | 'opportunities'>('quotes');
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [workOrders, setWorkOrders] = useState<RepairJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [q, o, c, w] = await Promise.all([
                getQuotes(),
                getOpportunities(),
                getClientsFromSupabase(),
                getWorkOrdersFromSupabase()
            ]);
            setQuotes(q);
            setOpportunities(o);
            setClients(c);
            setWorkOrders(w);
        } catch (error) {
            console.error("Error fetching CRM data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getClientName = (id: string) => {
        const c = clients.find(cl => cl.id === id);
        return c ? c.name : 'Cliente Desconocido';
    };

    const getWorkOrderRef = (id: string | undefined) => {
        if (!id) return 'Sin OT';
        const wo = workOrders.find(w => w.id === id);
        return wo ? wo.expedienteId : 'Ref. No encontrada';
    };

    const handleSaveNew = async (newQuote: Quote, newOpp?: Opportunity) => {
        try {
            await saveQuote(newQuote);
            if (newOpp) {
                await saveOpportunity(newOpp);
            }
            setNotification({ message: 'Presupuesto guardado correctamente', type: 'success' });
            setTimeout(() => setNotification(null), 3000);
            await fetchData();
            setShowQuoteModal(false);
        } catch (error) {
            setNotification({ message: 'Error al guardar el presupuesto', type: 'error' });
        }
    };

    const handleDeleteQuote = async (id: string) => {
        if (window.confirm("¿Eliminar este presupuesto?")) {
            await deleteQuote(id);
            setQuotes(prev => prev.filter(q => q.id !== id));
        }
    };

    const handleDeleteOpp = async (id: string) => {
        if (window.confirm("¿Eliminar esta oportunidad?")) {
            await deleteOpportunity(id);
            setOpportunities(prev => prev.filter(o => o.id !== id));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Draft': return 'bg-gray-100 text-gray-800';
            case 'Sent': return 'bg-blue-100 text-blue-800';
            case 'Accepted': return 'bg-green-100 text-green-800 text-emerald-700 bg-emerald-50';
            case 'Rejected': return 'bg-red-100 text-red-800';
            case 'Closed Won': return 'bg-emerald-100 text-emerald-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Draft': return 'Borrador';
            case 'Sent': return 'Enviado';
            case 'Accepted': return 'Aceptado';
            case 'Rejected': return 'Rechazado';
            case 'Closed Won': return 'Ganado';
            case 'Pending': return 'Pendiente';
            default: return status;
        }
    };

    const filteredQuotes = quotes.filter(q => {
        const search = searchTerm.toLowerCase();
        const clientName = getClientName(q.clientId).toLowerCase();
        const ref = (q.number || q.id).toLowerCase();
        const ot = getWorkOrderRef(q.workOrderId).toLowerCase();
        return clientName.includes(search) || ref.includes(search) || ot.includes(search);
    });

    const filteredOpps = opportunities.filter(o => {
        const search = searchTerm.toLowerCase();
        const clientName = getClientName(o.clientId).toLowerCase();
        const desc = o.description.toLowerCase();
        return clientName.includes(search) || desc.includes(search);
    });

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 min-h-[calc(100vh-2rem)] animate-fade-in">

            {notification && (
                <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in-up ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    <div className="bg-white/20 p-1 rounded-full text-white">
                        {notification.type === 'success' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                    </div>
                    <span className="font-bold text-sm tracking-tight">{notification.message}</span>
                </div>
            )}

            {showQuoteModal && (
                <QuoteForm
                    onSubmit={handleSaveNew}
                    onCancel={() => setShowQuoteModal(false)}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase mb-1">CRM Estratégico</h1>
                    <p className="text-slate-500 font-medium">Maximice sus ventas y fidelice a sus clientes.</p>
                </div>
                <button
                    onClick={() => setShowQuoteModal(true)}
                    className="w-full md:w-auto bg-brand-600 text-white px-6 py-3 rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    <span className="font-black uppercase text-xs tracking-widest">Nuevo Presupuesto</span>
                </button>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Presupuestos Aceptados</p>
                    <p className="text-3xl font-black text-emerald-600">{quotes.filter(q => q.status === 'Accepted' || q.status === 'Closed Won').length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversion Rate</p>
                    <p className="text-3xl font-black text-brand-600">
                        {quotes.length > 0 ? ((quotes.filter(q => q.status === 'Accepted' || q.status === 'Closed Won').length / quotes.length) * 100).toFixed(0) : 0}%
                    </p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Oportunidades Pendientes</p>
                    <p className="text-3xl font-black text-purple-600">{opportunities.filter(o => o.status === 'Pending').length}</p>
                </div>
            </div>

            {/* Filters & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('quotes')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'quotes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Presupuestos
                    </button>
                    <button
                        onClick={() => setActiveTab('opportunities')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'opportunities' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Oportunidades
                    </button>
                </div>

                <div className="relative w-full md:w-72">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, ref..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                    />
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-4">
                    <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="font-bold text-xs uppercase tracking-[0.2em]">Cargando inteligencia comercial...</span>
                </div>
            ) : (
                <>
                    {activeTab === 'quotes' && (
                        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100">
                                    <thead>
                                        <tr className="bg-slate-50/50">
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencia</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">OT / Relación</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Importe</th>
                                            <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                            <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredQuotes.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">No se encontraron resultados para su búsqueda.</td>
                                            </tr>
                                        )}
                                        {filteredQuotes.map(q => (
                                            <tr key={q.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap font-bold text-brand-600 text-sm font-mono">{q.number || q.id.substring(0, 8)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                            {getClientName(q.clientId).charAt(0)}
                                                        </div>
                                                        <span className="font-bold text-slate-900 text-sm tracking-tight">{getClientName(q.clientId)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">{q.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-black">{getWorkOrderRef(q.workOrderId)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">{q.total.toFixed(2)} €</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getStatusBadge(q.status)}`}>
                                                        {getStatusLabel(q.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleDeleteQuote(q.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Eliminar"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'opportunities' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                            {filteredOpps.length === 0 && (
                                <div className="col-span-full p-20 text-center text-slate-400 bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                            <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                        </div>
                                        <p className="font-bold text-sm uppercase tracking-widest italic opacity-50">No hay oportunidades comerciales activas.</p>
                                    </div>
                                </div>
                            )}
                            {filteredOpps.map(opt => (
                                <div key={opt.id} className="bg-white p-8 rounded-[40px] shadow-xl shadow-slate-200/60 border border-slate-200 hover:shadow-2xl hover:shadow-brand-500/10 transition-all relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                                    <button
                                        onClick={() => handleDeleteOpp(opt.id)}
                                        className="absolute top-6 right-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-50 rounded-full"
                                        title="Eliminar"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>

                                    <div className="flex justify-between items-start mb-6">
                                        <span className="bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            {opt.type === 'Upsell' ? 'Venta Adicional' : opt.type === 'Marketing' ? 'Marketing' : 'Mantenimiento'}
                                        </span>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${opt.status === 'Pending' ? 'text-orange-500' : 'text-emerald-500'}`}>
                                            {getStatusLabel(opt.status)}
                                        </span>
                                    </div>

                                    <div className="mb-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                        <h3 className="text-lg font-black text-slate-900 mb-1">{getClientName(opt.clientId)}</h3>
                                        <p className="text-xs font-bold text-slate-500">Relacionado con OT: {getWorkOrderRef(opt.workOrderId)}</p>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-2xl mb-8">
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{opt.description}"</p>
                                    </div>

                                    <div className="flex justify-between items-center bg-slate-100/50 p-4 rounded-3xl">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor Estimado</p>
                                            <p className="text-xl font-black text-slate-900">{opt.estimatedValue.toFixed(2)} €</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Próximo Contacto</p>
                                            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs justify-end">
                                                <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {opt.contactDate}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CRM;