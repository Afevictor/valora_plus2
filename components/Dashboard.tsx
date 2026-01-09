
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RepairJob, AppRole, Client } from '../types';
import { getWorkOrdersFromSupabase, getCompanyProfileFromSupabase, getClientsFromSupabase, supabase } from '../services/supabaseClient';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [displayName, setDisplayName] = useState('User');
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<AppRole>('Admin');
  const [stats, setStats] = useState({
    reception: 0,
    inProgress: 0,
    finished: 0,
    totalValuation: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const role = (sessionStorage.getItem('vp_active_role') as AppRole) || 'Admin';
      setActiveRole(role);

      const { data: { user } } = await supabase.auth.getUser();
      
      const [orderData, profile, allClients] = await Promise.all([
          getWorkOrdersFromSupabase(),
          getCompanyProfileFromSupabase(),
          getClientsFromSupabase()
      ]);
      
      let filteredOrders = orderData;

      if (role === 'Client' && user) {
          const clientProfile = allClients.find(c => c.id === user.id);
          if (clientProfile) setDisplayName(clientProfile.name);
          filteredOrders = orderData.filter(o => o.clientId === user.id);
      } else if (profile?.companyName) {
          setDisplayName(profile.companyName);
      }

      // Sort by newest
      const sorted = filteredOrders.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      setJobs(sorted);

      // Calculate Stats
      const reception = sorted.filter(j => j.status === 'reception').length;
      const finished = sorted.filter(j => ['finished', 'closed', 'invoiced'].includes(j.status.toLowerCase())).length;
      const inProgress = sorted.length - reception - finished;
      
      const totalVal = sorted.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

      setStats({ reception, inProgress, finished, totalValuation: totalVal });
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
        reception: 'Reception',
        disassembly: 'Disassembly',
        bodywork: 'Body/Mech',
        paint: 'Paint',
        admin_close: 'Admin Close',
        finished: 'Ready'
    };
    return map[status] || status;
  };

  const isClient = activeRole === 'Client';
  const canSeeReception = activeRole === 'Admin' || activeRole === 'Admin_Staff' || isClient;
  const canSeeValuations = activeRole === 'Admin' || activeRole === 'Admin_Staff';
  const canSeeKanban = activeRole === 'Admin' || activeRole === 'Operator';

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hello, {displayName}</h1>
            <p className="text-slate-500 font-medium">
                {isClient ? 'Track your active repairs and maintenance history.' : 'Welcome to your Valora Plus control center.'}
            </p>
        </div>
        <div className="flex gap-4">
             <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold">{isClient ? 'Requested' : 'Reception'}</p>
                 <p className="text-xl font-bold text-blue-600">{stats.reception}</p>
             </div>
             <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold">In Workshop</p>
                 <p className="text-xl font-bold text-orange-600">{stats.inProgress}</p>
             </div>
             <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-center">
                 <p className="text-xs text-slate-500 uppercase font-bold">{isClient ? 'Delivered' : 'Finished'}</p>
                 <p className="text-xl font-bold text-green-600">{stats.finished}</p>
             </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {canSeeReception && (
            <Link to="/reception" className={`${isClient ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-200'} transition-colors text-white rounded-xl p-6 shadow-lg flex items-center justify-between group`}>
               <div>
                   <h2 className="text-xl font-bold mb-1">{isClient ? 'Request New Repair' : 'New Workshop Entry'}</h2>
                   <p className={`${isClient ? 'text-emerald-100' : 'text-brand-100'} text-sm`}>
                       {isClient ? 'Upload photos of your vehicle faults.' : 'Register vehicle, photos and repair order.'}
                   </p>
               </div>
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                   <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
               </div>
            </Link>
          )}

          {canSeeValuations && (
            <Link to="/new-valuation" className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-xl p-6 shadow-lg shadow-indigo-200 flex items-center justify-between group">
               <div>
                   <h2 className="text-xl font-bold mb-1">New Appraisal</h2>
                   <p className="text-indigo-100 text-sm">Request independent appraisal, reports and valuation.</p>
               </div>
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                   <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
               </div>
            </Link>
          )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">{isClient ? 'My Repairs History' : 'Recent Files (Live DB)'}</h3>
              <span className={`${isClient ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'} px-2 py-0.5 rounded-full text-xs font-bold`}>{filteredData.length}</span>
          </div>
          
          <div className="relative w-full sm:w-96">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
             </div>
             <input 
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm"
                placeholder="Search repairs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Date Requested</th>
                <th className="px-6 py-3">Status</th>
                {!isClient && <th className="px-6 py-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!isLoading && filteredData.length > 0 ? (
                filteredData.slice(0, 10).map((item) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50 transition-colors ${isClient ? '' : 'cursor-pointer'}`} 
                    onClick={() => !isClient && navigate(`/expediente/${item.id}`)}
                  >
                    <td className="px-6 py-4 font-bold text-slate-700 font-mono">{item.expedienteId || item.id.substring(0,8)}</td>
                    <td className="px-6 py-4 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded ${isClient ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'} flex items-center justify-center font-bold text-xs`}>
                             {item.vehicle ? item.vehicle.substring(0,1) : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{item.vehicle}</p>
                          <p className="text-xs text-slate-500">{item.plate}</p>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`${getStatusColor(item.status)} px-2 py-1 rounded-full text-xs font-medium border border-opacity-20 border-current`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    {!isClient && <td className="px-6 py-4 text-brand-600 font-medium hover:underline">View details</td>}
                  </tr>
                ))
              ) : !isLoading && (
                <tr>
                  <td colSpan={isClient ? 4 : 5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                        <p>{isClient ? 'You have no repair requests yet.' : 'No work orders found.'}</p>
                      </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
