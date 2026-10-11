import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound, 
  ArrowLeft, 
  Shield, 
  Check, 
  User, 
  Sparkles, 
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
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

  // View modes: 'login' | 'register'
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Google sign in state
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Password strength checks for register
  const hasMinLength = regPassword.length >= 8;
  const hasLetters = /[a-zA-Z]/.test(regPassword);
  const hasNumbers = /[0-9]/.test(regPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(regPassword);
  const isPasswordStrong = hasMinLength && hasLetters && hasNumbers && hasSpecial;
  const passwordsMatch = regPassword === regConfirmPassword && regConfirmPassword.length > 0;

  // Check URL query parameters for direct reset link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('resetToken');
      const paramEmail = params.get('email');
      if (token && paramEmail) {
        setForgotEmail(paramEmail);
        setVerificationCode(token);
        setRecoveryStep('verify');
        setShowForgotModal(true);
      }
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginNotice('');

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName.trim() || !regEmail.trim()) {
      setRegError('Preencha seu nome e e-mail.');
      return;
    }

    if (!isPasswordStrong) {
      setRegError('A senha deve ter no mínimo 8 caracteres com letras, números e símbolos.');
      return;
    }

    if (!passwordsMatch) {
      setRegError('As senhas não coincidem.');
      return;
    }

    setRegLoading(true);
    trackEvent('register_attempt', 'register_page', { email: regEmail.trim() });

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta.');
      }

      identifyUser(data.id, data.email);
      trackEvent('register_success_trial', 'register_page', { email: data.email });
      onLogin(data);
    } catch (err: any) {
      setRegError(err.message || 'Erro ao criar conta.');
    } finally {
      setRegLoading(false);
    }
  };

  // Google OAuth Flow (Real Google Accounts Popup with 1-Day Free Trial)
  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError('');
    setRegError('');
    trackEvent('google_auth_click', viewMode);

    try {
      // Use Google Identity Services (GIS) if available
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
        const googleAuthPromise = new Promise<{ email: string; name?: string; sub: string }>((resolve, reject) => {
          (window as any).google.accounts.id.initialize({
            client_id: '617019849221-i5d5gm9cqe34c49h3p6gdffu9b523fuv.apps.googleusercontent.com',
            callback: (response: any) => {
              try {
                // Decode Google JWT credential payload
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                  atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
                );
                const payload = JSON.parse(jsonPayload);
                resolve({
                  email: payload.email,
                  name: payload.name || payload.given_name,
                  sub: payload.sub
                });
              } catch (e) {
                reject(e);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });

          // Open Google One Tap or prompt
          (window as any).google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // Open official Google OAuth redirect/popup fallback
              const width = 500;
              const height = 600;
              const left = window.screenX + (window.outerWidth - width) / 2;
              const top = window.screenY + (window.outerHeight - height) / 2;
              const popup = window.open(
                `https://accounts.google.com/o/oauth2/v2/auth?client_id=617019849221-i5d5gm9cqe34c49h3p6gdffu9b523fuv.apps.googleusercontent.com&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=token%20id_token&scope=email%20profile&nonce=nyx-${Date.now()}`,
                'google_login_popup',
                `width=${width},height=${height},left=${left},top=${top}`
              );

              if (!popup) {
                reject(new Error('O popup do Google foi bloqueado pelo navegador. Permita popups para continuar.'));
              }
            }
          });
        });

        const googleUser = await googleAuthPromise;
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: googleUser.email.trim().toLowerCase(),
            name: googleUser.name || googleUser.email.split('@')[0],
            googleId: googleUser.sub
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao autenticar com o Google.');

        identifyUser(data.id, data.email);
        trackEvent('google_auth_success', viewMode, { email: data.email });
        onLogin(data);
        return;
      }

      // If GIS library is still loading, open native Google OAuth window
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin',
        'google_login',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      throw new Error('Janela do Google aberta. Selecione sua conta Google.');
    } catch (err: any) {
      if (viewMode === 'register') setRegError(err.message);
      else setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail) {
      setForgotError('Informe o e-mail cadastrado da sua conta.');
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

      setForgotSuccess(data.message || 'Código de segurança enviado para o seu e-mail!');
      setRecoveryStep('verify');
    } catch (err: any) {
      setForgotError(err.message || 'Erro ao solicitar recuperação.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!verificationCode || !newPassword) {
      setForgotError('Informe o código recebido no e-mail e a nova senha.');
      return;
    }

    if (newPassword.length < 6) {
      setForgotError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: verificationCode.trim(),
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha.');
      }

      setEmail(forgotEmail.trim());
      setPassword('');
      setShowForgotModal(false);
      setRecoveryStep('request');
      setLoginNotice('Senha redefinida com sucesso! Você já pode entrar usando sua nova senha.');
    } catch (err: any) {
      setForgotError(err.message || 'Erro ao redefinir senha.');
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
              : viewMode === 'login'
              ? 'Plataforma de Automação & IA'
              : 'Crie sua conta e ganhe 1 dia de teste grátis'}
          </p>
        </div>

        {loginNotice && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{loginNotice}</span>
          </div>
        )}

        {/* ======================= LOGIN VIEW ======================= */}
        {viewMode === 'login' && (
          <div className="space-y-4">
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Fast Sign-in Button */}
            {!isPainelAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={googleLoading}
                  className="w-full py-3 bg-[#151824] hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{googleLoading ? 'Conectando...' : 'Entrar com o Google'}</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-800"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ou com seu e-mail</span>
                  <div className="flex-1 h-px bg-slate-800"></div>
                </div>
              </>
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
                      setRecoveryStep('request');
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
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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

            {/* Links de Cadastro e Assinatura (Apenas no Portal do Cliente) */}
            {!isPainelAdmin && (
              <div className="pt-3 border-t border-slate-800 space-y-2.5 text-center">
                {/* Ainda não tem conta? Criar conta grátis */}
                <div className="text-xs text-slate-400">
                  <span>Ainda não tem conta? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register');
                      setRegError('');
                      trackEvent('switch_to_register', 'auth');
                    }}
                    className="font-bold text-purple-400 hover:text-purple-300 underline transition-colors"
                  >
                    Criar conta grátis (1 dia de teste)
                  </button>
                </div>

                {/* Não possui o NyxZap ainda? Adquira aqui */}
                <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs flex items-center justify-between">
                  <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    Não possui o NyxZap ainda?
                  </span>
                  <a
                    href="https://pay.cakto.com.br/nyxzap-pro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors underline"
                  >
                    <span>Adquira aqui</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= REGISTER VIEW ======================= */}
        {viewMode === 'register' && (
          <div className="space-y-4 animate-fadeIn">
            {regError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {/* Google One-Click Register */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="w-full py-3 bg-[#151824] hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2.5 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{googleLoading ? 'Criando...' : 'Criar conta com o Google'}</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-800"></div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ou formulário completo</span>
              <div className="flex-1 h-px bg-slate-800"></div>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Seu Nome ou Empresa"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seuemail@empresa.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Senha Forte
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicators */}
                <div className="grid grid-cols-2 gap-1.5 pt-1.5 text-[10px]">
                  <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" /> 8+ Caracteres
                  </span>
                  <span className={`flex items-center gap-1 ${hasLetters ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" /> Letras
                  </span>
                  <span className={`flex items-center gap-1 ${hasNumbers ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" /> Números
                  </span>
                  <span className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" /> Símbolos (!@#$)
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Repita sua senha"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>
                {regConfirmPassword && (
                  <span className={`text-[10px] block mt-1 ${passwordsMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {passwordsMatch ? '✓ As senhas coincidem' : '✗ As senhas não conferem'}
                  </span>
                )}
              </div>

              {/* 1 Day Free Trial Badge */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>Ativação Imediata: <strong>1 dia de teste grátis</strong> sem cartão!</span>
              </div>

              <button
                type="submit"
                disabled={regLoading || !isPasswordStrong || !passwordsMatch}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{regLoading ? 'Criando Conta...' : 'Começar 1 Dia Grátis'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-400">
              <span>Já tem uma conta? </span>
              <button
                type="button"
                onClick={() => {
                  setViewMode('login');
                  setError('');
                  trackEvent('switch_to_login', 'auth');
                }}
                className="font-bold text-purple-400 hover:text-purple-300 underline transition-colors"
              >
                Fazer login
              </button>
            </div>
          </div>
        )}

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
                <h3 className="text-base font-bold text-white">Recuperação de Senha</h3>
                <p className="text-xs text-slate-400">
                  {recoveryStep === 'request'
                    ? 'Informe seu e-mail cadastrado no sistema'
                    : 'Digite o código de 6 dígitos e sua nova senha'}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {recoveryStep === 'request' ? (
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
                    {forgotLoading ? 'Verificando...' : 'Enviar Código'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                {forgotSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    <span>{forgotSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Código de 6 Dígitos (enviado por e-mail)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 849201"
                    maxLength={10}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-4 py-3 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-purple-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Sua Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#151824] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('request')}
                    className="flex-1 py-3 bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Reenviar
                  </button>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Salvando...' : 'Salvar Nova Senha'}
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
