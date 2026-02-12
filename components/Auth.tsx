
import React, { useState, useEffect } from 'react';
import { supabase, saveUserPins, verifyPinAndGetRole, saveClientToSupabase, checkIsWorkshopAuthEmail, addToWorkshopAuth, saveCompanyProfileToSupabase, saveWorkshopAsClient } from '../services/supabaseClient';
import { AppRole, Client, ClientType, PaymentMethod, PaymentTerms, ContactChannel, TariffType } from '../types';

interface AuthProps {
  initialView?: 'login' | 'signup' | 'pin_entry' | 'client_login' | 'client_signup';
  onAuthSuccess: (role: AppRole, shouldRedirect?: boolean) => void;
  onBackToLanding: () => void;
}

const Auth: React.FC<AuthProps> = ({ initialView = 'login', onAuthSuccess, onBackToLanding }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'pin_entry' | 'client_login' | 'client_signup'>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);

  // Client Signup Specific State
  const [clientData, setClientData] = useState<Partial<Client>>({
    id: '', // Will be set to auth user id
    clientType: 'Individual',
    isCompany: false,
    name: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    province: '',
    country: 'Spain',
    preferredChannel: 'WhatsApp',
    paymentMethod: 'Cash',
    tariff: 'General',
    allowCommercialComms: true
  });

  const [contactPerson, setContactPerson] = useState({
    name: '', role: '', directPhone: '', directEmail: ''
  });

  useEffect(() => {
    if (view !== 'pin_entry') {
      setView(initialView);
    }
  }, [initialView]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
    } else if (data.user) {
      setAuthenticatedUserId(data.user.id);

      // Retrieve additional checks
      const isWorkshopAuthTable = await checkIsWorkshopAuthEmail(email);
      const isMetadataAdmin = data.user.user_metadata?.user_type === 'workshop';

      // Effective Admin check: Is in whitelist OR has admin metadata
      const isEffectiveAdmin = isWorkshopAuthTable || isMetadataAdmin;

      if (view === 'client_login') {
        // If client login area, be paranoid: If ANY sign of admin, BLOCK IT.
        if (isEffectiveAdmin) {
          console.warn(`[AUTH SECURITY] Blocked Admin Login on Client Portal: ${email}`);
          setError("ACCESO DENEGADO: Cuenta de Administrador detectada. Por favor use el acceso de Taller.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        onAuthSuccess('Client');
      } else {
        // Workshop Area: Must be explicitly whitelisted in workshop_auth 
        // OR have the correct metadata (legacy support)
        if (!isEffectiveAdmin) {
          setError("ACCESO DENEGADO: Sus credenciales no corresponden a un administrador de taller.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        onAuthSuccess('Admin');
      }
      setLoading(false);
    }
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const defaultKeys = {
      Admin: '123456',
      Operator: '000000',
      Admin_Staff: '999999'
    };

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { workshop_name: workshopName, user_type: 'workshop' }
      }
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      if (!data.session) {
        setError("Verificación Requerida: Por favor, revise su email y haga clic en el enlace de confirmación.");
        setLoading(false);
        return;
      }

      try {
        await addToWorkshopAuth(email);

        // Ensure the workshop is also in the Master 'clients' list for Admin visibility
        await saveWorkshopAsClient({
          id: data.user.id,
          name: workshopName,
          email: email,
          isCompany: true,
          clientType: 'Company',
          taxId: '', address: '', city: '', zip: '', province: '', phone: '',
          preferredChannel: 'WhatsApp', paymentMethod: 'Cash', tariff: 'General',
          allowCommercialComms: true, country: 'Spain'
        } as Client);

        // Initialize empty profile
        await saveCompanyProfileToSupabase({
          companyName: workshopName,
          email: email,
          cif: '', address: '', city: '', zipCode: '', province: '', phone: '',
          costeHora: 0, pvpManoObra: 0
        });

        setAuthenticatedUserId(data.user.id);
        onAuthSuccess('Admin');
      } catch (err: any) {
        setError(`Fallo al establecer la sesión: ${err.message || 'Error desconocido'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClientSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: clientData.email!,
        password: password,
        options: {
          data: { user_type: 'client' }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear la cuenta de usuario.");

      // 2. Prepare Client Profile
      const finalClient: Client = {
        ...clientData as Client,
        id: authData.user.id, // Link to Auth User
        contactPerson: clientData.isCompany ? contactPerson : undefined
      };

      // 3. Save as a Workshop 'Client' (for the Admin Master list) - NOT in workshop_customers
      const success = await saveWorkshopAsClient(finalClient);

      // 4. Initialize Workshop Profile (Automatically populate with registration data for My Workshop area)
      await saveCompanyProfileToSupabase({
        companyName: finalClient.name,
        cif: finalClient.taxId,
        address: finalClient.address,
        city: finalClient.city,
        zipCode: finalClient.zip,
        province: finalClient.province,
        email: finalClient.email,
        phone: finalClient.phone,
        costeHora: 0,
        pvpManoObra: 0
      });

      if (success) {
        setSuccessMsg("Client profile created successfully!");
        // If they are logged in immediately (no email confirm required in this config)
        if (authData.session) {
          setTimeout(() => onAuthSuccess('Client'), 1500);
        } else {
          setError("Account created. Please check your email to confirm and then log in.");
          setLoading(false);
        }
      } else {
        setError("Error creating the client profile in the database.");
      }
    } catch (err: any) {
      setError(err.message || "Error saving the client data");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setSuccessMsg("Revise su email para ver las instrucciones de recuperación.");
    setLoading(false);
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 font-sans ${view === 'client_signup' ? 'py-12' : ''}`}>
      <button
        onClick={onBackToLanding}
        className="fixed top-4 left-4 md:top-8 md:left-8 text-slate-500 hover:text-brand-600 flex items-center gap-2 font-semibold transition-colors z-50 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm md:bg-transparent md:shadow-none"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        <span className="text-sm">Volver</span>
      </button>

      <div className={`w-full ${view === 'client_signup' ? 'max-w-4xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-10 mt-16 md:mt-0`}>
        <div className="text-center mb-6 md:mb-10">
          <div className={`w-14 h-14 ${view.includes('client') ? 'bg-emerald-500' : 'bg-brand-600'} rounded-2xl flex items-center justify-center text-white font-black shadow-lg mx-auto mb-6 text-2xl`}>V+</div>
          <h2 className="text-3xl font-black text-slate-900">
            {view === 'login' ? 'Acceso de Gestión' :
              view === 'signup' ? 'Crear Cuenta de Taller' :
                view === 'client_login' ? 'Acceso Mi Taller' :
                  view === 'client_signup' ? 'Registro de Taller' :
                    'Recuperar Contraseña'}
          </h2>
          {view === 'client_signup' && <p className="text-slate-500 mt-2">Complete all required fields.</p>}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm animate-fade-in break-words overflow-hidden">
            <span className="font-bold uppercase text-[10px] block mb-1">Error del Sistema</span>
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 text-green-700 text-sm animate-fade-in">
            {successMsg}
          </div>
        )}


        {view === 'client_login' && (
          <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Correo Electrónico</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="su@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Contraseña</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="text-right">
              <button type="button" onClick={() => setView('forgot')} className="text-xs font-bold text-emerald-600">¿Olvidó su contraseña?</button>
            </div>
            <button
              disabled={loading}
              className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : null}
              ACCEDER A MI TALLER
            </button>
          </form>
        )}

        {view === 'client_signup' && (
          <form onSubmit={handleClientSignup} className="space-y-6 animate-fade-in">

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Nombre del Taller / Empresa</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Workshop / Company Name"
                  value={clientData.name}
                  onChange={e => setClientData({ ...clientData, name: e.target.value, isCompany: true, clientType: 'Company' })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">CIF / NIF</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                  placeholder="G-12345678"
                  value={clientData.taxId}
                  onChange={e => setClientData({ ...clientData, taxId: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Dirección Fiscal</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Full Fiscal Address"
                  value={clientData.address}
                  onChange={e => setClientData({ ...clientData, address: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Email (Access)</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="workshop@example.com"
                  value={clientData.email}
                  onChange={e => setClientData({ ...clientData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              disabled={loading || !clientData.name || !password || !clientData.email}
              className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-8 text-lg"
            >
              {loading ? <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : null}
              REGISTRAR TALLER
            </button>
          </form>
        )}

        {(view === 'login' || view === 'signup' || view === 'forgot') && (
          <form onSubmit={view === 'login' ? handleLogin : view === 'signup' ? handleSignup : handleResetPassword}>
            <div className="space-y-4">
              {view === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Razón Social del Taller</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder="ej. Valora Motors S.L."
                    value={workshopName}
                    onChange={e => setWorkshopName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="admin@taller.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {view !== 'forgot' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 ml-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              )}
            </div>

            {view === 'login' && (
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl mt-8 hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              )}
              {view === 'login' ? 'Entrar' : view === 'signup' ? 'Crear Cuenta' : 'Enviar Instrucciones'}
            </button>
          </form>
        )}

        {(view === 'client_login' || view === 'client_signup') && (
          <div className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm font-medium">
              {view === 'client_login' ? "¿Nuevo Taller?" : "¿Ya tiene cuenta?"}
              <button
                onClick={() => {
                  setError(null);
                  setSuccessMsg(null);
                  if (view === 'client_login') setView('client_signup');
                  else if (view === 'client_signup') setView('client_login');
                }}
                className="ml-2 font-bold text-emerald-600 hover:text-emerald-700"
              >
                {view === 'client_login' ? 'Registrarse' : 'Entrar'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;