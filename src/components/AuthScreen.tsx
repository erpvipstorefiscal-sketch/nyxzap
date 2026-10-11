import React, { useState } from 'react';
import { ShieldCheck, Users, Lock, Mail, ArrowRight, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserAuth } from '../types';

interface AuthScreenProps {
  onLogin: (user: UserAuth) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  // Detect if accessing through painel.nyxzap.com.br or /admin route
  const isPainelAdmin = typeof window !== 'undefined' && (
    window.location.hostname.includes('painel.') || 
    window.location.pathname.startsWith('/admin') ||
    window.location.search.includes('admin')
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: isPainelAdmin ? 'admin' : 'client'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciais inválidas.');
      }

      onLogin(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className={`absolute top-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        isPainelAdmin ? 'bg-indigo-600/15' : 'bg-purple-600/15'
      }`}></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0f111a] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-2xl mx-auto shadow-lg ${
            isPainelAdmin 
              ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-indigo-600/30' 
              : 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-600/30'
          }`}>
            {isPainelAdmin ? '🛡️' : '⚡'}
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">NyxZap</h1>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${
              isPainelAdmin
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
            }`}>
              {isPainelAdmin ? 'Painel SuperAdmin' : 'Portal do Cliente'}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            {isPainelAdmin 
              ? 'Gestão de Licenças, Assinantes, MRR e Planos' 
              : 'Acesse seu ambiente de automações WhatsApp, Agentes IA e CRM'}
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#151824] border border-slate-800 text-[11px] font-mono text-slate-400 mt-1">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>{isPainelAdmin ? 'painel.nyxzap.com.br' : 'zap.nyxzap.com.br'}</span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              E-mail de Acesso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder={isPainelAdmin ? 'admin@nyxzap.com' : 'seuemail@empresa.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
              isPainelAdmin
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
            }`}
          >
            <span>
              {loading 
                ? 'Verificando no Banco de Dados...' 
                : (isPainelAdmin ? 'Acessar Painel SuperAdmin' : 'Entrar no NyxZap')}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Fast Fill Buttons for Convenient Testing */}
        <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Credenciais Padrão do Banco de Dados PostgreSQL
          </span>
          {isPainelAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEmail('admin@nyxzap.com');
                setPassword('admin123');
              }}
              className="w-full py-2 bg-[#151824] hover:bg-slate-800 text-indigo-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Preencher Admin (admin@nyxzap.com / admin123)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEmail('cliente@empresa.com');
                setPassword('123456');
              }}
              className="w-full py-2 bg-[#151824] hover:bg-slate-800 text-purple-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Preencher Cliente (cliente@empresa.com / 123456)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

