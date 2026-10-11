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

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0f111a]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-purple-600/30">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight">NyxZap</h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                user.role === 'admin' 
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              }`}>
                {user.role === 'admin' ? 'PAINEL SUPERADMIN' : 'PAINEL DO CLIENTE'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {user.role === 'admin' 
                ? 'Gestão de Planos, Assinaturas e MRR' 
                : `${user.planName || 'Plano Pro'} • Válido até ${user.validUntil || '2026-11-10'}`}
            </p>
          </div>
        </div>

        {/* Client Navigation Tabs */}
        {user.role === 'client' && (
          <div className="flex items-center gap-1 bg-[#151824] p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {/* 1. CHAT AO VIVO */}
            <button
              onClick={() => setActiveClientTab('chat')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeClientTab === 'chat'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat ao Vivo</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </button>

            {/* 2. WHATSAPP */}
            <button
              onClick={() => setActiveClientTab('whatsapp')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeClientTab === 'whatsapp'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Conexão WhatsApp</span>
            </button>

            {/* 3. FLUXO DRAG-AND-DROP */}
            <button
              onClick={() => setActiveClientTab('flow')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeClientTab === 'flow'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Fluxo Drag-and-Drop</span>
            </button>

            {/* 4. AGENTE DE IA */}
            <button
              onClick={() => setActiveClientTab('ai')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeClientTab === 'ai'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Agente de IA</span>
            </button>
          </div>
        )}

        {/* Right Header Controls: Suporte, Novidades, Profile Dropdown */}
        <div className="flex items-center gap-3">
          {/* Suporte Button */}
          <button
            onClick={() => setShowSupportModal(true)}
            className="px-3 py-1.5 bg-[#151824] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
            className="px-3 py-1.5 bg-[#151824] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors relative"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Novidades</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          </button>

          {/* Clickable User Profile Button */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 p-1.5 pl-3 rounded-xl bg-[#151824] hover:bg-slate-800 border border-slate-800 transition-colors text-left"
          >
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-white block leading-tight">{user.name}</span>
              <span className="text-[10px] text-purple-300 font-mono block leading-tight">{user.planName || 'Plano Pro'}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
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

