
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RepairJob, AppRole, Client } from '../types';
import { getWorkOrdersFromSupabase, getCompanyProfileFromSupabase, getClientsFromSupabase, getValuationsFromSupabase, getQuotes, getOpportunities, supabase } from '../services/supabaseClient';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<AppRole>('Admin');
  const [stats, setStats] = useState({
    customers: 0,
    workOrders: 0,
    analysisMonth: 0,
    appraisals: 0,
    // Client specific stats
    reception: 0,
    inProgress: 0,
    finished: 0,
    pendingQuotes: 0,
    pendingOpps: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const role = (sessionStorage.getItem('vp_active_role') as AppRole) || 'Admin';
      setActiveRole(role);

      const { data: { user } } = await supabase.auth.getUser();

      const [orderData, profile, allClients, valuationData, quoteData, opportunityData] = await Promise.all([
        getWorkOrdersFromSupabase(),
        getCompanyProfileFromSupabase(),
        getClientsFromSupabase(),
        getValuationsFromSupabase(),
        getQuotes(),
        getOpportunities()
      ]);

      // Current Month Analysis Fetch
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);

      const { count: analysisCount } = await supabase
        .from('analysis_requests')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', firstDay.toISOString());

      let filteredOrders = orderData;
      let filteredValuations = valuationData;

      if (role === 'Client' && user) {
        const clientProfile = allClients.find((c: Client) => c.id === user.id);
        if (clientProfile) setDisplayName(clientProfile.name);
        filteredOrders = orderData.filter((o: RepairJob) => o.clientId === user.id);
      } else {
        const raw = profile?.companyName || 'Valora Plus';
        const isBad = raw.toLowerCase().includes('mecanico') || raw.toLowerCase().includes('mecánico') || raw.includes('45');
        setDisplayName(isBad ? 'Valora Plus' : raw);
      }

      const sorted = filteredOrders.sort((a: RepairJob, b: RepairJob) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      setJobs(sorted);

      // Calculate Client Stats
      const reception = sorted.filter((j: RepairJob) => j.status === 'reception').length;
      const finished = sorted.filter((j: RepairJob) => ['finished', 'closed', 'invoiced', 'admin_close'].includes(j.status.toLowerCase())).length;
      const inProgress = sorted.length - reception - finished;

      setStats({
        customers: role === 'Client' ? 1 : allClients.length,
        workOrders: filteredOrders.length,
        analysisMonth: analysisCount || 0,
        appraisals: filteredValuations.length,
        reception,
        inProgress,
        finished,
        pendingQuotes: quoteData.filter((q: any) => q.status === 'Sent' || q.status === 'Draft').length,
        pendingOpps: opportunityData.filter((o: any) => o.status === 'Pending').length
      });

      setIsLoading(false);
    };
    fetchData();
  }, []);

  const filteredData = jobs.filter(item => {
    const search = searchTerm.toLowerCase();
    return (
      (item.expedienteId && item.expedienteId.toLowerCase().includes(search)) ||
      (item.vehicle && item.vehicle.toLowerCase().includes(search)) ||
      (item.plate && item.plate.toLowerCase().includes(search)) ||
      item.status.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'reception' || s === 'open') return 'bg-blue-100 text-blue-800';
    if (s === 'finished' || s === 'ready') return 'bg-green-100 text-green-800';
    if (s === 'disassembly' || s === 'bodywork' || s === 'paint') return 'bg-orange-100 text-orange-800';
    return 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      reception: 'Recepción',
      disassembly: 'Desmontaje',
      bodywork: 'Chapa/Mec',
      paint: 'Pintura',
      admin_close: 'Cierre Adm.',
      finished: 'Listo'
    };
    return map[status] || status;
  };

  const isClient = activeRole === 'Client';
  const canSeeReception = isClient; // Only show 'New Request' to clients on the dashboard
  const canSeeValuations = isClient || activeRole === 'Admin'; // Visible for both now
  const canSeeKanban = !isClient;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">
            {isClient ? `Hola, ${displayName}` : 'Panel de Gestión'}
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">
            {isClient ? 'Siga sus reparaciones activas e historial de mantenimiento.' : 'Bienvenido al centro de gestión profesional'}
          </p>
        </div>
        {isClient && (
          <div className="flex gap-3 overflow-x-auto pb-2 w-full lg:w-auto scrollbar-hide">
            {[
              { label: 'Solicitadas', value: stats.reception, color: 'text-blue-600' },
              { label: 'En Taller', value: stats.inProgress, color: 'text-orange-600' },
              { label: 'Entregas', value: stats.finished, color: 'text-emerald-600' },
              { label: 'Ptos. Pendientes', value: stats.pendingQuotes, color: 'text-brand-600' },
              { label: 'Oportunidades', value: stats.pendingOpps, color: 'text-purple-600' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm text-center min-w-[120px] flex-1">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-10">
        {canSeeReception && (
          <Link to="/reception" className="bg-[#059669] hover:bg-[#047857] transition-colors text-white rounded-2xl p-6 md:p-8 shadow-lg flex items-center justify-between group">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-1">Solicitar Nueva Reparación</h2>
              <p className="text-xs md:text-sm text-emerald-100 opacity-90">Suba fotos de los daños de su vehículo.</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 ml-4">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </div>
          </Link>
        )}

        {isClient && (
          <Link to="/new-valuation" className="bg-[#515ada] hover:bg-[#434bb8] transition-colors text-white rounded-2xl p-6 md:p-8 shadow-lg flex items-center justify-between group">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-1">Nueva Peritación</h2>
              <p className="text-xs md:text-sm text-indigo-100 opacity-90">Solicite peritación independiente e informes.</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 ml-4">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
            </div>
          </Link>
        )}
      </div>

      {/* MAIN DASHBOARD CONTENT */}
      {!isClient ? (
        <div className="max-w-4xl mx-auto space-y-8">

          {/* OPERATIONAL EFFICIENCY CARD */}
          <div className="bg-slate-900 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] group-hover:bg-brand-500/20 transition-all duration-700" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8 md:mb-10">
                <div className="w-1.5 h-6 md:h-8 bg-brand-500 rounded-full" />
                <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-brand-400">Eficiencia Operativa</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {[
                  { label: 'Nº Clientes', value: stats.customers, color: 'text-white', bg: 'bg-brand-500/20', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
                  { label: 'Órdenes Creadas', value: stats.workOrders, color: 'text-white', bg: 'bg-indigo-500/20', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
                  { label: 'Análisis Realizados', value: stats.analysisMonth, color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
                  { label: 'Informes Periciales', value: stats.appraisals, color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /> }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className={`text-2xl md:text-3xl font-black ${item.color}`}>{item.value}</p>
                    </div>
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl ${item.bg} flex items-center justify-center`}>
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SYSTEM STATUS FOOTER */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
            <div className="flex items-center gap-3 p-4 px-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="relative">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute inset-0" />
                <div className="w-3 h-3 bg-emerald-500 rounded-full relative" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-600">Sistemas 100% Operativos</span>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              <span>Última Sincronización:</span>
              <span className="text-slate-600">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">Mi Historial de Reparaciones</h3>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">{filteredData.length}</span>
            </div>

            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                placeholder="Buscar reparaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm text-left min-w-[600px]">
              <thead className="text-[10px] md:text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 md:px-6 py-4">ID</th>
                  <th className="px-4 md:px-6 py-4">VEHÍCULO</th>
                  <th className="px-4 md:px-6 py-4">FECHA SOLICITUD</th>
                  <th className="px-4 md:px-6 py-4">ESTADO</th>
                  <th className="px-4 md:px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!isLoading && filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/expediente/${item.id}`)}
                    >
                      <td className="px-6 py-4 font-bold text-slate-700 font-mono">{item.expedienteId || item.id.substring(0, 8)}</td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                          {item.vehicle ? item.vehicle.substring(0, 1) : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{item.vehicle}</p>
                          <p className="text-xs text-slate-500">{item.plate}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`${getStatusColor(item.status)} px-4 py-1.5 rounded-full text-xs font-bold border border-opacity-20 border-current inline-flex items-center`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-blue-600 font-bold hover:underline">Ver detalles</span>
                      </td>
                    </tr>
                  ))
                ) : !isLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                        <p>Aún no tiene solicitudes de reparación.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
