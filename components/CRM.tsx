import React, { useState, useEffect } from 'react';
import { Quote, Opportunity, Client } from '../types';
import { getQuotes, getOpportunities, saveQuote, saveOpportunity, getClientsFromSupabase, deleteQuote, deleteOpportunity } from '../services/supabaseClient';
import QuoteForm from './QuoteForm';

const CRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quotes' | 'opportunities'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [q, o, c] = await Promise.all([
        getQuotes(),
        getOpportunities(),
        getClientsFromSupabase()
    ]);
    setQuotes(q);
    setOpportunities(o);
    setClients(c);
    setLoading(false);
  };

  const getClientName = (id: string) => {
      const c = clients.find(cl => cl.id === id);
      return c ? c.name : 'Unknown Client';
  };

  const handleSaveNew = async (newQuote: Quote, newOpp?: Opportunity) => {
      await saveQuote(newQuote);
      if (newOpp) {
          await saveOpportunity(newOpp);
      }
      await fetchData();
      setShowQuoteModal(false);
  };

  const handleDeleteQuote = async (id: string) => {
      if(window.confirm("Delete this quote?")) {
          await deleteQuote(id);
          setQuotes(prev => prev.filter(q => q.id !== id));
      }
  };

  const handleDeleteOpp = async (id: string) => {
      if(window.confirm("Delete this opportunity?")) {
          await deleteOpportunity(id);
          setOpportunities(prev => prev.filter(o => o.id !== id));
      }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'Draft': return 'bg-gray-100 text-gray-800';
          case 'Sent': return 'bg-blue-100 text-blue-800';
          case 'Accepted': return 'bg-green-100 text-green-800';
          case 'Rejected': return 'bg-red-100 text-red-800';
          case 'Closed Won': return 'bg-green-100 text-green-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-[calc(100vh-2rem)]">
      
      {showQuoteModal && (
          <QuoteForm 
            onSubmit={handleSaveNew} 
            onCancel={() => setShowQuoteModal(false)} 
          />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM & Sales</h1>
          <p className="text-slate-500">Quote management and commercial follow-up.</p>
        </div>
        <button 
            onClick={() => setShowQuoteModal(true)}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 shadow-sm flex items-center gap-2"
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Quote
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex space-x-8">
            <button
                onClick={() => setActiveTab('quotes')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'quotes' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                Quotes
            </button>
            <button
                onClick={() => setActiveTab('opportunities')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'opportunities' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                Future Opportunities
            </button>
        </nav>
      </div>

      {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Loading CRM Data...
          </div>
      ) : (
        <>
            {activeTab === 'quotes' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ref</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {quotes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">No quotes found. Create one!</td>
                                </tr>
                            )}
                            {quotes.map(q => (
                                <tr key={q.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-brand-600">{q.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{q.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-bold">{getClientName(q.clientId)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">{q.total.toFixed(2)} €</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusBadge(q.status)}`}>{q.status}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button 
                                            onClick={() => handleDeleteQuote(q.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'opportunities' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {opportunities.length === 0 && (
                        <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                            No future opportunities scheduled.
                        </div>
                    )}
                    {opportunities.map(opt => (
                        <div key={opt.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group">
                            
                            <button 
                                onClick={() => handleDeleteOpp(opt.id)}
                                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="flex justify-between items-start mb-4 pr-6">
                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold uppercase">{opt.type}</span>
                                <span className={`text-xs font-bold ${opt.status === 'Pending' ? 'text-orange-500' : 'text-green-500'}`}>{opt.status}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">{getClientName(opt.clientId)}</h3>
                            <p className="text-sm text-slate-600 mb-2">{opt.description}</p>
                            <p className="text-sm text-slate-500 mb-4">Est. Value: <span className="font-semibold text-slate-700">{opt.estimatedValue} €</span></p>
                            
                            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Follow-up: {opt.contactDate}
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