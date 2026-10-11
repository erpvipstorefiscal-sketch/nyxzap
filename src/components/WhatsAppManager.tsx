import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Layers, 
  Check, 
  CreditCard,
  X,
  Edit2,
  ExternalLink
} from 'lucide-react';
import { WhatsAppSession, UserAuth } from '../types';
import { trackEvent } from '../lib/telemetry';

interface WhatsAppManagerProps {
  user?: UserAuth;
  onUpdateUser?: (updated: Partial<UserAuth>) => void;
}

export const WhatsAppManager: React.FC<WhatsAppManagerProps> = ({ user, onUpdateUser }) => {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Instance rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const currentLimit = user?.instancesLimit || 1;

  // Plan extra connections packages
  const connectionTiers = [
    {
      connections: 1,
      totalPrice: '39,90',
      unitPrice: '39,90',
      badge: 'Básico',
      highlight: false,
      desc: 'Ideal para ter um segundo número de contingência ou setor exclusivo.'
    },
    {
      connections: 2,
      totalPrice: '69,80',
      unitPrice: '34,90',
      badge: 'Popular',
      highlight: false,
      desc: 'Economize por conexão e expanda para 2 atendentes ou bots.'
    },
    {
      connections: 3,
      totalPrice: '89,70',
      unitPrice: '29,90',
      badge: 'Mais Recomendado',
      highlight: true,
      desc: 'Melhor custo-benefício para equipes em escala acelerada.'
    },
    {
      connections: 5,
      totalPrice: '99,50',
      unitPrice: '19,90',
      badge: 'Super Oferta',
      highlight: false,
      desc: 'Máxima economia! Apenas R$ 19,90 por mês por cada conexão.'
    }
  ];

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Erro ao buscar sessões:', err);
    }
  };

  useEffect(() => {
    fetchSessions();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      try {
        const { type } = JSON.parse(event.data);
        if (type === 'session_update' || type === 'session_qr') {
          fetchSessions();
        }
      } catch (err) {
        console.error(err);
      }
    };

    const interval = setInterval(fetchSessions, 4000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const handleConnect = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`/api/sessions/${id}/connect`, { method: 'POST' });
      await fetchSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}/disconnect`, { method: 'POST' });
      await fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    try {
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName.trim() })
      });
      if (res.ok) {
        setNewSessionName('');
        setShowNewModal(false);
        await fetchSessions();
      }
    } catch (err) {
      console.error('Erro ao criar sessão:', err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Deseja realmente remover esta conexão de WhatsApp?')) return;
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      await fetchSessions();
    } catch (err) {
      console.error('Erro ao excluir sessão:', err);
    }
  };

  const handleSaveRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`/api/sessions/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() })
      });
      if (res.ok) {
        setRenamingId(null);
        await fetchSessions();
        trackEvent('whatsapp_instance_renamed', 'whatsapp_manager', { id, newName: renameValue.trim() });
      }
    } catch (err) {
      console.error('Erro ao renomear sessão:', err);
    }
  };

  const handleBuyTier = async (connections: number) => {
    trackEvent('cakto_checkout_requested', 'whatsapp_manager', { connections });
    try {
      const res = await fetch('/api/cakto/checkout-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'tier', itemId: String(connections) })
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      }
    } catch (err) {
      console.error('Erro ao buscar link Cakto:', err);
    }

    setSuccessMsg(`Abrindo checkout da Cakto para +${connections} conexão(ões). A liberação ocorrerá automaticamente assim que o pagamento for confirmado!`);
    setTimeout(() => {
      setSuccessMsg('');
      setShowBuyModal(false);
    }, 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Plan Limit Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-nyx-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-400" />
            <span>Conexões de WhatsApp</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Conecte seus números para rodar Agentes de IA simultâneos e fluxos visuais automáticos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Plan Limit Badge */}
          <div className="bg-[#151824] border border-slate-800 px-4 py-2.5 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
              Limite do seu Plano
            </span>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span className={`font-mono ${sessions.length >= currentLimit ? 'text-amber-400 font-extrabold' : 'text-emerald-400'}`}>
                {sessions.length} / {currentLimit}
              </span>
              <span className="text-xs text-slate-400 font-normal">números ativos</span>
            </div>
          </div>

          {/* Add Connection or Upgrade Button */}
          {sessions.length < currentLimit ? (
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar WhatsApp</span>
            </button>
          ) : (
            <button
              onClick={() => setShowBuyModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Contratar Conexões Extras</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of WhatsApp Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sessions.map(session => (
          <div key={session.id} className="p-6 rounded-2xl bg-nyx-900 border border-slate-800 shadow-xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex-1 mr-2">
                {renamingId === session.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Nome da instância"
                      className="bg-[#151824] border border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none font-semibold w-full max-w-[180px]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(session.id)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{session.name}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(session.id);
                        setRenameValue(session.name);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                      title="Mudar nome da conexão"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <span className="text-xs text-slate-400 font-mono">ID: {session.id}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  session.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : session.status === 'connecting'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {session.status === 'connected' && <><Wifi className="w-3.5 h-3.5" /> Conectado</>}
                  {session.status === 'connecting' && <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Gerando QR...</>}
                  {session.status === 'disconnected' && <><WifiOff className="w-3.5 h-3.5" /> Desconectado</>}
                </span>

                {/* Delete Session Button (if more than 1 or disconnected) */}
                {sessions.length > 1 && (
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                    title="Remover conexão"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* QR Code Container */}
            {session.status === 'connecting' && session.qrCode ? (
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl space-y-3">
                <img src={session.qrCode} alt="WhatsApp QR Code" className="w-56 h-56 rounded-lg" />
                <p className="text-xs text-slate-800 font-bold text-center">
                  Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar um aparelho
                </p>
              </div>
            ) : session.status === 'connected' ? (
              <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Sessão Ativa e Pronta</h4>
                <p className="text-xs text-slate-300">
                  Número: <span className="font-mono text-emerald-400 font-bold">{session.phone || 'Ativo'}</span>
                </p>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-nyx-850 border border-dashed border-slate-800 text-center space-y-3">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Clique no botão abaixo para gerar o QR Code oficial de pareamento.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {session.status === 'disconnected' ? (
                <button
                  onClick={() => handleConnect(session.id)}
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Conectar WhatsApp</span>
                </button>
              ) : (
                <button
                  onClick={() => handleDisconnect(session.id)}
                  className="flex-1 py-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <WifiOff className="w-4 h-4" />
                  <span>Desconectar Sessão</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New Session Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <span>Nova Conexão de WhatsApp</span>
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">Identificação do Número</label>
              <input
                type="text"
                placeholder="Ex: Suporte Nível 2 / Vendas São Paulo"
                value={newSessionName}
                onChange={e => setNewSessionName(e.target.value)}
                className="w-full bg-[#151824] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400">
                Após cadastrar, você poderá escanear o QR Code deste número e atribuí-lo a um bot ou atendente.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSessionName.trim()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30"
              >
                Criar Conexão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Additional Connections Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-nyx-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
                  Upgrade & Expansão
                </span>
                <h3 className="text-xl md:text-2xl font-extrabold text-white mt-2 flex items-center gap-2">
                  <Layers className="w-6 h-6 text-purple-400" />
                  <span>Adicionar Conexões Extras de WhatsApp</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Aumente a capacidade de atendimento da sua empresa sem precisar mudar todo o plano.
                </p>
              </div>
              <button onClick={() => setShowBuyModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            {successMsg && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse">
                <Check className="w-5 h-5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Pricing Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectionTiers.map((tier, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedTier(idx)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                    tier.highlight
                      ? 'bg-purple-950/20 border-purple-500/50 shadow-lg shadow-purple-600/10'
                      : 'bg-nyx-850 border-slate-800 hover:border-slate-700'
                  } ${selectedTier === idx ? 'ring-2 ring-purple-500 border-transparent' : ''}`}
                >
                  {tier.badge && (
                    <span className={`absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      tier.highlight
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                        : 'bg-slate-800 text-purple-300 border-slate-700'
                    }`}>
                      {tier.badge}
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-white text-base">
                        +{tier.connections} {tier.connections === 1 ? 'Conexão Adicional' : 'Conexões Adicionais'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-black text-emerald-400">
                        R$ {tier.totalPrice} <span className="text-xs font-medium text-slate-400">/mês</span>
                      </div>
                      <div className="text-[11px] text-purple-300 font-medium">
                        Sai a <span className="font-bold underline">R$ {tier.unitPrice}/mês</span> por conexão
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {tier.desc}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Ativação Imediata
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyTier(tier.connections);
                      }}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-purple-600/30"
                    >
                      Contratar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#151824] border border-slate-800 text-slate-400 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Cobrança recorrente adicionada à sua fatura mensal do NyxZap. Cancele quando quiser.
              </span>
              <button
                onClick={() => setShowBuyModal(false)}
                className="text-xs text-slate-400 hover:text-white underline font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

