import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVehicle, getClientsFromSupabase } from '../services/supabaseClient';
import { Client } from '../types';

const VehicleDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [vehicle, setVehicle] = useState<any>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            const v = await getVehicle(id);
            setVehicle(v);
            
            // Fixed: Use correct camelCase property name 'clientId' as defined in types.ts
            if (v && v.clientId) {
                const clients = await getClientsFromSupabase();
                // Fixed: Use correct camelCase property name 'clientId'
                const c = clients.find(cl => cl.id === v.clientId);
                setClient(c || null);
            }
            setLoading(false);
        };
        load();
    }, [id]);

    if (loading) return <div className="p-8">Loading...</div>;
    if (!vehicle) return <div className="p-8">Vehicle not found.</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <button onClick={() => navigate(-1)} className="mb-4 text-slate-500 hover:text-brand-600 flex items-center gap-1">
                &larr; Back
            </button>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{vehicle.brand} {vehicle.model}</h1>
                        <span className="inline-block mt-2 bg-slate-100 text-slate-800 px-3 py-1 rounded font-mono font-bold border border-slate-200">
                            {vehicle.plate}
                        </span>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 uppercase font-bold">Registration Date</p>
                        <p className="text-lg text-slate-800">
                            {vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                    <div>
                        <h3 className="font-bold text-slate-700 mb-4">Vehicle Information</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-slate-500">VIN</dt>
                                <dd className="font-mono font-medium">{vehicle.vin || '-'}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-slate-500">Mileage</dt>
                                <dd className="font-medium">{vehicle.km ? `${vehicle.km} km` : '-'}</dd>
                            </div>
                             <div className="flex justify-between">
                                <dt className="text-slate-500">Internal ID</dt>
                                <dd className="font-mono text-xs text-slate-400">{vehicle.id}</dd>
                            </div>
                        </dl>
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-slate-700 mb-4">Owner / Client</h3>
                        {client ? (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <p className="font-bold text-slate-900">{client.name}</p>
                                <p className="text-sm text-slate-500">{client.email}</p>
                                <p className="text-sm text-slate-500">{client.phone}</p>
                            </div>
                        ) : (
                            <p className="text-slate-400 italic">No client linked.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleDetail;