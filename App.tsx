import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CostCalculator from './components/CostCalculator';
import SmartReception from './components/NewAppraisal'; 
import Analytics from './components/Analytics';
import ChatBot from './components/ChatBot';
import ClientArea from './components/ClientArea';
import RepairKanban from './components/RepairKanban';
import ExpedienteDetail from './components/ExpedienteDetail';
import CRM from './components/CRM';
import Valuations from './components/Valuations';
import NewValuation from './components/NewValuation';
import ClaimsPlanner from './components/ClaimsPlanner';
import OTHistory from './components/OTHistory';
import ClaimsHistory from './components/ClaimsHistory';
import Tutorials from './components/Tutorials';
import Contacts from './components/Contacts';
import AnalysisReport from './components/AnalysisReport';
import BitrexConfig from './components/BitrexConfig';
import VehicleDetail from './components/VehicleDetail';
import LandingPage from './components/LandingPage';
import ClientAnalysisPortal from './components/ClientAnalysisPortal';
import Auth from './components/Auth';
import { supabase } from './services/supabaseClient';
import { AppRole } from './types';

// Role-based route guard
// Fixed: Explicitly typed ProtectedRoleRoute as React.FC with children to resolve TypeScript missing property errors in JSX usage.
const ProtectedRoleRoute: React.FC<{ children: React.ReactNode, allowedRoles: AppRole[], activeRole: AppRole }> = ({ children, allowedRoles, activeRole }) => {
  if (!activeRole || !allowedRoles.includes(activeRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [activeRole, setActiveRole] = useState<AppRole | null>(() => {
    return sessionStorage.getItem('vp_active_role') as AppRole | null;
  });
  const [showAuth, setShowAuth] = useState<'login' | 'signup' | 'client_login' | 'client_signup' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
        } catch (e) {
            console.warn("Auth initialization warning:", e);
        } finally {
            setLoading(false);
        }
    };
    
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
          setSession(null);
          setActiveRole(null);
          sessionStorage.removeItem('vp_active_role');
          localStorage.removeItem('vp_bitrix_config');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = (role: AppRole) => {
    setActiveRole(role);
    sessionStorage.setItem('vp_active_role', role);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl mb-4"></div>
          <div className="h-2 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  // PUBLIC FLOW: Landing Page -> Auth -> App
  if (!session || !activeRole) {
    // If user is authenticated but hasn't entered PIN, force PIN entry (Workshop Mode)
    if (session && !activeRole) {
        return (
            <Auth 
              initialView="pin_entry"
              onAuthSuccess={handleAuthSuccess}
              onBackToLanding={() => {
                supabase.auth.signOut();
                sessionStorage.removeItem('vp_active_role');
                setShowAuth(null);
              }}
            />
        );
    }

    // Show Auth if user clicked a trigger on landing
    if (showAuth) {
        return (
            <Auth 
                initialView={showAuth as any}
                onAuthSuccess={handleAuthSuccess}
                onBackToLanding={() => setShowAuth(null)}
            />
        );
    }

    // Default: Show Landing Page
    return (
        <LandingPage 
            onLoginClick={() => setShowAuth('login')}
            onSignupClick={() => setShowAuth('signup')}
            onClientLoginClick={() => setShowAuth('client_login')}
            onClientSignupClick={() => setShowAuth('client_signup')}
        />
    );
  }

  // PROTECTED FLOW (Authenticated + Role Assigned)
  const isClient = activeRole === 'Client';

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 font-sans">
        {/* Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          activeRole={activeRole as AppRole}
        />

        {/* Main Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* Mobile Header */}
          <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
             <div className="font-bold text-brand-500 text-xl">Valora Plus</div>
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
             </button>
          </div>

          {/* Scrollable Content Area */}
          <main className="flex-1 overflow-y-auto scroll-smooth">
            <div className="max-w-7xl mx-auto w-full">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                
                {/* RECEPTION & APPRAISAL - Admin, Staff or Client */}
                <Route path="/reception" element={
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Admin_Staff', 'Client']} activeRole={activeRole as AppRole}>
                    <SmartReception />
                  </ProtectedRoleRoute>
                } />
                <Route path="/new-appraisal" element={
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Admin_Staff', 'Client']} activeRole={activeRole as AppRole}>
                    <SmartReception />
                  </ProtectedRoleRoute>
                } />
                
                {/* CLIENT ONLY ANALYSIS TOOL */}
                <Route path="/client-analysis" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <ClientAnalysisPortal />
                  </ProtectedRoleRoute>
                } />

                <Route path="/valuations" element={
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Admin_Staff']} activeRole={activeRole as AppRole}>
                    <Valuations />
                  </ProtectedRoleRoute>
                } />
                <Route path="/new-valuation" element={
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Admin_Staff']} activeRole={activeRole as AppRole}>
                    <NewValuation />
                  </ProtectedRoleRoute>
                } />

                {/* WORKSHOP KANBAN - Admin or Operator */}
                <Route path="/kanban" element={
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Operator']} activeRole={activeRole as AppRole}>
                    <RepairKanban />
                  </ProtectedRoleRoute>
                } />
                <Route path="/expediente/:id" element={<ExpedienteDetail />} />

                {/* ADMIN ONLY TOOLS */}
                <Route path="/calculator" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <CostCalculator />
                  </ProtectedRoleRoute>
                } />
                <Route path="/history-ot" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <OTHistory />
                  </ProtectedRoleRoute>
                } />
                <Route path="/analytics" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <Analytics />
                  </ProtectedRoleRoute>
                } />
                <Route path="/client-area" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <ClientArea />
                  </ProtectedRoleRoute>
                } />
                <Route path="/crm" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <CRM />
                  </ProtectedRoleRoute>
                } />
                <Route path="/contacts" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <Contacts />
                  </ProtectedRoleRoute>
                } />
                <Route path="/claims-planner" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <ClaimsPlanner />
                  </ProtectedRoleRoute>
                } />
                <Route path="/history-claims" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <ClaimsHistory />
                  </ProtectedRoleRoute>
                } />
                <Route path="/bitrix-config" element={
                  <ProtectedRoleRoute allowedRoles={['Admin']} activeRole={activeRole as AppRole}>
                    <BitrexConfig />
                  </ProtectedRoleRoute>
                } />
                
                {/* SHARED / PUBLIC WITHIN SESSION */}
                <Route path="/analytics/report/:id" element={<AnalysisReport />} />
                <Route path="/vehicle/:id" element={<VehicleDetail />} />
                <Route path="/tutorials" element={<Tutorials />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>

        {!isClient && <ChatBot />}
      </div>
    </Router>
  );
};

export default App;