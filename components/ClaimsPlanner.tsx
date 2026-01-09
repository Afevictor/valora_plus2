
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ValuationRequest, ClaimsStage, Employee } from '../types';
import { getValuationsFromSupabase, updateValuationStage, deleteValuation } from '../services/supabaseClient';
import { getBitrixUsers, BitrixUser } from '../services/bitrixService';

// Distinct Lifecycle for Claims (Administrative/Expert)
const COLUMNS: { id: ClaimsStage; title: string; color: string }[] = [
  { id: 'draft', title: 'Draft / Pending', color: 'border-slate-300' },
  { id: 'sent_expert', title: 'Sent to Expert', color: 'border-blue-400' },
  { id: 'in_review', title: 'In Review (Chat)', color: 'border-purple-400' },
  { id: 'report_issued', title: 'Report Issued', color: 'border-green-400' },
  { id: 'negotiation', title: 'Workshop Review', color: 'border-orange-400' },
  { id: 'analytics', title: 'Closed / Analytics', color: 'border-gray-400' },
];

const ClaimsPlanner: React.FC = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ValuationRequest[]>([]);
  const [bitrixUsers, setBitrixUsers] = useState<BitrixUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [draggedClaimId, setDraggedClaimId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        const data = await getValuationsFromSupabase();
        
        // Fetch Bitrix Users to resolve names
        const bUsers = await getBitrixUsers();
        setBitrixUsers(bUsers);

        if (data && data.length > 0) {
            setClaims(data);
        } else {
             setClaims([]);
        }
        setIsLoading(false);
    };

    fetchData();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedClaimId(id);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStage: ClaimsStage) => {
      e.preventDefault();
      if (!draggedClaimId) return;

      // Optimistic Update
      setClaims(prev => prev.map(c => 
          c.id === draggedClaimId ? { ...c, claimsStage: targetStage } : c
      ));

      // DB Update
      await updateValuationStage(draggedClaimId, targetStage);

      setDraggedClaimId(null);
  };

  const handleDeleteClaim = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("Are you sure you want to delete this appraisal request?")) {
          await deleteValuation(id);
          setClaims(prev => prev.filter(c => c.id !== id));
      }
  };

  const getCount = (stage: ClaimsStage) => claims.filter(c => (c.claimsStage || 'draft') === stage).length;

  const filteredClaims = claims.filter(c => {
      const search = searchTerm.toLowerCase();
      const matchId = c.ticketNumber ? c.ticketNumber.toLowerCase().includes(search) : c.id.toLowerCase().includes(search);
      const matchPlate = c.vehicle?.plate ? c.vehicle.plate.toLowerCase().includes(search) : false;
      const matchIns = c.insuranceCompany ? c.insuranceCompany.toLowerCase().includes(search) : false;
      const matchWo = c.workOrderId ? c.workOrderId.toLowerCase().includes(search) : false;
      const matchClient = c.insuredName ? c.insuredName.toLowerCase().includes(search) : false;

      return matchId || matchPlate || matchIns || matchWo || matchClient;
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 overflow-hidden bg-slate-50 relative">
      
      {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
             <div className="flex flex-col items-center">
                 <svg className="animate-spin h-8 w-8 text-brand-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 <p className="text-sm text-slate-500 font-medium">Loading Planner...</p>
             </div>
          </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                 <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 Appraisal Planner
              </h1>
              <p className="text-slate-500 text-sm">Lifecycle management for independent appraisals.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input 
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-brand-500 focus:border-brand-500 text-sm"
                        placeholder="Search Claim, Plate..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
          </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex h-full gap-4">
              {COLUMNS.map(col => (
                  <div 
                    key={col.id} 
                    className="w-80 flex-shrink-0 flex flex-col bg-slate-100 rounded-xl border border-slate-200"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                      {/* Column Header */}
                      <div className={`p-3 border-t-4 ${col.color} bg-white rounded-t-xl shadow-sm flex justify-between items-center`}>
                          <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">{col.title}</h3>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                              {getCount(col.id)}
                          </span>
                      </div>

                      {/* Cards */}
                      <div className="flex-1 p-2 overflow-y-auto space-y-3 scrollbar-thin">
                          {filteredClaims
                            .filter(c => (c.claimsStage || 'draft') === col.id)
                            .map(claim => {
                                // Resolve Bitrix User Name
                                const assignedExpert = bitrixUsers.find(u => u.ID === claim.assignedExpertId);
                                
                                return (
                                <div 
                                    key={claim.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, claim.id)}
                                    // UPDATED: Pass state for auto-selection in Valuations component
                                    onClick={() => navigate('/valuations', { state: { selectedId: claim.id } })}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative border-l-4 border-l-transparent hover:border-l-brand-500"
                                >
                                    {/* Delete Button */}
                                    <button 
                                        onClick={(e) => handleDeleteClaim(e, claim.id)}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 z-10 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>

                                    <div className="flex justify-between items-start mb-2 pr-6">
                                        <span className="text-xs font-bold text-slate-400">{claim.ticketNumber || claim.id.substring(0, 8)}</span>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                            {claim.workOrderId || 'N/A'}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-slate-800 text-sm">{claim.vehicle?.brand} {claim.vehicle?.model}</h4>
                                    <p className="text-xs text-slate-500 font-mono mb-2">{claim.vehicle?.plate}</p>

                                    {/* CLIENT & EXPERT ROW - UPDATED DISPLAY */}
                                    <div className="flex flex-col gap-2 mb-2 bg-slate-50 p-2 rounded border border-slate-100">
                                        {/* Client */}
                                        <div className="flex items-center gap-2 text-xs text-slate-700">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 uppercase leading-none">Client</span>
                                                <span className="truncate font-medium">{claim.insuredName || 'Unknown Client'}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Expert (Bitrix) */}
                                        <div className="flex items-center gap-2 text-xs text-indigo-700 border-t border-slate-200 pt-2">
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-indigo-300 uppercase leading-none">Bitrix Expert</span>
                                                <span className="truncate font-bold">
                                                    {assignedExpert 
                                                        ? `${assignedExpert.NAME} ${assignedExpert.LAST_NAME}` 
                                                        : 'Unassigned'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                        <div className="text-xs text-slate-500 truncate max-w-[120px]">
                                            {claim.insuranceCompany}
                                        </div>
                                        {col.id === 'in_review' && (
                                            <span className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div> Active Chat
                                            </span>
                                        )}
                                        {col.id === 'report_issued' && (
                                            <span className="text-[10px] text-green-600 font-bold border border-green-200 bg-green-50 px-1 rounded">
                                                PDF
                                            </span>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                          }
                          {getCount(col.id) === 0 && (
                            <div className="h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                                <p className="text-xs text-slate-400 opacity-50">Empty</p>
                            </div>
                        )}
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default ClaimsPlanner;
