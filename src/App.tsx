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
  Check
} from 'lucide-react';
import { UserAuth, SystemUpdate } from './types';
import { AuthScreen } from './components/AuthScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { WhatsAppManager } from './components/WhatsAppManager';
import { AIAgentManager } from './components/AIAgentManager';
import { FlowBuilder } from './components/FlowBuilder';
import { LiveChatManager } from './components/LiveChatManager';
import { RenewSubscriptionScreen } from './components/RenewSubscriptionScreen';

export function App() {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [activeClientTab, setActiveClientTab] = useState<'chat' | 'whatsapp' | 'flow' | 'ai'>('chat');

  // Modals state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showManagePlanModal, setShowManagePlanModal] = useState(false);

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
        onLogout={() => setUser(null)}
        onSimulateRenewal={(newDate) => {
          setUser(prev => prev ? { ...prev, validUntil: newDate } : null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col md:flex-row font-sans">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-[#0d0f18] border-r border-slate-800/80 flex flex-col justify-between shrink-0 z-40">
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
                onClick={() => setActiveClientTab('chat')}
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
                onClick={() => setActiveClientTab('whatsapp')}
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

              {/* 3. FLUXO DRAG-AND-DROP */}
              <button
                onClick={() => setActiveClientTab('flow')}
                className={`w-full px-3.5 py-3 rounded-xl transition-all flex items-center gap-3 text-xs font-bold ${
                  activeClientTab === 'flow'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Workflow className="w-4 h-4" />
                <span>Fluxo Drag-and-Drop</span>
              </button>

              {/* 4. AGENTE DE IA */}
              <button
                onClick={() => setActiveClientTab('ai')}
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
        <header className="border-b border-slate-800/80 bg-[#0d0f18]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white capitalize">
              {user.role === 'admin' 
                ? 'Painel SuperAdmin' 
                : activeClientTab === 'chat' 
                ? 'Chat ao Vivo Multiatendentes' 
                : activeClientTab === 'whatsapp' 
                ? 'Gerenciamento de Instâncias WhatsApp' 
                : activeClientTab === 'flow' 
                ? 'Construtor de Fluxo Drag-and-Drop' 
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
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto overflow-y-auto">
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
                  setUser(null);
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

      {/* 5. Modal de Gerenciar Assinatura */}
      {showManagePlanModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <span>Gerenciar Assinatura NyxZap</span>
              </h3>
              <button onClick={() => setShowManagePlanModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#151824] border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400">Status da sua Assinatura</span>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">● Ativa</span> — {user.planName || 'Plano Pro'}
              </div>
              <p className="text-xs text-slate-400">
                Sua licença renova automaticamente em <span className="text-white font-semibold">{user.validUntil || '10/11/2026'}</span>.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">Opções da Conta:</span>
              <button
                onClick={() => {
                  alert('Sua fatura foi enviada para ' + user.email);
                }}
                className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold text-left transition-colors flex items-center justify-between"
              >
                <span>Baixar 2ª via da Fatura / Recibo</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  alert('Solicitação de cancelamento aberta. Nossa equipe entrará em contato.');
                }}
                className="w-full p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold text-left transition-colors"
              >
                Cancelar Renovação Automática
              </button>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowManagePlanModal(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

