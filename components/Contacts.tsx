
import React, { useState, useEffect } from 'react';
import { Client, WorkOrder } from '../types';
import { getClientsFromSupabase, saveClientToSupabase, deleteClient, saveWorkOrderToSupabase } from '../services/supabaseClient';
import ClientForm from './ClientForm';
import { useNavigate } from 'react-router-dom';

const Contacts: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const data = await getClientsFromSupabase();
    if (data && data.length > 0) {
      setClients(data);
    } else {
      setClients([]);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm) ||
    client.taxId.toLowerCase().includes(searchTerm)
  );

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowModal(true);
  };

  const handleDelete = async (e: React.MouseEvent, client: Client) => {
      e.stopPropagation();
      if (window.confirm(`Are you sure you want to delete ${client.name}?`)) {
          setLoading(true);
          const result = await deleteClient(client.id);
          if (result.success) {
              const updated = clients.filter(c => c.id !== client.id);
              setClients(updated);
          } else {
              alert(`Could not delete client: ${result.error}`);
          }
          setLoading(false);
      }
  };

  const handleAddNew = () => {
    setEditingClient(undefined);
    setShowModal(true);
  };

  const handleSave = async (client: Client, createReceptionTicket?: boolean) => {
    // 1. Optimistic Client Update
    if (editingClient) {
        setClients(prev => prev.map(c => c.id === client.id ? client : c));
    } else {
        setClients(prev => [client, ...prev]);
    }
    
    // 2. Persist Client
    await saveClientToSupabase(client);
    
    // 3. Handle "Create Reception Ticket" logic
    if (createReceptionTicket) {
        // Use a UUID for the database ID
        const dbId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `550e8400-e29b-41d4-a716-${Date.now()}`;
        const ticketId = `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

        const newOrder: WorkOrder = {
            id: dbId, 
            expedienteId: ticketId, // Store human readable ID here
            clientId: client.id,
            vehicleId: '',
            status: 'reception', // Forces it into the first column of Kanban
            repairType: ['Mechanics'], // Default
            entryDate: new Date().toISOString(),
            description: 'Quick entry created from Contacts.',
            priority: 'Medium',
            totalAmount: 0,
            photos: [],
            team: { technicianIds: [] },
            // Placeholder Data
            plate: 'PENDING',
            vehicle: 'Unknown Vehicle',
            currentKm: 0,
            insuredName: client.name,
            lines: [] 
        };

        await saveWorkOrderToSupabase(newOrder);
        
        // Ensure local sync for immediate transition
        const existingJobs = JSON.parse(localStorage.getItem('vp_kanban_board') || '[]');
        localStorage.setItem('vp_kanban_board', JSON.stringify([newOrder, ...existingJobs]));
        
        setShowModal(false);
        navigate('/kanban'); // Jump to Kanban to see the new card
    } else {
        setShowModal(false);
        fetchClients(); // Standard refresh
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-2rem)] flex flex-col">
      
      {showModal && (
        <ClientForm 
            initialData={editingClient}
            onSubmit={handleSave}
            onCancel={() => setShowModal(false)}
            showQuickReceptionOption={true} // Enable the checkbox
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
             Contacts Directory
          </h1>
          <p className="text-slate-500 text-sm">Manage your external clients, companies, and fleets.</p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input 
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-brand-500 focus:border-brand-500 text-sm"
                    placeholder="Search name, phone..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
            </div>
            <button 
                onClick={handleAddNew}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Add Client
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-100 sticky top-0">
                    <tr>
                        <th className="px-6 py-3">Name / Entity</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Contact Info</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3 text-center">Tariff</th>
                        <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading contacts...</td></tr>
                    )}
                    
                    {!loading && filteredClients.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No clients found matching your search.</td></tr>
                    )}

                    {!loading && filteredClients.map(client => (
                        <tr key={client.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleEdit(client)}>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${client.isCompany ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {client.isCompany ? 'C' : 'I'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{client.name}</p>
                                        <p className="text-xs text-slate-500">{client.taxId}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs border ${
                                    client.clientType === 'Individual' ? 'bg-slate-50 border-slate-200 text-slate-600' :
                                    client.clientType === 'Fleet' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                    'bg-purple-50 border-purple-200 text-purple-700'
                                }`}>
                                    {client.clientType}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                                <div className="flex flex-col text-xs">
                                    <span className="flex items-center gap-1"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {client.phone}</span>
                                    <span className="flex items-center gap-1 mt-1"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> {client.email}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">
                                {client.city} <span className="text-slate-400 text-xs">({client.province})</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                                    {client.tariff || 'General'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-3">
                                    <button className="text-brand-600 hover:underline text-sm font-medium">
                                        Edit
                                    </button>
                                    <button 
                                        onClick={(e) => handleDelete(e, client)} 
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                        title="Delete Client"
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
    </div>
  );
};

export default Contacts;
