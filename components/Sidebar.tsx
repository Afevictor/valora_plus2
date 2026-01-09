
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase, getCompanyProfileFromSupabase, getClientsFromSupabase } from '../services/supabaseClient';
import { AppRole } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  activeRole: AppRole;
}

const NavItem = ({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors mb-1 ${
      active 
        ? 'bg-brand-500 text-white shadow-md' 
        : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'
    }`}
  >
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </Link>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-4 mt-6 mb-2">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
  </div>
);

// SVG Icons
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>;
const EntryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/></svg>;
const KanbanIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>;
const CalculatorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>;
const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const CrmIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const ContactIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const ValuationsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>;
const ShieldIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const HistoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>;
const ArchiveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>;
const AcademyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M12 11h8"/><path d="M12 7h8"/></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;

const NotificationCenter = React.lazy(() => import('./NotificationCenter'));

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, activeRole }) => {
  const location = useLocation();
  const [displayName, setDisplayName] = useState('Valora Plus User');

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
                setDisplayName(profile.companyName);
            }
        }
    };
    fetchName();
  }, [activeRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = activeRole === 'Admin';
  const isOperator = activeRole === 'Operator';
  const isAdminStaff = activeRole === 'Admin_Staff';
  const isClient = activeRole === 'Client';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo Area */}
          <Link to="/" className="h-16 flex items-center px-6 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="flex items-center gap-2 font-bold text-xl text-brand-600">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-black group-hover:bg-brand-700 transition-colors">
                V+
              </div>
              VALORA PLUS
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 overflow-y-auto">
            {isClient ? (
                <>
                    <SectionHeader label="Client Portal" />
                    <NavItem to="/" icon={<DashboardIcon />} label="My Repairs" active={location.pathname === '/'} />
                    <NavItem to="/reception" icon={<EntryIcon />} label="New Repair Request" active={location.pathname === '/reception'} />
                    <NavItem to="/client-analysis" icon={<ChartIcon />} label="AI Analysis Tool" active={location.pathname === '/client-analysis'} />
                </>
            ) : (
                <>
                    <NavItem to="/" icon={<DashboardIcon />} label="Dashboard" active={location.pathname === '/'} />
                    
                    {(isAdmin || isOperator) && (
                    <>
                        <SectionHeader label="Workshop Management" />
                        <NavItem to="/kanban" icon={<KanbanIcon />} label="Workshop / WOs" active={location.pathname === '/kanban'} />
                    </>
                    )}

                    {(isAdmin || isAdminStaff) && (
                    <>
                        <SectionHeader label="Reception & Appraisal" />
                        <NavItem to="/reception" icon={<EntryIcon />} label="New Entry / Reception" active={location.pathname === '/reception'} />
                        <NavItem to="/valuations" icon={<ValuationsIcon />} label="Appraisal Requests" active={location.pathname === '/valuations'} />
                    </>
                    )}

                    {isAdmin && (
                    <>
                        <SectionHeader label="Advanced DMS" />
                        <NavItem to="/history-ot" icon={<HistoryIcon />} label="Repair History" active={location.pathname === '/history-ot'} />
                        <SectionHeader label="Sales & Clients" />
                        <NavItem to="/contacts" icon={<ContactIcon />} label="Clients" active={location.pathname === '/contacts'} />
                        <NavItem to="/crm" icon={<CrmIcon />} label="CRM / Sales" active={location.pathname === '/crm'} />
                        <SectionHeader label="Analysis Tools" />
                        <NavItem to="/claims-planner" icon={<ShieldIcon />} label="Claims Planner" active={location.pathname === '/claims-planner'} />
                        <NavItem to="/history-claims" icon={<ArchiveIcon />} label="Claims History" active={location.pathname === '/history-claims'} />
                        <NavItem to="/analytics" icon={<ChartIcon />} label="Analytics / Reports" active={location.pathname === '/analytics'} />
                        <NavItem to="/calculator" icon={<CalculatorIcon />} label="Cost Calculator" active={location.pathname === '/calculator'} />
                        <SectionHeader label="Integrations" />
                        <NavItem to="/bitrix-config" icon={<LinkIcon />} label="Bitrix24 Connect" active={location.pathname === '/bitrix-config'} />
                    </>
                    )}

                    <SectionHeader label="Help & Support" />
                    <NavItem to="/tutorials" icon={<AcademyIcon />} label="Training / Tutorials" active={location.pathname === '/tutorials'} />
                    {isAdmin && <NavItem to="/client-area" icon={<UserIcon />} label="My Workshop" active={location.pathname === '/client-area'} />}
                </>
            )}
          </nav>

          {/* Footer User Profile & Notifications */}
          <div className="border-t border-slate-100 bg-slate-50">
            {/* Active Role Indicator */}
            <div className="p-4 bg-white/50 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">
                Session Role: <span className={isClient ? 'text-emerald-600' : 'text-brand-600'}>{activeRole}</span>
            </div>
            {!isClient && (
                <React.Suspense fallback={<div className="h-12"></div>}>
                    <NotificationCenter />
                </React.Suspense>
            )}
            <div className="p-4 pt-0">
                <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isClient ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'} border border-opacity-20 flex items-center justify-center font-bold`}>
                    {activeRole.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{displayName}</p>
                    <button 
                      onClick={handleLogout}
                      className="text-xs text-red-500 font-bold hover:underline"
                    >
                      Logout
                    </button>
                </div>
                </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
