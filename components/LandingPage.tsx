
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
              <span className="font-black text-xl tracking-tight leading-none text-slate-900">VALORA PLUS</span>
              <span className="text-[10px] font-bold text-brand-600 tracking-[0.2em] uppercase mt-1">DMS Intelligence</span>
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
            <div className="flex items-center gap-2">
              <button
                onClick={onClientLoginClick}
                className="text-xs font-black text-slate-500 hover:text-slate-900 uppercase tracking-wider transition-colors px-4 py-2.5 rounded-xl hover:bg-slate-50"
              >
                Login
              </button>
              <button
                onClick={onClientSignupClick}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 ring-4 ring-white"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-48 pb-32 px-6 relative">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-600/10 border border-brand-600/10 text-brand-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-12 animate-fade-in shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600"></span>
            </span>
            Next-Gen Workshop OS
          </div>

          <h1 className="text-6xl md:text-8xl font-black mb-10 leading-[0.9] tracking-tighter text-slate-900">
            MASTERY OVER <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-indigo-600">EVERY COMPONENT</span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-500 text-lg md:text-xl font-medium leading-relaxed mb-16 px-4">
            The intelligent link between high-performance <span className="text-slate-900 font-bold underline decoration-brand-500 decoration-4 underline-offset-4">Workshops</span> and their <span className="text-emerald-700 font-bold underline decoration-emerald-500 decoration-4 underline-offset-4">Strategic Partners</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
            <button onClick={onClientSignupClick} className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 hover:-translate-y-1 active:scale-95">
              GET STARTED
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
                  <span className="text-brand-600 text-[10px] font-black uppercase tracking-[0.3em]">Module Active</span>
                  <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">Real-Time Yield Analytics</h3>
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

      {/* Features Grid */}
      <section id="features" className="py-32 relative border-t border-slate-200/50 bg-white/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: "Smart Intake",
                desc: "Extract vehicle DNA with intelligent OCR. License plates, VINs, and mileage—captured instantly.",
                color: "text-brand-600",
                bg: "bg-brand-50",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              },
              {
                title: "Yield Lab",
                desc: "Real-time margin calculation and risk identification. Pivot your strategy based on hard data.",
                color: "text-indigo-600",
                bg: "bg-indigo-50",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              },
              {
                title: "Unified Hub",
                desc: "A hardened communication link between your workshop floor and insurance experts.",
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
              }
            ].map((f, idx) => (
              <div key={idx} className="group p-10 rounded-[40px] bg-white border border-slate-200 hover:border-brand-200 hover:shadow-2xl hover:shadow-brand-500/5 transition-all duration-500">
                <div className={`w-16 h-16 ${f.bg} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-2xl font-black mb-4 tracking-tight text-slate-900">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="py-20 border-t border-slate-200 text-center">
        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.5em]">VALORA PLUS • DMS INTELLIGENCE</p>
        <p className="mt-4 text-slate-300 text-[10px] font-bold">NEXT-GENERATION AUTOMOTIVE MANAGEMENT SYSTEM</p>
      </footer>
    </div>
  );
};

export default LandingPage;