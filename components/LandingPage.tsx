
import React from 'react';

interface LandingPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onClientLoginClick: () => void;
  onClientSignupClick: () => void;
  onTutorialsClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({
  onLoginClick,
  onSignupClick,
  onClientLoginClick,
  onClientSignupClick,
  onTutorialsClick
}) => {
  return (
    <div className="bg-[#fafaf9] text-slate-900 font-sans selection:bg-brand-500/10 min-h-screen relative overflow-hidden">
      {/* Soft Milky Ambient Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-emerald-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full bg-white/60 backdrop-blur-xl z-50 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-brand-500/20 ring-4 ring-white text-xl transition-transform hover:scale-105">V+</div>
            <div className="flex flex-col">
              <span className="font-black text-lg md:text-xl tracking-tight leading-none text-slate-900">VALORA PLUS</span>
              <span className="text-[8px] md:text-[10px] font-bold text-brand-600 tracking-[0.2em] uppercase mt-1 hidden sm:block">Inteligencia de Gestión</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-10 text-[11px] font-black text-slate-400 uppercase tracking-widest">
            <a href="#features" className="hover:text-brand-600 transition-colors">Tecnología</a>
            <button onClick={onTutorialsClick} className="hover:text-brand-600 transition-colors">Academia</button>
            <a href="#solutions" className="hover:text-brand-600 transition-colors">Ecosistema</a>
          </nav>

          <div className="flex items-center gap-4">
            {/* Admin Access - Icon Only */}
            <button
              onClick={onLoginClick}
              className="p-3 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-600 transition-all group relative border border-slate-200"
              title="Acceso Gestión"
            >
              <svg className="w-5 h-5 text-slate-500 group-hover:text-brand-600 group-hover:scale-110 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" /><path d="M12 16h.01" />
              </svg>
            </button>

            <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block" />

            {/* Client Section - Ultra Visible */}
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={onClientLoginClick}
                className="text-[10px] md:text-xs font-black text-slate-500 hover:text-slate-900 uppercase tracking-wider transition-colors px-2 md:px-4 py-2.5 rounded-xl hover:bg-slate-50"
              >
                Acceso
              </button>
              <button
                onClick={onClientSignupClick}
                className="px-4 md:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 ring-2 md:ring-4 ring-white"
              >
                Registro
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 md:pt-48 pb-16 md:pb-32 px-4 md:px-6 relative">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-600/10 border border-brand-600/10 text-brand-700 px-3 md:px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] mb-12 animate-fade-in shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600"></span>
            </span>
            Sistema de Taller de Próxima Generación
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black mb-10 leading-[1.1] md:leading-[0.9] tracking-tighter text-slate-900 px-4">
            DOMINIO SOBRE <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-indigo-600">CADA COMPONENTE</span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-500 text-lg md:text-xl font-medium leading-relaxed mb-16 px-4">
            El enlace inteligente entre <span className="text-slate-900 font-bold underline decoration-brand-500 decoration-4 underline-offset-4">Talleres</span> de alto rendimiento y sus <span className="text-emerald-700 font-bold underline decoration-emerald-500 decoration-4 underline-offset-4">Socios Estratégicos</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
            <button onClick={onClientSignupClick} className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 hover:-translate-y-1 active:scale-95">
              COMENZAR
            </button>
          </div>

          {/* App Preview Mockup */}
          <div className="relative max-w-6xl mx-auto group">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 to-indigo-600/10 rounded-[40px] blur-3xl opacity-50" />
            <div className="relative bg-white rounded-[40px] p-4 border border-slate-200 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden aspect-[16/10]">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/60 pointer-events-none z-10" />
              <img
                src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=2000"
                alt="System Preview"
                className="w-full h-full object-cover rounded-[28px] group-hover:scale-105 transition-transform duration-[3s] opacity-90"
              />
              <div className="absolute bottom-12 left-12 right-12 z-20 flex justify-between items-end">
                <div className="text-left">
                  <span className="text-brand-600 text-[10px] font-black uppercase tracking-[0.3em]">Módulo Activo</span>
                  <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">Análisis de Rentabilidad en Tiempo Real</h3>
                </div>
                <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-white shadow-xl">
                  <div className="flex gap-4">
                    <div className="w-2 h-8 bg-brand-500 rounded-full animate-[bounce_1.5s_infinite]" />
                    <div className="w-2 h-8 bg-brand-500 rounded-full animate-[bounce_1.5s_infinite_0.2s]" />
                    <div className="w-2 h-8 bg-brand-500 rounded-full animate-[bounce_1.5s_infinite_0.4s]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="features" className="py-16 md:py-32 relative border-t border-slate-200/50 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-16 md:mb-24 max-w-3xl mx-auto">
            <span className="text-brand-600 font-black uppercase tracking-widest text-xs mb-4 block">Nuestro Pilar Fundamental</span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">Valoraciones de Daños Objetivas</h2>
            <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed">
              Transforme la rentabilidad y eficiencia de su taller con informes periciales independientes que garantizan una valoración justa y precisa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Aumento de Rentabilidad",
                desc: "Identifique y asegure la compensación justa por cada reparación, incrementando sus beneficios entre un 5% y un 35%. La precisión se traduce directamente en mayor rentabilidad.",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                color: "brand"
              },
              {
                title: "Negociación Efectiva",
                desc: "Armado con valoraciones imparciales, obtiene un mayor poder de negociación. Consiga baremos adecuados y reduzca las discrepancias con las aseguradoras.",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>,
                color: "indigo"
              },
              {
                title: "Eficiencia y Rapidez",
                desc: "Reciba las peritaciones en menos de 24 horas. Agilice la gestión de sus expedientes y mejore significativamente la eficiencia operativa.",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                color: "emerald"
              },
              {
                title: "Sin Formación Necesaria",
                desc: "Evite costosas inversiones en formación o software. Nosotros nos encargamos de todo el proceso de peritación con expertos.",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
                color: "amber"
              },
              {
                title: "Independencia Total",
                desc: "Somos peritos SIN vínculos con aseguradoras. Nuestras valoraciones son 100% imparciales y centradas en sus intereses.",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
                color: "rose"
              },
              {
                title: "Integración Fluida",
                desc: "Nos integramos sin fricciones en su operativa diaria con soluciones adaptadas a sus sistemas actuales.",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>,
                color: "cyan"
              }
            ].map((f, idx) => (
              <div key={idx} className="group p-6 md:p-8 rounded-[32px] bg-white border border-slate-200 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
                <div className={`w-14 h-14 bg-${f.color}-50 text-${f.color}-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-xl font-black mb-3 tracking-tight text-slate-900">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 bg-slate-900 rounded-[40px] p-6 md:p-12 relative overflow-hidden text-center md:text-left">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600/20 rounded-full blur-[100px]" />
            <div className="relative z-10 grid md:grid-cols-3 gap-12">
              <div>
                <h4 className="text-brand-400 font-black uppercase tracking-widest text-xs mb-4">Satisfacción del Cliente</h4>
                <p className="text-slate-300 font-medium">Mejore la relación con aseguradoras y clientes finales a través de la transparencia y peritaciones profesionales.</p>
              </div>
              <div>
                <h4 className="text-brand-400 font-black uppercase tracking-widest text-xs mb-4">Reducción de Conflictos</h4>
                <p className="text-slate-300 font-medium">Minimice las discusiones y reduzca los tiempos de resolución con informes fundamentados y objetivos.</p>
              </div>
              <div>
                <h4 className="text-brand-400 font-black uppercase tracking-widest text-xs mb-4">Maximización de Recursos</h4>
                <p className="text-slate-300 font-medium">Libere a su equipo de las peritaciones para que se centren totalmente en las reparaciones productivas.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer Branding */}
      <footer className="py-20 border-t border-slate-200 text-center">
        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.5em]">VALORA PLUS • INTELIGENCIA DE GESTIÓN</p>
        <p className="mt-4 text-slate-300 text-[10px] font-bold">SISTEMA DE GESTIÓN DE TALLER DE PRÓXIMA GENERACIÓN</p>
      </footer>
    </div>
  );
};

export default LandingPage;