import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, KeyRound, ArrowLeft, Shield } from 'lucide-react';
import { UserAuth } from '../types';
import { identifyUser, trackEvent } from '../lib/telemetry';

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

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    trackEvent('login_attempt', 'login_page', { email: email.trim(), role: isPainelAdmin ? 'admin' : 'client' });

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

      identifyUser(data.id, data.email);
      trackEvent('login_success', 'login_page', { role: data.role });
      onLogin(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
      trackEvent('login_failed', 'login_page', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail) {
      setForgotError('Informe o e-mail da sua conta.');
      return;
    }

    setForgotLoading(true);
    trackEvent('forgot_password_submit', 'forgot_password_modal', { email: forgotEmail });

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar recuperação.');
      }

      setForgotSuccess(data.message || 'Instruções de redefinição enviadas para o seu e-mail!');
    } catch (err: any) {
      setForgotError(err.message || 'Erro ao solicitar recuperação.');
    } finally {
      setForgotLoading(false);
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
          
          <h1 className="text-2xl font-black text-white tracking-tight">NyxZap</h1>

          <p className="text-xs text-slate-400">
            {isPainelAdmin 
              ? 'Painel Administrativo' 
              : 'Plataforma de Automação & IA'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="seuemail@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Senha
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotError('');
                  setForgotSuccess('');
                  setShowForgotModal(true);
                }}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium transition-colors"
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
            <span>{loading ? 'Acessando...' : 'Entrar'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center">
          <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            Conexão Criptografada & Proteção contra Tentativas
          </span>
        </div>
      </div>

      {/* Esqueci Minha Senha Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#0f111a] border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-5 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Recuperar Senha</h3>
                <p className="text-xs text-slate-400">Insira seu e-mail para receber as instruções</p>
              </div>
            </div>

            {forgotError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>E-mail Enviado!</span>
                </div>
                <p>{forgotSuccess}</p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Seu E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="seuemail@empresa.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-3 bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Enviando...' : 'Recuperar Senha'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
