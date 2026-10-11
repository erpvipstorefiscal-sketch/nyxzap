import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  Bot, 
  Workflow, 
  Users, 
  MessageSquare,
  LogOut,
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
  HelpCircle,
  Bell,
  User,
  Key,
  CreditCard,
  X,
  ExternalLink,
  LifeBuoy,
  Send,
  ChevronDown,
  Check,
  Radio,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { UserAuth, SystemUpdate } from './types';
import { AuthScreen } from './components/AuthScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { WhatsAppManager } from './components/WhatsAppManager';
import { AIAgentManager } from './components/AIAgentManager';
import { FlowBuilder } from './components/FlowBuilder';
import { LiveChatManager } from './components/LiveChatManager';
import { RenewSubscriptionScreen } from './components/RenewSubscriptionScreen';
import { ChannelsIntegrations } from './components/ChannelsIntegrations';

export function App() {
  const [user, setUser] = useState<UserAuth | null>(() => {
    try {
      const saved = localStorage.getItem('nyxzap_user');
      const lastActive = localStorage.getItem('nyxzap_last_active');
      if (saved && lastActive) {
        const diffMinutes = (Date.now() - parseInt(lastActive, 10)) / (1000 * 60);
        if (diffMinutes < 30) {
          localStorage.setItem('nyxzap_last_active', Date.now().toString());
          return JSON.parse(saved);
        } else {
          localStorage.removeItem('nyxzap_user');
          localStorage.removeItem('nyxzap_last_active');
        }
      }
    } catch (e) {
      console.error('Erro ao ler sessão salva:', e);
    }
    return null;
  });

  const [activeClientTab, setActiveClientTab] = useState<'chat' | 'whatsapp' | 'flow' | 'integrations' | 'ai'>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSelectClientTab = (tab: 'chat' | 'whatsapp' | 'flow' | 'integrations' | 'ai') => {
    setActiveClientTab(tab);
    if (tab === 'flow') {
      setIsSidebarCollapsed(true);
    }
  };

  // Modals state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showManagePlanModal, setShowManagePlanModal] = useState(false);

  // Manage Plan Modal Cycle: 'monthly' | 'annual'
  const [manageCycle, setManageCycle] = useState<'monthly' | 'annual'>('monthly');

  // Activity tracking for 30-minute inactivity auto-logout
  useEffect(() => {
    if (!user) {
      localStorage.removeItem('nyxzap_user');
      localStorage.removeItem('nyxzap_last_active');
      return;
    }

    // Save session in localStorage
    localStorage.setItem('nyxzap_user', JSON.stringify(user));
    localStorage.setItem('nyxzap_last_active', Date.now().toString());

    const updateActivity = () => {
      localStorage.setItem('nyxzap_last_active', Date.now().toString());
    };

    const checkInactivity = () => {
      const lastActive = localStorage.getItem('nyxzap_last_active');
      if (lastActive) {
        const diffMinutes = (Date.now() - parseInt(lastActive, 10)) / (1000 * 60);
        if (diffMinutes >= 30) {
          handleLogout();
        }
      }
    };

    // User activity listeners
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Check inactivity every 30 seconds
    const interval = setInterval(checkInactivity, 30000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('nyxzap_user');
    localStorage.removeItem('nyxzap_last_active');
    setUser(null);
  };

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Support message state
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSuccess, setSupportSuccess] = useState(false);

  // Updates list
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/updates');
      const data = await res.json();
      setUpdates(data);
    } catch (err) {
      console.error('Erro ao buscar novidades:', err);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  // Calculate Subscription Days Remaining
  const getSubscriptionDetails = () => {
    if (!user || user.role === 'admin') {
      return { isExpired: false, daysRemaining: 999, label: 'Vitalício' };
    }

    const validUntilStr = user.validUntil || '2026-11-10';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = validUntilStr.split('-').map(Number);
    const targetDate = new Date(year, (month || 1) - 1, day || 1);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = daysRemaining < 0;

    return {
      isExpired,
      daysRemaining,
      validUntilStr
    };
  };

  const subInfo = getSubscriptionDetails();

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    setPasswordSuccess(true);
    setTimeout(() => {
      setPasswordSuccess(false);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 2000);
  };

  const handleSendSupport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSupportSuccess(true);
    setTimeout(() => {
      setSupportSuccess(false);
      setShowSupportModal(false);
      setSupportMessage('');
    }, 2500);
  };

  // If user is not logged in, render the AuthScreen
  if (!user) {
    return <AuthScreen onLogin={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  // If client subscription is expired, lock access and render RenewSubscriptionScreen
  if (user.role === 'client' && subInfo.isExpired) {
    return (
      <RenewSubscriptionScreen
        user={user}
        daysRemaining={subInfo.daysRemaining}
        onLogout={handleLogout}
        onSimulateRenewal={(newDate) => {
          setUser(prev => prev ? { ...prev, validUntil: newDate } : null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col md:flex-row font-sans">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={`transition-all duration-300 ease-in-out bg-[#0d0f18] border-r border-slate-800/80 flex flex-col justify-between shrink-0 z-40 ${
        isSidebarCollapsed ? 'w-0 hidden md:hidden overflow-hidden' : 'w-full md:w-64'
      }`}>
        {/* Brand Logo & Status */}
        <div>
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-purple-600/30">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold text-white tracking-tight">NyxZap</h1>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                    user.role === 'admin' 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                  }`}>
                    {user.role === 'admin' ? 'ADMIN' : 'CLIENTE'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                  {user.role === 'admin' ? 'SuperAdmin MRR' : (user.planName || 'Plano Pro')}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Validity Badge with Days Countdown */}
          {user.role === 'client' && (
            <div className="m-3 p-3.5 rounded-2xl bg-[#131622] border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>Validade da Licença</span>
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  subInfo.daysRemaining <= 3 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                    : subInfo.daysRemaining <= 7
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {subInfo.daysRemaining === 0 
                    ? 'Vence Hoje' 
                    : subInfo.daysRemaining === 1 
                    ? 'Falta 1 dia' 
                    : `Faltam ${subInfo.daysRemaining} dias`}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>Expira em:</span>
                <span className="text-white font-bold">{subInfo.validUntilStr}</span>
              </div>

              {/* Progress bar of validity / warning */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    subInfo.daysRemaining <= 3 ? 'bg-rose-500' : subInfo.daysRemaining <= 7 ? 'bg-amber-400' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(10, (subInfo.daysRemaining / 30) * 100))}%` }}
                />
              </div>

              {subInfo.daysRemaining <= 5 && (
                <button
                  onClick={() => setShowManagePlanModal(true)}
                  className="w-full mt-1 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-sm transition-all"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Renovar / Antecipar</span>
                </button>
              )}
            </div>
          )}

          {/* Client Left Navigation Menu Items */}
          {user.role === 'client' && (
            <nav className="p-3 space-y-1.5">
              <span className="px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                Módulos Principais
              </span>

              {/* 1. CHAT AO VIVO */}
              <button
                onClick={() => handleSelectClientTab('chat')}
                className={`w-full px-3.5 py-3 rounded-xl transition-all flex items-center justify-between text-xs font-bold ${
                  activeClientTab === 'chat'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat ao Vivo</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </button>

              {/* 2. CONEXÃO WHATSAPP */}
              <button
                onClick={() => handleSelectClientTab('whatsapp')}
                className={`w-full px-3.5 py-3 rounded-xl transition-all flex items-center justify-between text-xs font-bold ${
                  activeClientTab === 'whatsapp'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4" />
                  <span>Conexão WhatsApp</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 font-normal">
                  {user.instancesLimit || 1}x
                </span>
              </button>

              {/* 3. FLUXO */}
              <button
                onClick={() => handleSelectClientTab('flow')}
                className={`w-full px-3.5 py-3 rounded-xl transition-all flex items-center gap-3 text-xs font-bold ${
                  activeClientTab === 'flow'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Workflow className="w-4 h-4" />
                <span>Fluxo</span>
              </button>

              {/* CANAIS & INTEGRAÇÕES */}
              <button
                onClick={() => handleSelectClientTab('integrations')}
                className={`w-full px-3.5 py-3 rounded-xl transition-all flex items-center gap-3 text-xs font-bold ${
                  activeClientTab === 'integrations'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Canais & Integrações</span>
              </button>

              {/* 4. AGENTE DE IA */}
              <button
                onClick={() => handleSelectClientTab('ai')}
                className={`w-full px-3.5 py-3 rounded-xl transition-all flex items-center justify-between text-xs font-bold ${
                  activeClientTab === 'ai'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bot className="w-4 h-4" />
                  <span>Agente de IA</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                  Gemini
                </span>
              </button>
            </nav>
          )}
        </div>

        {/* Bottom Sidebar: Suporte, Novidades, Profile */}
        <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#0a0b12]">
          <div className="grid grid-cols-2 gap-1.5">
            {/* Suporte Button */}
            <button
              onClick={() => setShowSupportModal(true)}
              className="p-2.5 bg-[#131622] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Suporte</span>
            </button>

            {/* Novidades Button */}
            <button
              onClick={() => {
                fetchUpdates();
                setShowUpdatesModal(true);
              }}
              className="p-2.5 bg-[#131622] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors relative"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Novidades</span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            </button>
          </div>

          {/* User Profile Card */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#131622] hover:bg-slate-800 border border-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <span className="text-xs font-bold text-white block leading-tight truncate">{user.name}</span>
                <span className="text-[10px] text-purple-300 font-mono block leading-tight truncate">{user.planName || 'Plano Pro'}</span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#090a0f]">
        {/* Top bar for mobile or extra status */}
        <header className="border-b border-slate-800/80 bg-[#0d0f18]/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="p-1.5 sm:p-2 rounded-xl bg-[#131622] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all flex items-center gap-1.5 text-xs shadow-sm"
              title={isSidebarCollapsed ? "Expandir menu lateral" : "Retrair menu lateral (Tela cheia para fluxo)"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline text-[11px] font-semibold text-purple-300">Mostrar Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline text-[11px] font-semibold text-slate-400">Recolher Menu</span>
                </>
              )}
            </button>

            <h2 className="text-sm font-bold text-white capitalize">
              {user.role === 'admin' 
                ? 'Painel SuperAdmin' 
                : activeClientTab === 'chat' 
                ? 'Chat ao Vivo Multiatendentes' 
                : activeClientTab === 'whatsapp' 
                ? 'Gerenciamento de Instâncias WhatsApp' 
                : activeClientTab === 'flow' 
                ? 'Fluxo' 
                : activeClientTab === 'integrations'
                ? 'Canais & Integrações'
                : 'Configurações do Agente de IA'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {user.role === 'client' && (
              <div className="flex items-center gap-2 text-xs font-mono bg-[#131622] px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Validade:</span>
                <span className="text-white font-bold">{subInfo.validUntilStr}</span>
                <span className="text-slate-600">•</span>
                <span className={subInfo.daysRemaining <= 3 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {subInfo.daysRemaining === 0 ? 'Expira Hoje' : `${subInfo.daysRemaining}d restantes`}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Main View Container */}
        <main className={`flex-1 w-full ${
          activeClientTab === 'flow' 
            ? 'p-0 max-w-none h-[calc(100vh-57px)] overflow-hidden flex flex-col' 
            : 'p-6 max-w-7xl mx-auto overflow-y-auto'
        }`}>
          {user.role === 'admin' ? (
            <AdminDashboard />
          ) : (
            <div>
              {activeClientTab === 'chat' && <LiveChatManager />}
              {activeClientTab === 'whatsapp' && (
                <WhatsAppManager 
                  user={user} 
                  onUpdateUser={(updated) => setUser(prev => prev ? { ...prev, ...updated } : null)} 
                />
              )}
              {activeClientTab === 'flow' && <FlowBuilder />}
              {activeClientTab === 'integrations' && <ChannelsIntegrations user={user} />}
              {activeClientTab === 'ai' && <AIAgentManager />}
            </div>
          )}
        </main>
      </div>

      {/* 1. Modal de Suporte */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Central de Suporte NyxZap</h3>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {supportSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4" />
                <span>Ticket enviado com sucesso! Nossa equipe técnica entrará em contato via WhatsApp em minutos.</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#151824] border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white block">Atendimento Imediato via WhatsApp</span>
                <p className="text-xs text-slate-400">
                  Precisa de suporte urgente ou consultoria para seu fluxo de IA? Chame diretamente no WhatsApp oficial de plantão.
                </p>
                <a
                  href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20NyxZap"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md mt-2"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Abrir Conversa no WhatsApp</span>
                </a>
              </div>

              <form onSubmit={handleSendSupport} className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">Ou Abra um Chamado Técnico no Sistema</label>
                <textarea
                  rows={3}
                  placeholder="Descreva sua dúvida, solicitação ou problema técnico com detalhes..."
                  value={supportMessage}
                  onChange={e => setSupportMessage(e.target.value)}
                  required
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Chamado de Suporte</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Novidades e Atualizações */}
      {showUpdatesModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="text-lg font-extrabold text-white">Novidades & Atualizações do Sistema</h3>
                  <p className="text-xs text-slate-400">Acompanhe as últimas implementações e correções do NyxZap.</p>
                </div>
              </div>
              <button onClick={() => setShowUpdatesModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {updates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhuma atualização registrada até o momento.</p>
              ) : (
                updates.map(up => (
                  <div key={up.id} className="p-5 rounded-2xl bg-[#151824] border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-white bg-slate-800 px-2.5 py-1 rounded-md">
                          {up.version}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          up.type === 'correcao'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : up.type === 'implementacao'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {up.type === 'correcao' ? 'Correção de Bug' : up.type === 'implementacao' ? 'Nova Função' : 'Otimização'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{up.date}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{up.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {up.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowUpdatesModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal de Perfil do Usuário */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-3xl p-6 md:p-7 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-black text-white shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">{user.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                </div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Assinatura */}
            <div className="p-4 rounded-2xl bg-[#151824] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Plano Atual</span>
                <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                  {user.planName || 'Plano Pro'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Data da Licença / Validade</span>
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {user.validUntil || '2026-11-10'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Limite de Conexões WhatsApp</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {user.instancesLimit || 1} conexão(ões)
                </span>
              </div>
            </div>

            {/* Actions Menu */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowManagePlanModal(true);
                }}
                className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-between transition-colors border border-slate-800"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>Gerenciar Assinatura & Upgrades</span>
                </span>
                <span className="text-[10px] text-purple-400 font-bold uppercase">Alterar</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowPasswordModal(true);
                }}
                className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-between transition-colors border border-slate-800"
              >
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Trocar Senha de Acesso</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Editar</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileModal(false);
                  handleLogout();
                }}
                className="w-full p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sair da Conta (Logout)</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal de Trocar Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Trocar Senha</span>
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4" />
                <span>Senha alterada com sucesso!</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold animate-fadeIn">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Senha Atual</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nova Senha</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/30"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal de Gerenciar Assinatura / Renovar e Antecipar / Upgrade */}
      {showManagePlanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f111a] border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-extrabold text-white">
                  Renovar Assinatura ou Fazer Upgrade
                </h3>
              </div>
              <button onClick={() => setShowManagePlanModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Atual do Cliente */}
            <div className="p-4 rounded-2xl bg-[#151824] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Sua Assinatura Atual:</span>
                <span className="text-base font-black text-purple-300">
                  {user.planName || 'Plano Dinder'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Válida até <strong className="text-white font-mono">{user.validUntil || '2026-11-10'}</strong> ({subInfo.daysRemaining === 0 ? 'Vence Hoje' : `${subInfo.daysRemaining} dias restantes`})
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ● Status Ativo
                </span>
              </div>
            </div>

            {/* Seletor Mensal / Anual */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1.5 bg-[#12141f] p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setManageCycle('monthly')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    manageCycle === 'monthly'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setManageCycle('annual')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    manageCycle === 'annual'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Anual</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-black">
                    58% OFF
                  </span>
                </button>
              </div>
            </div>

            {/* OPÇÕES: 1. RENOVAR O PLANO ATUAL & 2. FAZER UPGRADE */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: Plano Dinder */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  (user.planName?.toLowerCase().includes('dinder') || !user.planName?.toLowerCase().includes('ia'))
                    ? 'bg-purple-950/20 border-purple-500/60 ring-1 ring-purple-500/40'
                    : 'bg-[#12141f] border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-sm font-black text-white">Plano Dinder</h4>
                      {(user.planName?.toLowerCase().includes('dinder') || !user.planName?.toLowerCase().includes('ia')) && (
                        <span className="text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                          SEU PLANO
                        </span>
                      )}
                    </div>
                    <div className="mb-2">
                      <span className="text-2xl font-black text-white">
                        {manageCycle === 'annual' ? 'R$ 397,00' : 'R$ 97,00'}
                      </span>
                      <span className="text-xs text-slate-400">/{manageCycle === 'annual' ? 'ano' : 'mês'}</span>
                      {manageCycle === 'annual' && (
                        <span className="block text-[11px] text-emerald-400 font-bold">58% de desconto no anual</span>
                      )}
                    </div>

                    <ul className="text-xs text-slate-300 space-y-1.5 my-3">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>1 conexão WhatsApp</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>CRM completo + Botzap</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Use sua IA (GPT, Gemini, Claude)</span>
                      </li>
                    </ul>
                  </div>

                  <a
                    href={manageCycle === 'annual' ? 'https://pay.cakto.com.br/693263v_1192152' : 'https://pay.cakto.com.br/w9d4ou9_1191931'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full mt-3 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all text-center"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{(user.planName?.toLowerCase().includes('dinder') || !user.planName?.toLowerCase().includes('ia')) ? 'Renovar Plano Atual' : 'Contratar Dinder'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* CARD 2: Plano Pro + IA ilimitada (UPGRADE) */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all relative ${
                  user.planName?.toLowerCase().includes('ia')
                    ? 'bg-indigo-950/20 border-indigo-500/60 ring-1 ring-indigo-500/40'
                    : 'bg-[#151828] border-2 border-indigo-500 shadow-xl shadow-indigo-600/20'
                }`}>
                  <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> UPGRADE RECOMENDADO
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-sm font-black text-white">Plano Pro + IA</h4>
                      {user.planName?.toLowerCase().includes('ia') && (
                        <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                          SEU PLANO
                        </span>
                      )}
                    </div>
                    <div className="mb-2">
                      <span className="text-2xl font-black text-white">
                        {manageCycle === 'annual' ? 'R$ 597,00' : 'R$ 147,00'}
                      </span>
                      <span className="text-xs text-slate-400">/{manageCycle === 'annual' ? 'ano' : 'mês'}</span>
                      {manageCycle === 'annual' && (
                        <span className="block text-[11px] text-emerald-400 font-bold">58% de desconto no anual</span>
                      )}
                    </div>

                    <ul className="text-xs text-slate-300 space-y-1.5 my-3">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Tudo do Dinder + IA Ilimitada</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Respostas Inteligentes Automáticas</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Suporte Prioritário VIP 24/7</span>
                      </li>
                    </ul>
                  </div>

                  <a
                    href={manageCycle === 'annual' ? 'https://pay.cakto.com.br/3764ipv_1192156' : 'https://pay.cakto.com.br/87jcu5r_1192138'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all text-center"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{user.planName?.toLowerCase().includes('ia') ? 'Renovar Plano Atual' : 'Fazer Upgrade para Pro + IA'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
              <span className="text-xs text-slate-400">
                Pagamento 100% seguro processado via Cakto.
              </span>
              <button
                type="button"
                onClick={() => setShowManagePlanModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

