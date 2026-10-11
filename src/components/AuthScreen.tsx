import React, { useState } from 'react';
import { ShieldCheck, Users, Lock, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { UserAuth } from '../types';

interface AuthScreenProps {
  onLogin: (user: UserAuth) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [panelType, setPanelType] = useState<'client' | 'admin'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    if (panelType === 'admin') {
      // Admin verification
      if (email === 'admin@nyxzap.com' && password === 'admin123') {
        onLogin({
          id: 'admin-1',
          name: 'Super Administrador',
          email: 'admin@nyxzap.com',
          role: 'admin'
        });
      } else {
        // Allow demonstration login with hint
        onLogin({
          id: 'admin-1',
          name: 'Super Administrador',
          email,
          role: 'admin'
        });
      }
    } else {
      // Client verification
      onLogin({
        id: 'client-1',
        name: 'Carlos Mendes',
        email,
        role: 'client',
        planName: 'Plano Pro (Gemini 3)',
        validUntil: '2026-11-10'
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0f111a] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-2xl mx-auto shadow-lg shadow-purple-600/30">
            ⚡
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">NyxZap</h1>
          <p className="text-xs text-slate-400">
            Acesse seu ambiente seguro de automações, IA e CRM
          </p>
        </div>

        {/* Panel Switcher (Admin vs Client) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#151824] rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setPanelType('client'); setError(''); }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              panelType === 'client'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Login do Cliente</span>
          </button>

          <button
            type="button"
            onClick={() => { setPanelType('admin'); setError(''); }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              panelType === 'admin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Login Admin</span>
          </button>
        </div>

        {/* Notification Banner */}
        <div className={`p-3 rounded-xl border text-xs ${
          panelType === 'admin'
            ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300'
            : 'bg-purple-950/30 border-purple-500/30 text-purple-300'
        }`}>
          {panelType === 'admin' ? (
            <span>🛡️ Acesso exclusivo para controle de MRR, planos e assinaturas da plataforma.</span>
          ) : (
            <span>💬 Acesso ao painel de WhatsApp, Agente IA, fluxos e chat em tempo real.</span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold">
            {error}
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
                placeholder={panelType === 'admin' ? 'admin@nyxzap.com' : 'seuemail@empresa.com'}
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
            className={`w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
              panelType === 'admin'
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
            }`}
          >
            <span>{panelType === 'admin' ? 'Acessar Painel Administrador' : 'Entrar no NyxZap'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Fast Fill Buttons */}
        <div className="pt-2 border-t border-slate-800/80 text-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
            Acesso Rápido para Testes
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPanelType('client');
                setEmail('cliente@empresa.com');
                setPassword('123456');
              }}
              className="flex-1 py-1.5 bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
            >
              Demo Cliente
            </button>
            <button
              type="button"
              onClick={() => {
                setPanelType('admin');
                setEmail('admin@nyxzap.com');
                setPassword('admin123');
              }}
              className="flex-1 py-1.5 bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
            >
              Demo Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
