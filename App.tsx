import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CostCalculator from './components/CostCalculator';
import SmartReception from './components/NewAppraisal';

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
import OperatorTimeTracking from './components/OperatorTimeTracking';
import LandingPage from './components/LandingPage';
import ClientAnalysisPortal from './components/ClientAnalysisPortal';
import Subscription from './components/Subscription';
import Auth from './components/Auth';
import AdminValuationsQueue from './components/AdminValuationsQueue';
import AppraisersManagement from './components/AppraisersManagement';
import PurchaseImporter from './components/PurchaseImporter';
import AttendanceTracker from './components/AttendanceTracker';
import { supabase, checkIsWorkshopAuthEmail } from './services/supabaseClient';
import { AppRole } from './types';

// Role-based route guard
const ProtectedRoleRoute: React.FC<{ children: React.ReactNode, allowedRoles: AppRole[], activeRole: AppRole | null, session: any }> = ({ children, allowedRoles, activeRole, session }) => {
  if (!session) {
    return <Navigate to="/" replace />;
  }
  if (!activeRole || !allowedRoles.includes(activeRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const MainLayout: React.FC<{ children: React.ReactNode, activeRole: AppRole, isSidebarOpen: boolean, setIsSidebarOpen: (o: boolean) => void }> = ({ children, activeRole, isSidebarOpen, setIsSidebarOpen }) => {
  const isClient = activeRole === 'Client';

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activeRole={activeRole}
      />

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

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {!isClient && <ChatBot />}
    </div>
  );
};

const AppRoutes = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [activeRole, setActiveRole] = useState<AppRole | null>(() => {
    return sessionStorage.getItem('vp_active_role') as AppRole | null;
  });
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (currentSession && !activeRole) {
          const email = currentSession.user?.email;
          if (email) {
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
  }, [activeRole]);

  const handleAuthSuccess = (role: AppRole, shouldRedirect: boolean = true) => {
    setActiveRole(role);
    sessionStorage.setItem('vp_active_role', role);
    if (shouldRedirect) {
      navigate('/');
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

  // Define Dashboard view logic
  const renderDashboard = () => {
    if (!session) return <LandingPage />;
    if (!activeRole) return <div className="p-20 text-center">Configurando acceso...</div>;
    return (
      <MainLayout activeRole={activeRole} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}>
        <Dashboard />
      </MainLayout>
    );
  };

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={renderDashboard()} />
      <Route path="/admin/login" element={session ? <Navigate to="/" /> : <Auth initialView="login" onAuthSuccess={handleAuthSuccess} onBackToLanding={() => navigate('/')} />} />
      <Route path="/admin/register" element={session ? <Navigate to="/" /> : <Auth initialView="signup" onAuthSuccess={handleAuthSuccess} onBackToLanding={() => navigate('/')} />} />
      <Route path="/workshop/login" element={session ? <Navigate to="/" /> : <Auth initialView="client_login" onAuthSuccess={handleAuthSuccess} onBackToLanding={() => navigate('/')} />} />
      <Route path="/workshop/register" element={session ? <Navigate to="/" /> : <Auth initialView="client_signup" onAuthSuccess={handleAuthSuccess} onBackToLanding={() => navigate('/')} />} />
      <Route path="/academy" element={<div className="min-h-screen bg-slate-50 flex flex-col"><TutorialsHeader onBack={() => navigate('/')} /><main className="flex-1 overflow-y-auto p-8"><div className="max-w-7xl mx-auto"><Tutorials /></div></main></div>} />

      {/* Protected Pages */}
      <Route path="/reception" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><SmartReception /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/new-appraisal" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><SmartReception /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/client-analysis" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><ClientAnalysisPortal /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/kanban" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><RepairKanban /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/history-ot" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><OTHistory /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/calculator" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><CostCalculator /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/purchases" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><PurchaseImporter /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/operator-time" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><OperatorTimeTracking /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/client-area" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><ClientArea /></MainLayout></ProtectedRoleRoute>} />

      <Route path="/attendance" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><AttendanceTracker /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/new-valuation" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin', 'Admin_Staff', 'Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><NewValuation /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/payment" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Client', 'Admin']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><Subscription /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/register" element={<Navigate to="/workshop/register" replace />} />
      <Route path="/valuations" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin', 'Admin_Staff']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><Valuations /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/admin/queue" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin', 'Admin_Staff']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><AdminValuationsQueue /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/claims-planner" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><ClaimsPlanner /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/history-claims" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><ClaimsHistory /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/bitrix-config" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><BitrixConfig /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/appraisers" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><AppraisersManagement /></MainLayout></ProtectedRoleRoute>} />

      <Route path="/crm" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin', 'Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><CRM /></MainLayout></ProtectedRoleRoute>} />
      <Route path="/contacts" element={<ProtectedRoleRoute session={session} activeRole={activeRole} allowedRoles={['Admin', 'Client']}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><Contacts /></MainLayout></ProtectedRoleRoute>} />

      <Route path="/expediente/:id" element={<ProtectedRoute session={session}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><ExpedienteDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/analytics/report/:id" element={<ProtectedRoute session={session}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><AnalysisReport /></MainLayout></ProtectedRoute>} />
      <Route path="/vehicle/:id" element={<ProtectedRoute session={session}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><VehicleDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/tutorials" element={<ProtectedRoute session={session}><MainLayout activeRole={activeRole!} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}><Tutorials /></MainLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode, session: any }> = ({ children, session }) => {
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const TutorialsHeader = ({ onBack }: { onBack: () => void }) => (
  <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
    <div className="flex items-center gap-2 font-bold text-xl text-brand-600">
      <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-black">V+</div>
      ACADEMIA VALORA PLUS
    </div>
    <button onClick={onBack} className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black transition-all">Volver al Inicio</button>
  </header>
);

const App = () => {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

export default App;