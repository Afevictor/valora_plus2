import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { upgradeToPremium } from '../services/supabaseClient';

const Subscription: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleUpgrade = async () => {
        if (isLoading) return;
        setIsLoading(true);

        // Simulate payment delay
        setTimeout(async () => {
            const success = await upgradeToPremium();
            setIsLoading(false);

            if (success) {
                // Celebration or Success State
                alert("🎉 ¡Actualización exitosa! Ahora eres miembro Premium con acceso ilimitado.");
                navigate('/analytics');
            } else {
                alert("Error al procesar el pago. Por favor, inténtalo de nuevo.");
            }
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 p-8 md:p-12 relative">

                {/* Back Button */}
                <button onClick={() => navigate('/')} className="absolute top-6 left-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>

                <div className="space-y-6">
                    <span className="bg-brand-50 text-brand-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Límite de Uso Alcanzado</span>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                        Desbloquea <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Inteligencia Ilimitada.</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">
                        Has utilizado tus 3 auditorías mensuales gratuitas. Actualiza a Valora Premium para continuar analizando la rentabilidad sin límites.
                    </p>

                    <ul className="space-y-4 pt-4">
                        {[
                            'Auditorías de Rentabilidad Ilimitadas',
                            'Extracción AI Avanzada',
                            'Soporte Experto Dedicado',
                            'Exportar a PDF y Excel'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-slate-700 font-bold text-sm">
                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                {item}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={handleUpgrade}
                        disabled={isLoading}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Procesando...
                            </>
                        ) : 'Actualizar Ahora • 29€ / Mes'}
                    </button>
                    <p className="text-center text-xs text-slate-400 font-bold">Pago seguro vía Stripe • Cancela en cualquier momento</p>
                </div>

                <div className="relative h-full min-h-[400px] bg-slate-900 rounded-[32px] overflow-hidden flex items-center justify-center group">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-indigo-900/40"></div>
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>

                    <div className="relative text-center p-8">
                        <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20 group-hover:scale-110 transition-transform duration-500">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-white font-black text-2xl uppercase tracking-widest mb-2">Premium</h3>
                        <p className="text-slate-300 font-medium">Potencia tu taller con datos.</p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Subscription;
