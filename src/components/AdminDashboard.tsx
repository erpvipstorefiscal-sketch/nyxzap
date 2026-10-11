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
  Layers
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([
    {
      id: 'p1',
      name: 'Start',
      price: 97.00,
      period: 'mensal',
      instancesLimit: 1,
      aiCreditsLimit: 1000,
      features: ['1 Conexão WhatsApp', 'Agente IA Básico', 'Suporte']
    },
    {
      id: 'p2',
      name: 'Pro (Mais Vendido)',
      price: 197.00,
      period: 'mensal',
      instancesLimit: 3,
      aiCreditsLimit: 5000,
      features: ['3 Conexões WhatsApp', 'Gemini 3 Grounding & Raciocínio', 'Fluxo Drag-and-Drop']
    },
    {
      id: 'p3',
      name: 'Enterprise Anual',
      price: 1490.00,
      period: 'anual',
      instancesLimit: 10,
      aiCreditsLimit: 50000,
      features: ['10 Conexões WhatsApp', 'RAG Ilimitado', 'Atendimento Humano Prioritário']
    }
  ]);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([
    {
      id: 'sub-1',
      name: 'Carlos Mendes',
      email: 'carlos@empresa.com.br',
      phone: '+55 11 98765-4321',
      planId: 'p2',
      planName: 'Pro',
      status: 'active',
      mrrValue: 197.00,
      validUntil: '2026-11-10',
      connectedInstances: 2,
      createdAt: '2026-10-10'
    },
    {
      id: 'sub-2',
      name: 'Mariana Silveira',
      email: 'mariana@agenciadigital.com',
      phone: '+55 21 99887-1122',
      planId: 'p3',
      planName: 'Enterprise Anual',
      status: 'active',
      mrrValue: 124.16,
      validUntil: '2027-10-10',
      connectedInstances: 5,
      createdAt: '2026-10-09'
    },
    {
      id: 'sub-3',
      name: 'Lucas Ferreira',
      email: 'lucas@comercio.com',
      phone: '+55 31 97654-3210',
      planId: 'p1',
      planName: 'Start',
      status: 'expired',
      mrrValue: 97.00,
      validUntil: '2026-10-05',
      connectedInstances: 0,
      createdAt: '2026-09-05'
    }
  ]);

  // System updates state
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [newVersion, setNewVersion] = useState('v2.2.0');
  const [newType, setNewType] = useState<'correcao' | 'implementacao' | 'melhoria'>('implementacao');
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newDate, setNewDate] = useState(new Date().toLocaleDateString('pt-BR'));
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const totalMRR = subscribers
    .filter(s => s.status === 'active')
    .reduce((acc, curr) => acc + curr.mrrValue, 0);

  const activeSubscribers = subscribers.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-purple-400" />
          <span>Painel Administrativo do Sistema</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Controle central de faturamento, MRR, planos de assinatura, validade de clientes e comunicados de novidades.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>MRR (Receita Recorrente)</span>
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
            {subscribers.length} cadastrados no total
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Planos Cadastrados</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {plans.length}
          </div>
          <div className="text-xs text-slate-400">
            Start, Pro e Enterprise
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Status da Operação</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            100% Online
          </div>
          <div className="text-xs text-slate-400">
            VPS HostMF • Canadá
          </div>
        </div>
      </div>

      {/* Cadastrar Novidades e Atualizações do Sistema */}
      <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              <span>Cadastrar Novidades & Atualizações do Sistema</span>
            </h3>
            <p className="text-xs text-slate-400">
              Publique correções, novas funcionalidades e versões para todos os usuários do sistema visualizarem.
            </p>
          </div>
          <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 font-bold">
            {updates.length} Registradas
          </span>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            <span>Atualização publicada com sucesso! Ela já está visível para os clientes no botão "Novidades".</span>
          </div>
        )}

        <form onSubmit={handleCreateUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Versão do Sistema Atual</label>
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Data da Atualização</label>
              <input
                type="text"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                required
                className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Tipo de Atualização</label>
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
            <label className="text-xs font-semibold text-slate-300 block mb-1">Título do Comunicado</label>
            <input
              type="text"
              placeholder="Ex: Lançamento de Conexões Múltiplas e Chat ao Vivo Dedicado"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              required
              className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Mensagem Detalhada da Atualização</label>
            <textarea
              rows={3}
              placeholder="Descreva detalhadamente o que foi corrigido ou implementado nesta versão..."
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
              <span>Publicar Novidade para Clientes</span>
            </button>
          </div>
        </form>

        {/* Existing Updates List */}
        <div className="border-t border-slate-800/80 pt-4 space-y-3">
          <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Histórico de Publicações Recentes</span>
          <div className="space-y-2">
            {updates.map(up => (
              <div key={up.id} className="p-4 rounded-xl bg-[#151824] border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
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
                    <span className="text-[11px] text-slate-400 font-mono">{up.date}</span>
                    <span className="text-xs font-bold text-white">{up.title}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pl-1">
                    {up.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Clientes & Validades de Acesso</h3>
            <p className="text-xs text-slate-400">Gerencie vencimentos e bloqueio automático de inadimplentes.</p>
          </div>
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-1.5">
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
                <th className="p-3">WhatsApp Ativos</th>
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
                      {sub.connectedInstances} conexões
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
                  <td className="p-3 text-right space-x-2">
                    <button 
                      onClick={() => {
                        setSubscribers(subscribers.map(s => s.id === sub.id ? { ...s, validUntil: '2026-12-10', status: 'active' } : s));
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      +30 Dias
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
