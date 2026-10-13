import React, { useState, useEffect } from 'react';
import { Subscriber, Plan, SystemUpdate } from '../types';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Plus, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Bell, 
  Send, 
  CheckCircle2, 
  Tag,
  Sparkles,
  Layers,
  Edit2,
  Trash2,
  Pause,
  Play,
  Activity,
  CreditCard,
  ExternalLink,
  Search,
  Check,
  X,
  Lock,
  Globe
} from 'lucide-react';
import { trackEvent } from '../lib/telemetry';
import { confirmDialog, alertDialog } from './ModalConfirm';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'subscribers' | 'updates' | 'telemetry' | 'cakto'>('subscribers');

  // Subscribers and Plans from PostgreSQL
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // New Client Modal
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('123456');
  const [newClientPhone, setNewClientPhone] = useState('+55 11 99999-9999');
  const [newClientPlan, setNewClientPlan] = useState('p_dinder');
  const [newClientInstances, setNewClientInstances] = useState(1);
  const [newClientMRR, setNewClientMRR] = useState('97.00');
  const [newClientValidUntil, setNewClientValidUntil] = useState('2026-11-10');
  const [clientModalError, setClientModalError] = useState('');

  // Edit Client Modal
  const [editingClient, setEditingClient] = useState<Subscriber | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlanId, setEditPlanId] = useState('');
  const [editPlanName, setEditPlanName] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'pending' | 'expired' | 'canceled'>('active');
  const [editMRR, setEditMRR] = useState(0);
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editInstancesLimit, setEditInstancesLimit] = useState(1);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  // System updates state
  const [updates, setUpdates] = useState<any[]>([]);
  const [newVersion, setNewVersion] = useState('v2.2.0');
  const [newType, setNewType] = useState<'correcao' | 'implementacao' | 'melhoria'>('implementacao');
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newDate, setNewDate] = useState(new Date().toLocaleDateString('pt-BR'));
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit Update Modal
  const [editingUpdate, setEditingUpdate] = useState<any | null>(null);

  // Telemetry events (PostHog)
  const [telemetryEvents, setTelemetryEvents] = useState<any[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  // Cakto Configuration
  const [caktoClientId, setCaktoClientId] = useState('1tyOaWA3KmZDn87nHzJYQksvEBANLiiV7Zx1uLeo');
  const [caktoClientSecret, setCaktoClientSecret] = useState('');
  const [caktoLinks, setCaktoLinks] = useState({
    tier_1: 'https://pay.cakto.com.br/nyxzap-extra-1',
    tier_2: 'https://pay.cakto.com.br/nyxzap-extra-2',
    tier_3: 'https://pay.cakto.com.br/nyxzap-extra-3',
    tier_5: 'https://pay.cakto.com.br/nyxzap-extra-5',
    plan_p1: 'https://pay.cakto.com.br/nyxzap-start',
    plan_p2: 'https://pay.cakto.com.br/nyxzap-pro',
    plan_p3: 'https://pay.cakto.com.br/nyxzap-enterprise'
  });
  const [caktoSaved, setCaktoSaved] = useState(false);

  const fetchSubscribers = async () => {
    setLoadingSubs(true);
    try {
      const res = await fetch('/api/admin/subscribers');
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data);
      }
    } catch (err) {
      console.error('Erro ao buscar assinantes:', err);
    } finally {
      setLoadingSubs(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err) {
      console.error('Erro ao buscar planos:', err);
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/updates');
      const data = await res.json();
      setUpdates(data);
    } catch (err) {
      console.error('Erro ao buscar novidades:', err);
    }
  };

  const fetchTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const res = await fetch('/api/admin/telemetry');
      if (res.ok) {
        const data = await res.json();
        setTelemetryEvents(data);
      }
    } catch (err) {
      console.error('Erro ao buscar telemetria:', err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const fetchCaktoConfig = async () => {
    try {
      const res = await fetch('/api/cakto/config');
      if (res.ok) {
        const data = await res.json();
        if (data.clientId) setCaktoClientId(data.clientId);
        if (data.checkoutLinks) setCaktoLinks(data.checkoutLinks);
      }
    } catch (err) {
      console.error('Erro ao buscar config Cakto:', err);
    }
  };

  useEffect(() => {
    fetchSubscribers();
    fetchPlans();
    fetchUpdates();
    fetchTelemetry();
    fetchCaktoConfig();
  }, []);

  // CRUD Subscribers
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientModalError('');
    if (!newClientName || !newClientEmail) {
      setClientModalError('Preencha o nome e o e-mail do cliente.');
      return;
    }

    try {
      const selectedPlanObj = plans.find(p => p.id === newClientPlan);
      const res = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          email: newClientEmail,
          password: newClientPassword,
          phone: newClientPhone,
          planId: newClientPlan,
          planName: selectedPlanObj?.name || 'Pro',
          instancesLimit: newClientInstances,
          mrrValue: parseFloat(newClientMRR) || 197.00,
          validUntil: newClientValidUntil,
          status: 'active'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao cadastrar cliente.');
      }

      setShowNewClientModal(false);
      setNewClientName('');
      setNewClientEmail('');
      await fetchSubscribers();
    } catch (err: any) {
      setClientModalError(err.message);
    }
  };

  const handleOpenEditClient = (sub: Subscriber) => {
    setEditingClient(sub);
    setEditError('');
    setEditSuccess(false);
    setEditName(sub.name || '');
    setEditEmail(sub.email || '');
    setEditPhone(sub.phone || '');
    setEditPlanId(sub.planId || 'p1');
    setEditPlanName(sub.planName || 'Plano Pro');
    setEditStatus(sub.status || 'active');
    setEditMRR(sub.mrrValue || 97.00);
    
    // Normalize date to YYYY-MM-DD
    let formattedDate = sub.validUntil || '2026-11-10';
    if (formattedDate.includes('/')) {
      const parts = formattedDate.split('/');
      if (parts.length === 3) {
        // DD/MM/YYYY -> YYYY-MM-DD
        formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    setEditValidUntil(formattedDate);
    setEditInstancesLimit(sub.instancesLimit || 1);
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setEditError('');
    setEditLoading(true);

    try {
      // Ensure date is valid YYYY-MM-DD
      let finalDate = editValidUntil;
      if (finalDate.includes('/')) {
        const parts = finalDate.split('/');
        if (parts.length === 3) {
          finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const res = await fetch(`/api/admin/subscribers/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          planId: editPlanId,
          planName: editPlanName,
          status: editStatus,
          mrrValue: Number(editMRR) || 0,
          validUntil: finalDate,
          instancesLimit: Number(editInstancesLimit) || 1
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar alterações do cliente.');
      }

      setEditSuccess(true);
      await fetchSubscribers();
      setTimeout(() => {
        setEditSuccess(false);
        setEditingClient(null);
      }, 1200);
    } catch (err: any) {
      console.error('Erro ao editar cliente:', err);
      setEditError(err.message || 'Erro de comunicação ao salvar.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Assinante',
      message: `Tem certeza que deseja apagar o cliente "${name}" permanentemente do banco de dados? O acesso do usuário será revogado.`,
      variant: 'danger',
      confirmText: 'Sim, Apagar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchSubscribers();
      }
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
    }
  };

  const handleRenewSubscriber = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/subscribers/${id}/renew`, { method: 'POST' });
      if (res.ok) {
        await fetchSubscribers();
      }
    } catch (err) {
      console.error('Erro ao renovar:', err);
    }
  };

  // CRUD Updates
  const handleCreateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion || !newTitle || !newMessage) return;

    try {
      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: newVersion,
          type: newType,
          title: newTitle,
          message: newMessage,
          date: newDate
        })
      });

      if (res.ok) {
        setNewTitle('');
        setNewMessage('');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await fetchUpdates();
      }
    } catch (err) {
      console.error('Erro ao cadastrar novidade:', err);
    }
  };

  const handleTogglePauseUpdate = async (up: any) => {
    const newStatus = up.status === 'paused' ? 'active' : 'paused';
    try {
      await fetch(`/api/updates/${up.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      await fetchUpdates();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Atualização do Sistema',
      message: 'Deseja realmente excluir esta publicação do histórico de novidades?',
      variant: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;
    try {
      await fetch(`/api/updates/${id}`, { method: 'DELETE' });
      await fetchUpdates();
    } catch (err) {
      console.error('Erro ao excluir novidade:', err);
    }
  };

  const handleSaveEditUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUpdate) return;
    try {
      await fetch(`/api/updates/${editingUpdate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUpdate)
      });
      setEditingUpdate(null);
      await fetchUpdates();
    } catch (err) {
      console.error('Erro ao atualizar novidade:', err);
    }
  };

  // Save Cakto Config
  const handleSaveCakto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cakto/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: caktoClientId,
          clientSecret: caktoClientSecret,
          checkoutLinks: caktoLinks
        })
      });
      if (res.ok) {
        setCaktoSaved(true);
        setTimeout(() => setCaktoSaved(false), 3000);
      }
    } catch (err) {
      console.error('Erro ao salvar config Cakto:', err);
    }
  };

  const totalMRR = subscribers
    .filter(s => s.status === 'active')
    .reduce((acc, curr) => acc + curr.mrrValue, 0);

  const activeSubscribers = subscribers.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <span>Painel SuperAdmin</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de Clientes, Assinaturas, MRR, Telemetria & Integração Cakto.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#151824] p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => { setActiveTab('subscribers'); trackEvent('admin_tab_subscribers', 'admin'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'subscribers'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes & MRR</span>
          </button>

          <button
            onClick={() => { setActiveTab('updates'); trackEvent('admin_tab_updates', 'admin'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'updates'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Publicações</span>
          </button>

          <button
            onClick={() => { setActiveTab('telemetry'); fetchTelemetry(); trackEvent('admin_tab_telemetry', 'admin'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'telemetry'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Telemetria (PostHog)</span>
          </button>

          <button
            onClick={() => { setActiveTab('cakto'); trackEvent('admin_tab_cakto', 'admin'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'cakto'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cakto MCP & Links</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>MRR Recorrente</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" /> +15.4% este mês
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Assinantes Ativos</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {activeSubscribers}
          </div>
          <div className="text-xs text-slate-400">
            {subscribers.length} cadastrados no PostgreSQL
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Eventos Rastreados</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {telemetryEvents.length}
          </div>
          <div className="text-xs text-slate-400">
            Auditoria PostHog ativa
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Integração Cakto</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            MCP Conectado
          </div>
          <div className="text-xs text-slate-400">
            mcp.cakto.com.br
          </div>
        </div>
      </div>

      {/* TAB 1: CLIENTES & ASSINANTES */}
      {activeTab === 'subscribers' && (
        <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Gestão de Clientes & Assinaturas</h3>
              <p className="text-xs text-slate-400">Adicione novos clientes, edite planos, altere limites e remova usuários.</p>
            </div>
            <button
              onClick={() => {
                setClientModalError('');
                setShowNewClientModal(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Cliente
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-nyx-850 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3">Valor / Mês</th>
                  <th className="p-3">Validade</th>
                  <th className="p-3">WhatsApp Conexões</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {subscribers.map(sub => (
                  <tr key={sub.id} className="hover:bg-nyx-850/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-white">{sub.name}</div>
                      <div className="text-[11px] text-slate-500">{sub.email}</div>
                    </td>
                    <td className="p-3 font-semibold text-purple-300">{sub.planName}</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      R$ {sub.mrrValue.toFixed(2)}
                    </td>
                    <td className="p-3 font-mono">
                      <span className={sub.status === 'expired' ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {sub.validUntil}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {sub.connectedInstances} / {sub.instancesLimit || 1}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        sub.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {sub.status === 'active' ? 'Ativo' : 'Expirado'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      <button 
                        onClick={() => handleRenewSubscriber(sub.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold transition-colors"
                        title="Renovar por mais 30 dias"
                      >
                        +30 Dias
                      </button>
                      <button
                        onClick={() => handleOpenEditClient(sub)}
                        className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(sub.id, sub.name)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PUBLICAÇÕES & NOVIDADES */}
      {activeTab === 'updates' && (
        <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <span>Publicações de Novidades & Atualizações</span>
              </h3>
              <p className="text-xs text-slate-400">
                Publique comunicados de sistema. Você pode parar, editar ou apagar qualquer publicação a qualquer momento.
              </p>
            </div>
            <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 font-bold">
              {updates.length} Registradas
            </span>
          </div>

          {saveSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Publicação realizada com sucesso no banco de dados!</span>
            </div>
          )}

          <form onSubmit={handleCreateUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Versão do Sistema</label>
                <input
                  type="text"
                  placeholder="Ex: v2.2.0"
                  value={newVersion}
                  onChange={e => setNewVersion(e.target.value)}
                  required
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Data</label>
                <input
                  type="text"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  required
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Tipo</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as any)}
                  className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="implementacao">✨ Implementação / Nova Função</option>
                  <option value="correcao">🐛 Correção de Bug</option>
                  <option value="melhoria">⚡ Otimização & Melhoria</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Título</label>
              <input
                type="text"
                placeholder="Ex: Nova integração com Cakto e Conexões WhatsApp Dinâmicas"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Mensagem</label>
              <textarea
                rows={3}
                placeholder="Descreva o que foi implementado ou ajustado..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                required
                className="w-full bg-[#151824] border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publicar Comunicado</span>
              </button>
            </div>
          </form>

          {/* Existing Updates List with Edit, Pause and Delete Actions */}
          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Histórico de Publicações Recentes</span>
            <div className="space-y-2">
              {updates.map(up => (
                <div key={up.id} className="p-4 rounded-xl bg-[#151824] border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                        {up.version}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        up.type === 'correcao'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : up.type === 'implementacao'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {up.type === 'correcao' ? 'Correção' : up.type === 'implementacao' ? 'Implementação' : 'Melhoria'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        up.status === 'paused'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {up.status === 'paused' ? 'Pausado (Invisível)' : 'Ativo'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{up.date}</span>
                      <span className="text-xs font-bold text-white">{up.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-1">
                      {up.message}
                    </p>
                  </div>

                  {/* Actions for Update: Pause, Edit, Delete */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePauseUpdate(up)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        up.status === 'paused'
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
                      }`}
                      title={up.status === 'paused' ? 'Retomar visualização' : 'Pausar (parar mensagem)'}
                    >
                      {up.status === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{up.status === 'paused' ? 'Retomar' : 'Parar'}</span>
                    </button>

                    <button
                      onClick={() => setEditingUpdate(up)}
                      className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                      title="Editar mensagem"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteUpdate(up.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                      title="Excluir mensagem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEMETRIA & ANALYTICS (POSTHOG) */}
      {activeTab === 'telemetry' && (
        <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <span>Auditoria & Telemetria em Tempo Real (Estilo PostHog)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhe o passo a passo de tudo que seus clientes e leads clicam, navegam e executam no NyxZap.
              </p>
            </div>
            <button
              onClick={fetchTelemetry}
              disabled={loadingTelemetry}
              className="px-3.5 py-1.5 bg-[#151824] hover:bg-slate-800 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTelemetry ? 'animate-spin' : ''}`} />
              <span>Atualizar Eventos</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-nyx-850 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Horário</th>
                  <th className="p-3">Ação / Evento</th>
                  <th className="p-3">Usuário / E-mail</th>
                  <th className="p-3">Tela / Aba</th>
                  <th className="p-3">IP de Origem</th>
                  <th className="p-3">Detalhes do Evento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {telemetryEvents.map(evt => (
                  <tr key={evt.id} className="hover:bg-nyx-850/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleTimeString()} - {new Date(evt.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded font-mono text-[11px]">
                        {evt.event_name}
                      </span>
                    </td>
                    <td className="p-3 text-purple-300">
                      {evt.user_email || 'Visitante Anônimo'}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold uppercase">
                        {evt.tab_name || 'Geral'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {evt.ip_address}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                      {typeof evt.details === 'object' ? JSON.stringify(evt.details) : evt.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INTEGRAÇÃO CAKTO MCP */}
      {activeTab === 'cakto' && (
        <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>Integração de Pagamentos Cakto MCP & Checkouts</span>
              </h3>
              <p className="text-xs text-slate-400">
                Conectado ao servidor MCP oficial da Cakto (https://mcp.cakto.com.br) para processamento de assinaturas e pacotes adicionais.
              </p>
            </div>
            <a
              href="https://docs.cakto.com.br/mcp/visao-geral"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Documentação MCP Cakto</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {caktoSaved && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Configurações da Cakto salvas e ativadas com sucesso!</span>
            </div>
          )}

          {/* WEBHOOK URL BANNER */}
          <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                URL Oficial do Webhook Cakto para Licenças SaaS do NyxZap
              </span>
              <code className="text-xs font-mono font-bold text-white bg-black/40 px-3 py-1.5 rounded-lg border border-slate-800 block select-all">
                https://zap.nyxzap.com.br/api/webhook/saas/cakto
              </code>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Esta URL é <strong>exclusiva para liberar e renovar assinaturas e conexões extras do próprio SaaS NyxZap</strong>. (Os funis dos seus clientes usam os webhooks da aba <em>Fluxos</em> / <em>Canais & Integrações</em>).
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText('https://zap.nyxzap.com.br/api/webhook/saas/cakto');
                await alertDialog({
                  title: 'URL Copiada!',
                  message: 'A URL do Webhook SaaS Cakto foi copiada com sucesso para sua área de transferência.',
                  variant: 'success',
                  confirmText: 'OK'
                });
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Copiar URL do Webhook SaaS</span>
            </button>
          </div>

          <form onSubmit={handleSaveCakto} className="space-y-6">
            <div className="p-4 rounded-xl bg-[#151824] border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Credenciais da Chave de API Cakto
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Client ID</label>
                  <input
                    type="text"
                    value={caktoClientId}
                    onChange={e => setCaktoClientId(e.target.value)}
                    className="w-full bg-nyx-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Client Secret</label>
                  <input
                    type="password"
                    placeholder="Cole a Secret se quiser atualizar"
                    value={caktoClientSecret}
                    onChange={e => setCaktoClientSecret(e.target.value)}
                    className="w-full bg-nyx-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#151824] border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                Links Diretos de Checkout para Conexões Extras de WhatsApp
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">+1 Conexão (R$ 39,90/mês)</label>
                  <input
                    type="text"
                    value={caktoLinks.tier_1}
                    onChange={e => setCaktoLinks({ ...caktoLinks, tier_1: e.target.value })}
                    className="w-full bg-nyx-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">+2 Conexões (R$ 69,80/mês)</label>
                  <input
                    type="text"
                    value={caktoLinks.tier_2}
                    onChange={e => setCaktoLinks({ ...caktoLinks, tier_2: e.target.value })}
                    className="w-full bg-nyx-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">+3 Conexões (R$ 89,70/mês - Mais Recomendado)</label>
                  <input
                    type="text"
                    value={caktoLinks.tier_3}
                    onChange={e => setCaktoLinks({ ...caktoLinks, tier_3: e.target.value })}
                    className="w-full bg-nyx-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">+5 Conexões (R$ 99,50/mês - Super Oferta)</label>
                  <input
                    type="text"
                    value={caktoLinks.tier_5}
                    onChange={e => setCaktoLinks({ ...caktoLinks, tier_5: e.target.value })}
                    className="w-full bg-nyx-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Configurações da Cakto</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Novo Cliente */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0f111a] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                <span>Cadastrar Novo Cliente</span>
              </h3>
              <button onClick={() => setShowNewClientModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {clientModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs">
                {clientModalError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Nome Completo / Empresa</label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Senha Provisória</label>
                  <input
                    type="password"
                    required
                    value={newClientPassword}
                    onChange={e => setNewClientPassword(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Telefone</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Plano Inicial</label>
                  <select
                    value={newClientPlan}
                    onChange={e => {
                      setNewClientPlan(e.target.value);
                      if (e.target.value === 'p_dinder') {
                        setNewClientInstances(1);
                        setNewClientMRR('97.00');
                      } else {
                        setNewClientInstances(1);
                        setNewClientMRR('147.00');
                      }
                    }}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="p_dinder">Plano Dinder (1 Conexão - R$ 97/mês)</option>
                    <option value="p_pro_ia">Plano Pro + IA ilimitada (1 Conexão - R$ 147/mês)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Limite Conexões WhatsApp</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newClientInstances}
                    onChange={e => setNewClientInstances(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Valor MRR (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newClientMRR}
                    onChange={e => setNewClientMRR(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Data de Validade</label>
                  <input
                    type="date"
                    value={newClientValidUntil}
                    onChange={e => setNewClientValidUntil(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  Criar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Cliente */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0f111a] border border-slate-800 rounded-3xl p-6 md:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>Editar Cliente: {editingClient.name}</span>
              </h3>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SEÇÃO: PLANO ATUAL & OPÇÕES DE UPGRADE */}
            <div className="p-4 rounded-2xl bg-[#151824] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Plano Atual do Cliente:</span>
                  <span className="text-sm font-black text-purple-300">
                    {editPlanName || editingClient.planName || 'Plano Personalizado'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Valor Mensal:</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    R$ {Number(editMRR).toFixed(2)}/mês
                  </span>
                </div>
              </div>

              {/* Cards de Opção de Upgrade de Plano */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Selecione para mudar ou fazer Upgrade de Plano:</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Plano 1: Plano Dinder (97/mês) */}
                  <div
                    onClick={() => {
                      setEditPlanId('p_dinder');
                      setEditPlanName('Plano Dinder');
                      setEditMRR(97.00);
                      setEditInstancesLimit(1);
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      editPlanName === 'Plano Dinder' || editPlanId === 'p_dinder'
                        ? 'bg-purple-600/15 border-purple-500 shadow-md shadow-purple-600/20'
                        : 'bg-[#10121d] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-white">Plano Dinder</span>
                      <span className="text-xs font-mono font-black text-emerald-400">R$ 97/mês</span>
                    </div>
                    <span className="text-[10px] text-purple-400 font-semibold block mb-2">Sem fidelidade</span>

                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>1 conexão WhatsApp incluída</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Sistema CRM completo</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Integração com WhatsApp + Botzap</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Use sua IA: GPT, Gemini ou Claude com a sua API</span>
                      </li>
                    </ul>

                    {(editPlanName === 'Plano Dinder' || editPlanId === 'p_dinder') && (
                      <div className="mt-2.5 pt-2 border-t border-purple-500/30 text-[10px] text-purple-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-purple-400" /> Selecionado para este cliente
                      </div>
                    )}
                  </div>

                  {/* Plano 2: Plano Pro com IA (147/mês) */}
                  <div
                    onClick={() => {
                      setEditPlanId('p_pro_ia');
                      setEditPlanName('Plano Pro com IA');
                      setEditMRR(147.00);
                      setEditInstancesLimit(1);
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      editPlanName === 'Plano Pro com IA' || editPlanId === 'p_pro_ia'
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-[#10121d] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">Plano Pro com IA</span>
                        <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-bold">UPGRADE</span>
                      </div>
                      <span className="text-xs font-mono font-black text-emerald-400">R$ 147/mês</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-semibold block mb-2">Sem fidelidade • IA Ilimitada</span>

                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Tudo do plano Dinder + IA ilimitada incluída</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>1 conexão WhatsApp incluída</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>CRM completo + IA integrada</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Mensagens com IA ilimitadas</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Respostas automáticas inteligentes</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Suporte prioritário 24/7</span>
                      </li>
                    </ul>

                    {(editPlanName === 'Plano Pro com IA' || editPlanId === 'p_pro_ia') && (
                      <div className="mt-2.5 pt-2 border-t border-indigo-500/30 text-[10px] text-indigo-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" /> Selecionado para este cliente
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveEditClient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Nome</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Telefone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="active">Ativo (Acesso Liberado)</option>
                    <option value="expired">Expirado (Bloqueado)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Limite Conexões</label>
                  <input
                    type="number"
                    min={1}
                    value={editInstancesLimit}
                    onChange={e => setEditInstancesLimit(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Valor MRR (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMRR}
                    onChange={e => setEditMRR(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                {/* Data de Validade com Seletor de Calendário Nativo e Atalhos */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>Data de Validade (Clique para abrir o calendário)</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 30);
                          setEditValidUntil(d.toISOString().split('T')[0]);
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-colors"
                      >
                        +30 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 365);
                          setEditValidUntil(d.toISOString().split('T')[0]);
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-colors"
                      >
                        +1 Ano
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    required
                    value={editValidUntil}
                    onChange={e => setEditValidUntil(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Alterações salvas com sucesso no banco de dados!</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  disabled={editLoading}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                >
                  {editLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Publicação */}
      {editingUpdate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0f111a] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>Editar Publicação: {editingUpdate.title}</span>
              </h3>
              <button onClick={() => setEditingUpdate(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUpdate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Título</label>
                <input
                  type="text"
                  value={editingUpdate.title}
                  onChange={e => setEditingUpdate({ ...editingUpdate, title: e.target.value })}
                  className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mensagem</label>
                <textarea
                  rows={4}
                  value={editingUpdate.message}
                  onChange={e => setEditingUpdate({ ...editingUpdate, message: e.target.value })}
                  className="w-full bg-[#151824] border border-slate-700 rounded-xl p-3 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUpdate(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
