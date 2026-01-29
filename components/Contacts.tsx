
import React, { useState, useEffect } from 'react';
import { Client, WorkOrder } from '../types';
import { getClientsFromSupabase, saveClientToSupabase, deleteClient, saveWorkOrderToSupabase } from '../services/supabaseClient';
import ClientForm from './ClientForm';
import ClientActivity from './ClientActivity';
import { useNavigate } from 'react-router-dom';

const Contacts: React.FC = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
    const [selectedClientForActivity, setSelectedClientForActivity] = useState<Client | null>(null);

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
        if (window.confirm(`¿Está seguro de que desea eliminar a ${client.name}?`)) {
            setLoading(true);
            const result = await deleteClient(client.id);
            if (result.success) {
                const updated = clients.filter(c => c.id !== client.id);
                setClients(updated);
            } else {
                alert(`No se pudo eliminar el cliente: ${result.error}`);
            }
            setLoading(false);
        }
    };

    const handleAddNew = () => {
        setEditingClient(undefined);
        setShowModal(true);
    };

    const handleSave = async (client: Client, createReceptionTicket?: boolean) => {
        // 1. Actualización Optimista de Clientes
        if (editingClient) {
            setClients(prev => prev.map(c => c.id === client.id ? client : c));
        } else {
            setClients(prev => [client, ...prev]);
        }

        // 2. Persistir Cliente
        await saveClientToSupabase(client);

        // 3. Manejar lógica de "Crear Ticket de Recepción"
        if (createReceptionTicket) {
            const dbId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `550e8400-e29b-41d4-a716-${Date.now()}`;
            const ticketId = `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

            const newOrder: WorkOrder = {
                id: dbId,
                expedienteId: ticketId,
                clientId: client.id,
                vehicleId: '',
                status: 'reception',
                repairType: ['Mechanics'],
                entryDate: new Date().toISOString(),
                description: 'Entrada rápida creada desde Contactos.',
                priority: 'Medium',
                totalAmount: 0,
                photos: [],
                team: { technicianIds: [] },
                plate: 'PENDIENTE',
                vehicle: 'Vehículo Desconocido',
                currentKm: 0,
                insuredName: client.name,
                lines: []
            };

            await saveWorkOrderToSupabase(newOrder);

            // Asegurar sincronización local para transición inmediata
            const existingJobs = JSON.parse(localStorage.getItem('vp_kanban_board') || '[]');
            localStorage.setItem('vp_kanban_board', JSON.stringify([newOrder, ...existingJobs]));

            setShowModal(false);
            navigate('/kanban'); // Saltar al Kanban para ver la nueva tarjeta
        } else {
            setShowModal(false);
            fetchClients(); // Refresco estándar
        }
    };

    const getClientTypeLabel = (type: string) => {
        switch (type) {
            case 'Individual': return 'Particular';
            case 'Company': return 'Empresa';
            case 'Fleet': return 'Flota';
            case 'Renting': return 'Renting';
            case 'Insurance': return 'Aseguradora';
            case 'Leasing': return 'Renting / Empresa';
            default: return type;
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 h-[calc(100vh-2rem)] flex flex-col">

            {showModal && (
                <ClientForm
                    initialData={editingClient}
                    onSubmit={handleSave}
                    onCancel={() => setShowModal(false)}
                    showQuickReceptionOption={true}
                />
            )}

            {selectedClientForActivity && (
                <ClientActivity
                    client={selectedClientForActivity}
                    onClose={() => setSelectedClientForActivity(null)}
                    onEdit={() => {
                        setEditingClient(selectedClientForActivity);
                        setSelectedClientForActivity(null);
                        setShowModal(true);
                    }}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        Directorio de Contactos
                    </h1>
                    <p className="text-slate-500 text-sm">Gestione sus clientes externos, empresas y flotas.</p>
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
                            placeholder="Buscar nombre, teléfono..."
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                    </div>

                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-100 sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Nombre / Entidad</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3">Contacto</th>
                                <th className="px-6 py-3">Ubicación</th>
                                <th className="px-6 py-3 text-center">Tarifa</th>
                                <th className="px-6 py-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Cargando contactos...</td></tr>
                            )}

                            {!loading && filteredClients.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron clientes que coincidan con su búsqueda.</td></tr>
                            )}

                            {!loading && filteredClients.map(client => (
                                <tr
                                    key={client.id}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-transparent hover:border-brand-500"
                                    onClick={() => setSelectedClientForActivity(client)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${client.isCompany ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {client.isCompany ? 'E' : 'P'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{client.name}</p>
                                                <p className="text-xs text-slate-500">{client.taxId}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs border ${client.clientType === 'Individual' ? 'bg-slate-50 border-slate-200 text-slate-600' :
                                            client.clientType === 'Fleet' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                'bg-purple-50 border-purple-200 text-purple-700'
                                            }`}>
                                            {getClientTypeLabel(client.clientType)}
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
                                            <button className="text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all">
                                                Ver Actividad
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
