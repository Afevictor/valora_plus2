import React from 'react';

interface LandingPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onClientLoginClick: () => void;
  onClientSignupClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({
  onLoginClick,
  onSignupClick,
  onClientLoginClick,
  onClientSignupClick
}) => {
  return (
    <div className="bg-white text-slate-900 font-sans selection:bg-brand-100">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-2xl text-brand-600 flex-shrink-0">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">V+</div>
            VALORA PLUS
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-brand-600 transition-colors">Funcionalidades</a>
            <a href="#solutions" className="hover:text-brand-600 transition-colors">Soluciones</a>
            <a href="#pricing" className="hover:text-brand-600 transition-colors">Precios</a>
          </nav>

          <div className="flex items-center gap-2 md:gap-6">
            {/* Workshop Section - Signup Removed */}
            <div className="flex items-center gap-2 border-r border-slate-200 pr-2 md:pr-6">
              <button onClick={onLoginClick} className="bg-brand-600 text-white px-5 py-2 rounded-full text-xs md:text-sm font-bold hover:bg-brand-700 transition-all shadow-sm whitespace-nowrap">Taller</button>
            </div>

            {/* Client Section */}
            <div className="flex items-center gap-2 pl-2">
              <span className="hidden sm:inline text-[10px] font-black text-emerald-500 uppercase tracking-widest mr-2">Cliente:</span>
              <button onClick={onClientLoginClick} className="text-xs md:text-sm font-bold text-slate-700 hover:text-emerald-600 whitespace-nowrap">Iniciar Sesión</button>
              <button onClick={onClientSignupClick} className="bg-emerald-500 text-white px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-bold hover:bg-emerald-600 transition-all shadow-sm whitespace-nowrap">Registrarse</button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in">
            Revolucionando la Gestión de Talleres
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-8 leading-tight tracking-tight">
            El Corazón Digital de los <br />
            <span className="text-brand-600 italic">Talleres Modernos</span>
          </h1>
          <p className="mt-8 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed animate-fade-in-blur animation-delay-300">
            Plataforma DMS todo en uno para <span className="font-bold text-slate-700">Talleres</span> y sus <span className="font-bold text-emerald-600">Clientes</span>. Recepción inteligente, análisis de rentabilidad y peritación experta en tiempo real.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button onClick={onLoginClick} className="w-full sm:w-auto bg-brand-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-brand-700 shadow-xl shadow-brand-200 transition-all transform hover:-translate-y-1">
              Acceso Taller
            </button>
            <button onClick={onClientSignupClick} className="w-full sm:w-auto bg-emerald-500 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-emerald-600 shadow-xl shadow-emerald-200 transition-all transform hover:-translate-y-1">
              Registro Cliente
            </button>
          </div>

          {/* App Preview Mockup */}
          <div className="relative max-w-5xl mx-auto rounded-2xl shadow-2xl border border-slate-200 overflow-hidden bg-slate-100 p-2 animate-fade-in-up">
            <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-inner aspect-[16/9] flex items-center justify-center text-slate-300">
              <img src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=1200" alt="Vista previa del panel" className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent flex items-end p-8">
                <div className="text-left">
                  <p className="text-white font-bold text-xl mb-1">Métricas de Rendimiento en Tiempo Real</p>
                  <p className="text-slate-200 text-sm">Supervise la rentabilidad de su taller con información inteligente.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">¿Por qué elegir Valora Plus?</h2>
            <p className="text-slate-500">Construido por dueños de talleres, para dueños de talleres.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Recepción Inteligente</h3>
              <p className="text-slate-500 leading-relaxed text-sm">Capture datos del vehículo con OCR inteligente. Identifique automáticamente matrículas, bastidores y kilometraje desde una sola foto.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Laboratorio de Rentabilidad</h3>
              <p className="text-slate-500 leading-relaxed text-sm">Suba informes de peritación y deje que nuestro sistema calcule sus márgenes reales, identifique riesgos y sugiera optimizaciones.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Chat Unificado</h3>
              <p className="text-slate-500 leading-relaxed text-sm">Puente directo entre su taller y los peritos de seguros. Gestione todos los chats de siniestros en un panel unificado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl p-12 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-brand-600/20 rounded-full blur-3xl"></div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 relative z-10">¿Listo para impulsar su taller?</h2>
          <p className="text-slate-400 mb-10 text-lg relative z-10">Únase a más de 500 talleres que utilizan Valora Plus para gestionar siniestros y rentabilidad.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <button onClick={onLoginClick} className="bg-brand-600 hover:bg-brand-700 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all">
              Acceso Taller
            </button>
            <button onClick={onClientSignupClick} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-10 py-4 rounded-xl font-bold text-lg transition-all">
              Portal del Cliente
            </button>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-100 text-center text-slate-400 text-sm">
        <p>© 2025 Valora Plus • El Futuro de la Gestión de Automoción</p>
      </footer>
    </div>
  );
};

export default LandingPage;