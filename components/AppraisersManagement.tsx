import React, { useState, useEffect } from 'react';
import { getBitrixUsers, BitrixUser } from '../services/bitrixService';

const AppraisersManagement: React.FC = () => {
    const [experts, setExperts] = useState<BitrixUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchExperts = async () => {
            setIsLoading(true);
            try {
                // Fetch Bitrix users as they represent our "Appraisers" (Peritos)
                const users = await getBitrixUsers();
                setExperts(users);
            } catch (e) {
                console.error("Error fetching appraisers:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchExperts();
    }, []);

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Panel de Gestión de Peritos
                </h1>
                <p className="text-slate-500 text-sm">Administración y seguimiento del equipo pericial.</p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {experts.map(expert => (
                        <div key={expert.ID} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                            {expert.PERSONAL_PHOTO ? (
                                <img src={expert.PERSONAL_PHOTO} alt={expert.NAME} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
                                    {expert.NAME.substring(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-slate-800">{expert.NAME} {expert.LAST_NAME}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">{expert.WORK_POSITION || 'Perito'}</p>
                                <div className="mt-2 flex gap-2">
                                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${expert.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {expert.ACTIVE ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {experts.length === 0 && (
                        <div className="col-span-full p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No se encontraron peritos registrados en Bitrix.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AppraisersManagement;
