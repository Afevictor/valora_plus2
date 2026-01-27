
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase, getCompanyProfileFromSupabase, getClientsFromSupabase } from '../services/supabaseClient';
import { AppRole } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  activeRole: AppRole;
}

const NavItem = ({ to, icon, label, active, isClient }: { to: string, icon: React.ReactNode, label: string, active: boolean, isClient: boolean }) => {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1.5 relative overflow-hidden ${active
        ? isClient ? 'bg-emerald-600/10 text-emerald-400' : 'bg-slate-600/10 text-slate-400'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
        }`}
    >
      {active && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${isClient ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-slate-500 shadow-[0_0_12px_rgba(148,163,184,0.8)]'}`} />
      )}

      <div className={`transition-transform duration-300 group-hover:scale-110 ${active ? 'text-inherit' : 'text-slate-500 group-hover:text-slate-300'}`}>
        {icon}
      </div>

      <span className={`font-semibold text-sm tracking-tight transition-all duration-300 ${active ? 'translate-x-1' : 'group-hover:translate-x-0.5'}`}>
        {label}
      </span>

      {active && (
        <div className={`absolute right-2 w-1.5 h-1.5 rounded-full ${isClient ? 'bg-emerald-500' : 'bg-slate-500'} animate-pulse`} />
      )}
    </Link>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-4 mt-8 mb-3">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
  </div>
);

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="w-5 h-5 flex items-center justify-center">
    {children}
  </div>
);

const DashboardIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg></IconWrapper>;
const ValuationsIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg></IconWrapper>;
const ContactIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></IconWrapper>;
const CrmIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></IconWrapper>;
const ShieldIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></IconWrapper>;
const ArchiveIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg></IconWrapper>;
const LinkIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></IconWrapper>;
const HistoryIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></IconWrapper>;
const EntryIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg></IconWrapper>;
const KanbanIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /></svg></IconWrapper>;
const CalculatorIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></svg></IconWrapper>;
const ChartIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg></IconWrapper>;
const UserIcon = () => <IconWrapper><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></IconWrapper>;

