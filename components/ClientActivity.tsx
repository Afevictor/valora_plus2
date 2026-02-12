
import React, { useState, useEffect } from 'react';
import { Client, WorkOrder, Vehicle } from '../types';
import { getWorkOrdersByClient, getFilesForExpediente, getVehiclesByClient, supabase } from '../services/supabaseClient';

interface ClientActivityProps {
    client: Client;
    onClose: () => void;
    onEdit: () => void;
}

const ClientActivity: React.FC<ClientActivityProps> = ({ client, onClose, onEdit }) => {
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderFiles, setOrderFiles] = useState<Record<string, any[]>>({});
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
    const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const strip = (s: any) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

    useEffect(() => {
        const loadActivity = async () => {
            setLoading(true);
            try {
                const normName = (client.name || '').toLowerCase().trim();
                const strip = (s: any) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

                console.log(`[ACTIVITY DOSSIER] Targeting: ${client.name} (ID: ${client.id})`);

                // 1. Fetch EVERYTHING (Parallel Scan)
                const [feedRes, ordersRes, valuationsRes, vehiclesRes, filesRes] = await Promise.all([
                    supabase.from('client_activity_feed').select('*').order('created_at', { ascending: false }),
                    supabase.from('work_orders').select('*'),
                    supabase.from('valuations').select('*'),
                    supabase.from('vehicles').select('*'),
                    supabase.from('workshop_files').select('*')
                ]);

                // 2. Map Vehicles
                const myVehicles = (vehiclesRes.data || []).map(v => {
                    const raw = typeof v.raw_data === 'string' ? JSON.parse(v.raw_data) : (v.raw_data || {});
                    const plt = raw.plate || (v as any).plate || '';
                    return { ...raw, id: v.id, plate: plt, brand: raw.brand || 'VEHICLE', model: raw.model || (plt ? `PLATE: ${plt}` : 'DETAILS') };
                }).filter(v => v.clientId === client.id || v.client_id === client.id || (normName.length > 3 && (v.insuredName || v.name || '').toLowerCase().includes(normName)));

                const vPlates = new Set(myVehicles.map(v => strip(v.plate)).filter(Boolean));

                // 3. Process Activity Feed (The Primary Request Source)
                const activityTimeline = (feedRes.data || []).filter(f => {
                    const isClientMatch = f.client_id === client.id || (client.taxId && f.client_id === client.taxId);
                    const isPlateMatch = f.plate && vPlates.has(strip(f.plate));
                    const isNameMatch = JSON.stringify(f).toLowerCase().includes(normName);

                    return isClientMatch || isPlateMatch || isNameMatch;
                }).map(f => {
                    const rawAssets = Array.isArray(f.file_assets) ? f.file_assets : [];

                    return {
                        ...f,
                        type: 'feed',
                        date: f.created_at,
                        title: f.activity_type?.toUpperCase().replace('_', ' ') || 'REPAIR REQUEST',
                        description: f.summary,
                        files: rawAssets.map((as: any, i: number) => ({
                            id: `fa-${f.id}-${i}`,
                            publicUrl: as.url || as.publicUrl,
                            original_filename: as.name || as.original_filename || 'Attachment',
                            mime_type: as.type === 'image' ? 'image/jpeg' : (as.type === 'video' ? 'video/mp4' : 'application/pdf'),
                            category: as.category || 'Asset'
                        }))
                    };
                });

                // 4. Legacy/Manual Link Recovery (Fallback)
                const legacyHistory = [
                    ...(ordersRes.data || []).map(o => {
                        const raw = typeof o.raw_data === 'string' ? JSON.parse(o.raw_data) : (o.raw_data || {});
                        return {
                            ...raw,
                            id: o.id,
                            type: 'order',
                            date: o.entry_date || raw.entryDate,
                            title: 'WORK ORDER',
                            description: raw.description || raw.notes || raw.damageDescription || raw.observations,
                            plate: raw.plate || o.plate,
                            files: []
                        };
                    }),
                    ...(valuationsRes.data || []).map(v => {
                        const raw = typeof v.raw_data === 'string' ? JSON.parse(v.raw_data) : (v.raw_data || {});
                        return {
                            ...raw,
                            id: v.id,
                            type: 'valuation',
                            date: v.created_at || raw.createdAt,
                            title: 'VALUATION REQUEST',
                            description: raw.notes || raw.description || raw.damageDescription,
                            plate: raw.vehicle?.plate || raw.plate,
                            files: []
                        };
                    })
                ].filter(h => {
                    const isPlateMatch = h.plate && vPlates.has(strip(h.plate));
                    const isClientMatch = h.clientId === client.id || h.client_id === client.id;
                    const isNameMatch = JSON.stringify(h).toLowerCase().includes(normName);

                    return isPlateMatch || isClientMatch || isNameMatch;
                });

                const finalHistory = [...activityTimeline, ...legacyHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                // 5. Map DB Files to Timeline for manual/legacy entries
                const allDbFiles = (filesRes.data || []).map(f => {
                    const { data: { publicUrl } } = supabase.storage.from(f.bucket).getPublicUrl(f.storage_path);
                    return { ...f, publicUrl };
                });

                const filesMap: Record<string, any[]> = {};
                finalHistory.forEach(item => {
                    const sPlate = strip(item.plate);
                    const itemFiles = item.files || [];

                    // Link files if expediente_id matches item ID (Manual) OR if plate matches fuzzy cluster (Automated)
                    const matchedDbFiles = allDbFiles.filter(df => df.expediente_id === item.id || (sPlate && strip(df.expediente_id) === sPlate));

                    filesMap[item.id] = [...itemFiles, ...matchedDbFiles];
                });

                setVehicles(myVehicles);
                setWorkOrders(finalHistory);
                setOrderFiles(filesMap);

                console.log(`[ACTIVITY DOSSIER] Loaded ${finalHistory.length} events.`);

            } catch (err) {
                console.error("[ACTIVITY DOSSIER] Deep Discovery Error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadActivity();
    }, [client.id, client.name]);

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'reception': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'disassembly': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'bodywork': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'paint': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'finished': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleDownload = async (url: string, filename: string, fileId: string) => {
        setDownloadingFileId(fileId);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        } finally {
            setDownloadingFileId(fileId);
            setTimeout(() => setDownloadingFileId(null), 1000);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-slide-left">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-brand-200">
                            {client.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{client.name}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{client.taxId || 'NO ID'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="p-2 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Edit Profile"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {/* Vehicle-Only View */}
                    <div className="space-y-6">
                        {vehicles.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-100">
                                <p className="text-slate-400 font-bold italic">No vehicles registered for this client.</p>
                            </div>
                        ) : (
                            vehicles.map(vh => {
                                // Match by plate first (most reliable for client-submitted requests), then by ID
                                const relatedOrders = workOrders.filter(o => {
                                    const hPlate = strip(o.plate);
                                    const vPlate = strip(vh.plate);
                                    return hPlate && vPlate && hPlate === vPlate;
                                });

                                const isExpanded = expandedVehicleId === vh.id;

                                return (
                                    <div key={vh.id} className={`bg-white rounded-3xl border transition-all ${isExpanded ? 'border-brand-300 shadow-lg ring-1 ring-brand-100' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
                                        {/* Vehicle Header */}
                                        <div
                                            className="p-6 flex items-center justify-between cursor-pointer"
                                            onClick={() => setExpandedVehicleId(isExpanded ? null : vh.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center relative flex-shrink-0 shadow-lg">
                                                    <svg className="w-8 h-8 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42.99L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" /></svg>
                                                    <div className="absolute inset-0 flex items-center justify-center font-black text-[10px] tracking-tighter uppercase whitespace-nowrap">
                                                        {vh.plate}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 uppercase leading-none mb-1 text-sm">{vh.brand} {vh.model}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">{vh.vin || 'VIN N/D'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                        <span className="text-[10px] font-bold text-brand-600 uppercase">{vh.fuel || 'Combustion'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">KM / Año</p>
                                                    <p className="font-bold text-slate-700 text-xs">{vh.currentKm?.toLocaleString() ?? 0}km • {vh.year ?? 'N/D'}</p>
                                                </div>
                                                <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Vehicle Details & Related Orders (Expanded) */}
                                        {isExpanded && (
                                            <div className="px-6 pb-6 animate-slide-down border-t border-slate-50 pt-6 space-y-6 bg-slate-50/50 rounded-b-3xl">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                        APPLICATION HISTORY
                                                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[8px] font-black">{relatedOrders.length}</span>
                                                    </p>

                                                    {relatedOrders.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">No registered applications for this vehicle.</p>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {relatedOrders.map(order => {
                                                                const files = orderFiles[order.id] || [];

                                                                // Broad Categorization to ensure visibility
                                                                const visualEvidence = files.filter(f =>
                                                                    (f.mime_type?.startsWith('image/') || f.mime_type?.startsWith('video/'))
                                                                );
                                                                const systemDocs = files.filter(f =>
                                                                    f.mime_type === 'application/pdf'
                                                                );
                                                                const otherDocs = files.filter(f =>
                                                                    !visualEvidence.find(v => v.id === f.id) &&
                                                                    !systemDocs.find(v => v.id === f.id)
                                                                );

                                                                return (
                                                                    <div key={order.id} className="bg-white rounded-[32px] overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                                                        {/* Header / Summary Mini-Dashboard */}
                                                                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                                                            <div className="flex justify-between items-start mb-4">
                                                                                <div>
                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${getStatusColor(order.status)}`}>
                                                                                            {order.status}
                                                                                        </span>
                                                                                        <span className="text-[10px] font-black text-slate-300 font-mono tracking-tighter">
                                                                                            {order.expedienteId || order.id.substring(0, 8)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <h5 className="font-black text-slate-800 text-base uppercase tracking-tight">REPAIR DETAILS</h5>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ENTRY</p>
                                                                                    <p className="font-black text-slate-700 text-sm">{new Date(order.entryDate).toLocaleDateString()}</p>
                                                                                </div>
                                                                            </div>

                                                                            {/* Technical Specs Grid */}
                                                                            <div className="grid grid-cols-3 gap-3 mb-6">
                                                                                <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm">
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">KILOMETERS</p>
                                                                                    <p className="font-black text-xs text-slate-700">{(order.currentKm || (order as any).raw_data?.vehicle?.km) || '-'} KM</p>
                                                                                </div>
                                                                                <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm">
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">PRIORITY</p>
                                                                                    <p className={`font-black text-xs uppercase ${order.priority === 'High' || order.priority === 'Urgent' ? 'text-red-600' : 'text-slate-700'}`}>
                                                                                        {order.priority?.toUpperCase() || 'NORMAL'}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm">
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">STATUS</p>
                                                                                    <p className="font-black text-[10px] text-brand-600 uppercase">{order.status || 'Active'}</p>
                                                                                </div>
                                                                            </div>

                                                                            {((order as any).description || (order as any).summary) && (
                                                                                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-inner">
                                                                                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-3 font-mono">DAMAGE DESCRIPTION:</p>
                                                                                    <p className="text-xs font-bold text-slate-600 italic leading-relaxed">
                                                                                        "{(order as any).description || (order as any).summary}"
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Categorized Docs Section - EXACTLY like ExpedienteDetail.tsx */}
                                                                        <div className="p-8 space-y-10">
                                                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] border-b pb-4">FILE DOCUMENTATION</h3>

                                                                            {/* Visual Evidence (Thumbnails) */}
                                                                            {visualEvidence.filter(f => f.mime_type?.startsWith('image/')).length > 0 && (
                                                                                <div>
                                                                                    <div className="flex items-center gap-3 mb-5">
                                                                                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                                                                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                            </svg>
                                                                                        </div>
                                                                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                                                            PHOTOGRAPHS ({visualEvidence.filter(f => f.mime_type?.startsWith('image/')).length})
                                                                                        </h4>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-4">
                                                                                        {visualEvidence.filter(f => f.mime_type?.startsWith('image/')).map(file => (
                                                                                            <div key={file.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden group">
                                                                                                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                                                                                    <img src={file.publicUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity">
                                                                                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                                                                                            <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[8px] font-black uppercase mb-1 inline-block">{file.category || 'Imagen'}</span>
                                                                                                            <p className="text-white text-[10px] font-bold truncate">{file.original_filename}</p>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="p-3">
                                                                                                    <button
                                                                                                        onClick={(e) => { e.stopPropagation(); handleDownload(file.publicUrl, file.original_filename, file.id); }}
                                                                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                                                                                                    >
                                                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Videos */}
                                                                            {visualEvidence.filter(f => f.mime_type?.startsWith('video/')).length > 0 && (
                                                                                <div>
                                                                                    <div className="flex items-center gap-3 mb-5">
                                                                                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                                                                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                            </svg>
                                                                                        </div>
                                                                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">VIDEOS ({visualEvidence.filter(f => f.mime_type?.startsWith('video/')).length})</h4>
                                                                                    </div>
                                                                                    <div className="space-y-3">
                                                                                        {visualEvidence.filter(f => f.mime_type?.startsWith('video/')).map(file => (
                                                                                            <div key={file.id} className="bg-white rounded-3xl border border-red-100 p-4 transition-all hover:shadow-md flex items-center justify-between">
                                                                                                <div className="flex items-center gap-4">
                                                                                                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                                                                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="text-xs font-black text-slate-800">{file.original_filename}</p>
                                                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{file.category || 'Video'}</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(file.publicUrl, file.original_filename, file.id); }} className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-700 transition-colors">
                                                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* System Docs */}
                                                                            {systemDocs.length > 0 && (
                                                                                <div>
                                                                                    <div className="flex items-center gap-3 mb-5">
                                                                                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                                                            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                            </svg>
                                                                                        </div>
                                                                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">DOCUMENTS ({systemDocs.length})</h4>
                                                                                    </div>
                                                                                    <div className="space-y-3">
                                                                                        {systemDocs.map(file => (
                                                                                            <div key={file.id} className="bg-white rounded-3xl border border-blue-100 p-4 transition-all hover:shadow-md flex items-center justify-between">
                                                                                                <div className="flex items-center gap-4">
                                                                                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                                                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                                                    </div>
                                                                                                    <div className="min-w-0 flex-1">
                                                                                                        <p className="text-xs font-black text-slate-800 truncate">{file.original_filename}</p>
                                                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{file.category || 'PDF Document'}</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(file.publicUrl, file.original_filename, file.id); }} className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors">
                                                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Other Files Fallback */}
                                                                            {otherDocs.length > 0 && (
                                                                                <div>
                                                                                    <div className="flex items-center gap-3 mb-5">
                                                                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                                                                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" />
                                                                                            </svg>
                                                                                        </div>
                                                                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">OTHER ASSETS ({otherDocs.length})</h4>
                                                                                    </div>
                                                                                    <div className="space-y-3">
                                                                                        {otherDocs.map(file => (
                                                                                            <div key={file.id} className="bg-white rounded-3xl border border-slate-100 p-4 transition-all hover:shadow-md flex items-center justify-between">
                                                                                                <div className="flex items-center gap-4">
                                                                                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600">
                                                                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                                                                                                    </div>
                                                                                                    <div className="min-w-0 flex-1">
                                                                                                        <p className="text-xs font-black text-slate-800 truncate">{file.original_filename}</p>
                                                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{file.category || 'File'}</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(file.publicUrl, file.original_filename, file.id); }} className="w-10 h-10 bg-slate-600 text-white rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors">
                                                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    window.open(`/#/expediente/${order.id}`, '_blank');
                                                                                }}
                                                                                className="w-full bg-slate-900 text-white py-4 rounded-3xl text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2 mt-4"
                                                                            >
                                                                                ABRIR EXPEDIENTE DETALLADO
                                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all font-mono"
                    >
                        CLOSE
                    </button>
                </div>
            </div >
        </div >
    );
};

export default ClientActivity;
