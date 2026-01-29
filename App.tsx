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
import BitrixConfig from './components/BitrixConfig';
import VehicleDetail from './components/VehicleDetail';
import LandingPage from './components/LandingPage';
import ClientAnalysisPortal from './components/ClientAnalysisPortal';
import Subscription from './components/Subscription';
import Auth from './components/Auth';
import { supabase, checkIsWorkshopAuthEmail } from './services/supabaseClient';
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
  const [showTutorials, setShowTutorials] = useState(false);
  const PageTitle: React.FC<{ role: string }> = ({ role }) => {
    const location = useLocation();
    const titles: Record<string, string> = {
      '/': 'Panel de Control',
      '/kanban': 'Taller / OTs',
      '/reception': 'Nueva Entrada',
      '/valuations': 'Solicitudes Peritación',
      '/history-ot': 'Historial Reparaciones',
      '/contacts': 'Clientes',
      '/crm': 'CRM / Ventas',
      '/claims-planner': 'Gestor de Siniestros',
      '/history-claims': 'Historial Siniestros',
      '/analytics': 'Análisis / Informes',
      '/calculator': 'Calculadora Costes',
      '/bitrix-config': 'Conexión Bitrix24',
      '/tutorials': 'Academia',
      '/client-area': 'Mi Taller',
      '/client-analysis': 'Análisis'
    };
    return <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{titles[location.pathname] || 'Panel de Control'}</h1>;
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        // Robust role enforcement on init
        if (currentSession && !activeRole) {
          const email = currentSession.user?.email;
          if (email) {
            const { checkIsWorkshopAuthEmail } = await import('./services/supabaseClient');
            const isWhitelisted = await checkIsWorkshopAuthEmail(email);
            const isMetadata = currentSession.user?.user_metadata?.user_type === 'workshop';
            const isEffectiveAdmin = isWhitelisted || isMetadata;

            handleAuthSuccess(isEffectiveAdmin ? 'Admin' : 'Client', false);
          }
        }
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

  const handleAuthSuccess = (role: AppRole, shouldRedirect: boolean = true) => {
    setActiveRole(role);
    sessionStorage.setItem('vp_active_role', role);
    if (shouldRedirect) {
      window.location.hash = '#/';
    }
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

  // PROTECTED FLOW: Landing Page -> Auth -> App
  if (!session || !activeRole) {
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

    // Show Tutorials if user clicked a trigger on landing
    if (showTutorials) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-2 font-bold text-xl text-brand-600">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-black">V+</div>
              VALORA PLUS ACADEMY
            </div>
            <button
              onClick={() => setShowTutorials(false)}
              className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black transition-all"
            >
              Volver al Inicio
            </button>
          </header>
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-7xl mx-auto">
              <Tutorials />
            </div>
          </main>
        </div>
      );
    }

    // Default: Show Landing Page
    return (
      <LandingPage
        onLoginClick={() => setShowAuth('login')}
        onSignupClick={() => setShowAuth('signup')}
        onClientLoginClick={() => setShowAuth('client_login')}
        onClientSignupClick={() => setShowAuth('client_signup')}
        onTutorialsClick={() => setShowTutorials(true)}
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

                {/* RECEPTION & APPRAISAL - Now Client Facing only */}
                <Route path="/reception" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <SmartReception />
                  </ProtectedRoleRoute>
                } />
                <Route path="/new-appraisal" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
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
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Admin_Staff', 'Client']} activeRole={activeRole as AppRole}>
                    <NewValuation />
                  </ProtectedRoleRoute>
                } />

                {/* WORKSHOP KANBAN - Now Client Facing */}
                <Route path="/kanban" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <RepairKanban />
                  </ProtectedRoleRoute>
                } />
                <Route path="/expediente/:id" element={<ExpedienteDetail />} />

                <Route path="/history-ot" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <OTHistory />
                  </ProtectedRoleRoute>
                } />
                <Route path="/analytics" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <Analytics />
                  </ProtectedRoleRoute>
                } />
                <Route path="/payment" element={
                  <ProtectedRoleRoute allowedRoles={['Client', 'Admin']} activeRole={activeRole as AppRole}>
                    <Subscription />
                  </ProtectedRoleRoute>
                } />
                <Route path="/calculator" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <CostCalculator />
                  </ProtectedRoleRoute>
                } />
                <Route path="/client-area" element={
                  <ProtectedRoleRoute allowedRoles={['Client']} activeRole={activeRole as AppRole}>
                    <ClientArea />
                  </ProtectedRoleRoute>
                } />
                <Route path="/crm" element={
                  <ProtectedRoleRoute allowedRoles={['Admin', 'Client']} activeRole={activeRole as AppRole}>
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
                    <BitrixConfig />
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