const NotificationCenter = React.lazy(() => import('./NotificationCenter'));

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, activeRole }) => {
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const fetchName = async () => {
      if (activeRole === 'Client') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const clients = await getClientsFromSupabase();
          const current = clients.find(c => c.id === user.id);
          if (current) setDisplayName(current.name);
        }
      } else {
        const profile = await getCompanyProfileFromSupabase();
        if (profile?.companyName) {
          setDisplayName(profile.companyName || 'Taller Valora');
        }
      }
    };
    fetchName();
  }, [activeRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isClient = activeRole === 'Client';
  const sidebarTheme = isClient ? 'bg-[#062016]' : 'bg-[#0f172a]';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 ${sidebarTheme} border-r border-white/5 transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        <div className="h-full flex flex-col relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="h-24 flex items-center px-8 shrink-0 relative">
            <Link to="/" className="flex items-center gap-3">
              <div className={`w-10 h-10 ${isClient ? 'bg-emerald-600 shadow-emerald-500/40' : 'bg-brand-600 shadow-brand-500/40'} rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg ring-2 ring-white/10`}>
                V+
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg text-white tracking-tight leading-none uppercase">Valora Plus</span>
                <span className={`text-[10px] font-bold ${isClient ? 'text-emerald-500' : 'text-brand-500'} tracking-widest uppercase mt-0.5`}>DMS Intelligence</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar relative">
            {isClient ? (
              <>
                <SectionHeader label="Portal del Cliente" />
                <NavItem to="/" icon={<DashboardIcon />} label="Mis Reparaciones" active={location.pathname === '/'} isClient={true} />
                <NavItem to="/kanban" icon={<KanbanIcon />} label="Tablero de Progreso" active={location.pathname === '/kanban'} isClient={true} />
                <NavItem to="/history-ot" icon={<HistoryIcon />} label="Historial Reparaciones" active={location.pathname === '/history-ot'} isClient={true} />
                <NavItem to="/reception" icon={<EntryIcon />} label="Nueva Solicitud" active={location.pathname === '/reception'} isClient={true} />
                <NavItem to="/new-valuation" icon={<ValuationsIcon />} label="Nueva Peritación" active={location.pathname === '/new-valuation'} isClient={true} />
                <NavItem to="/analytics" icon={<ChartIcon />} label="Análisis / Informes" active={location.pathname === '/analytics'} isClient={true} />
                <NavItem to="/calculator" icon={<CalculatorIcon />} label="Calculadora de Costes" active={location.pathname === '/calculator'} isClient={true} />
                <NavItem to="/client-area" icon={<UserIcon />} label="Mi Taller (Perfil)" active={location.pathname === '/client-area'} isClient={true} />
              </>
            ) : (
              <>
                <SectionHeader label="Principal" />
                <NavItem to="/" icon={<DashboardIcon />} label="Panel de Control" active={location.pathname === '/'} isClient={false} />

                <SectionHeader label="Peritación & Siniestros" />
                <NavItem to="/valuations" icon={<ValuationsIcon />} label="Solicitudes Peritación" active={location.pathname === '/valuations'} isClient={false} />
                <NavItem to="/claims-planner" icon={<ShieldIcon />} label="Planificador de Siniestros" active={location.pathname === '/claims-planner'} isClient={false} />
                <NavItem to="/history-claims" icon={<ArchiveIcon />} label="Historial Siniestros" active={location.pathname === '/history-claims'} isClient={false} />

                <SectionHeader label="Ventas & Operaciones" />
                <NavItem to="/contacts" icon={<ContactIcon />} label="Clientes" active={location.pathname === '/contacts'} isClient={false} />
                <NavItem to="/crm" icon={<CrmIcon />} label="CRM / Estrategia" active={location.pathname === '/crm'} isClient={false} />

                <SectionHeader label="Sistema" />
                <NavItem to="/bitrix-config" icon={<LinkIcon />} label="Bitrix24 Link" active={location.pathname === '/bitrix-config'} isClient={false} />
              </>
            )}

            {!isClient && (
              <div className="mt-12 p-5 rounded-2xl bg-gradient-to-br from-brand-600/20 to-indigo-600/20 border border-white/5 relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Valora AI</p>
                  <p className="text-xs font-bold text-slate-200 mb-3 leading-snug">Optimiza tu rentabilidad con el nuevo análisis inteligente.</p>
                  <Link to="/crm" className="text-[10px] font-black text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-500 transition-colors uppercase inline-block font-sans">Probar Ahora</Link>
                </div>
                <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-brand-500/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              </div>
            )}
          </nav>

          <footer className="p-4 shrink-0 mt-auto bg-slate-900/50 backdrop-blur-md border-t border-white/5">
            <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/5 transition-colors group relative">
              {!isClient && (
                <div className="absolute -top-12 right-4">
                  <React.Suspense fallback={<div className="h-10 w-10" />}>
                    <NotificationCenter />
                  </React.Suspense>
                </div>
              )}
              <div className={`w-11 h-11 rounded-2xl ${isClient ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-brand-600 shadow-brand-500/20'} text-white shadow-lg flex items-center justify-center font-black relative overflow-hidden group-hover:rotate-3 transition-transform duration-300 ring-2 ring-white/10`}>
                <span className="relative z-10">{activeRole ? activeRole.charAt(0) : 'U'}</span>
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate leading-tight tracking-tight">{displayName}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isClient ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-500/20 text-brand-400'}`}>
                    {activeRole || 'User'}
                  </span>
                  <button onClick={handleLogout} className="text-[10px] text-red-400/60 font-black hover:text-red-400 transition-colors uppercase tracking-tight font-sans">
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}} />
    </>
  );
};

export default Sidebar;
