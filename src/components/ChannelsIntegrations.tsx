import React, { useState } from 'react';
import { 
  Radio, 
  Mail, 
  Check, 
  Copy, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert,
  Server,
  Zap,
  RefreshCw,
  Globe,
  Settings
} from 'lucide-react';
import { UserAuth } from '../types';

interface WebhookPlatform {
  id: string;
  name: string;
  description: string;
  iconBg: string;
  iconText: string;
  category: 'ecommerce' | 'gateway' | 'afiliados';
}

const PLATFORMS: WebhookPlatform[] = [
  {
    id: 'site-proprio',
    name: 'Site Próprio / E-commerce',
    description: 'Conecte qualquer site (Antigravity, Shopify, WordPress, custom) e receba carrinho abandonado, Pix gerado, compra aprovada e novos leads.',
    iconBg: 'bg-gradient-to-tr from-pink-500 to-purple-600',
    iconText: '🛍️',
    category: 'ecommerce'
  },
  {
    id: 'logzz',
    name: 'Logzz',
    description: 'Receba pedidos e vendas da Logzz via webhook.',
    iconBg: 'bg-emerald-500',
    iconText: 'LQZZ',
    category: 'gateway'
  },
  {
    id: 'coinzz',
    name: 'Coinzz',
    description: 'Integre pagamentos e transações da Coinzz.',
    iconBg: 'bg-slate-800 border border-slate-700',
    iconText: 'coinzz',
    category: 'gateway'
  },
  {
    id: 'payt',
    name: 'Payt',
    description: 'Receba notificações de pagamentos da Payt.',
    iconBg: 'bg-amber-600',
    iconText: 'payt',
    category: 'gateway'
  },
  {
    id: 'braip',
    name: 'Braip',
    description: 'Integre vendas e comissões da Braip.',
    iconBg: 'bg-indigo-600',
    iconText: 'b',
    category: 'afiliados'
  },
  {
    id: 'appmax',
    name: 'AppMax',
    description: 'Integre pagamentos e assinaturas da AppMax.',
    iconBg: 'bg-purple-600',
    iconText: '☊',
    category: 'gateway'
  },
  {
    id: 'hyppe',
    name: 'Hyppe',
    description: 'Integre vendas COD e After Pay da Hyppe.',
    iconBg: 'bg-slate-900 border border-slate-700',
    iconText: 'hyppe',
    category: 'ecommerce'
  },
  {
    id: 'eon-digital',
    name: 'Eon Digital',
    description: 'Integre vendas e pagamentos da Eon Digital.',
    iconBg: 'bg-orange-600',
    iconText: 'eon',
    category: 'gateway'
  },
  {
    id: 'keedpay',
    name: 'KeedPay',
    description: 'Integre vendas Pay After Delivery da KeedPay.',
    iconBg: 'bg-teal-600',
    iconText: 'K',
    category: 'gateway'
  },
  {
    id: 'ticto',
    name: 'Ticto',
    description: 'Integre vendas e checkout da Ticto.',
    iconBg: 'bg-black border border-slate-700',
    iconText: 'T',
    category: 'afiliados'
  },
  {
    id: 'hotmart',
    name: 'Hotmart',
    description: 'Integre vendas de infoprodutos da Hotmart.',
    iconBg: 'bg-gradient-to-tr from-orange-600 to-red-600',
    iconText: '🔥',
    category: 'afiliados'
  },
  {
    id: 'kirvano',
    name: 'Kirvano',
    description: 'Integre vendas e checkout da Kirvano.',
    iconBg: 'bg-black border border-slate-800',
    iconText: 'kirvano',
    category: 'afiliados'
  },
  {
    id: 'cakto',
    name: 'Cakto',
    description: 'Integre vendas e checkout da Cakto.',
    iconBg: 'bg-emerald-600',
    iconText: '🌵',
    category: 'afiliados'
  },
  {
    id: 'mundpay',
    name: 'MundPay',
    description: 'Integre vendas de produtos digitais da MundPay.',
    iconBg: 'bg-emerald-950 border border-emerald-800',
    iconText: 'mundpay',
    category: 'gateway'
  },
  {
    id: 'shopee',
    name: 'Shopee',
    description: 'Receba atualizações de status dos pedidos da Shopee.',
    iconBg: 'bg-orange-500',
    iconText: '🛍️',
    category: 'ecommerce'
  }
];

interface Props {
  user: UserAuth;
}

export const ChannelsIntegrations: React.FC<Props> = ({ user }) => {
  // Saved custom webhook urls
  const [customUrls, setCustomUrls] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('nyxzap_integrations_urls');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Show/Hide token states
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // SMTP Settings
  const [smtpConnected, setSmtpConnected] = useState(true);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('notificacoes@nyxzap.com.br');
  const [smtpPass, setSmtpPass] = useState('••••••••••••');
  const [smtpSender, setSmtpSender] = useState('Atendimento NyxZap <contato@nyxzap.com.br>');

  const baseUrl = window.location.origin;
  const userToken = user.id ? `usr_${user.id.substring(0, 8)}` : 'usr_default';

  const getPostbackUrl = (platformId: string) => {
    return `${baseUrl}/api/webhook/${platformId}?token=${userToken}`;
  };

  const handleCopy = (platformId: string) => {
    const url = getPostbackUrl(platformId);
    navigator.clipboard.writeText(url);
    setCopiedId(platformId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSaveCustomUrl = (platformId: string) => {
    try {
      localStorage.setItem('nyxzap_integrations_urls', JSON.stringify(customUrls));
      setSavedId(platformId);
      setTimeout(() => setSavedId(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="bg-[#0e101a] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Canais & Integrações
            </h1>
            <p className="text-xs text-slate-400">
              Conecte plataformas de pagamento, e-commerce e SMTP para alimentar automaticamente seus fluxos e funis de venda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-[#141624] px-3.5 py-2 rounded-xl border border-slate-800">
          <span className="text-slate-400">Token de Integração:</span>
          <span className="text-purple-400 font-bold">{userToken}</span>
        </div>
      </div>

      {/* 1. SEÇÃO E-MAIL SMTP */}
      <div className="bg-[#0e101a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
          <Mail className="w-4 h-4 text-purple-400" />
          <span>E-mail SMTP</span>
        </div>

        <div className="bg-[#141624] border border-purple-500/20 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">E-mail SMTP</h3>
              <p className="text-xs text-slate-400">Configure seu servidor de e-mail para envio de notificações e mensagens de funil.</p>
              <div className="flex items-center gap-2 mt-2">
                {smtpConnected ? (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Conectado ({smtpSender})
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Desconectado</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSmtpModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              Configurar Servidor
            </button>
            <button
              onClick={() => setSmtpConnected(!smtpConnected)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                smtpConnected 
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {smtpConnected ? 'Desconectar' : 'Conectar'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SEÇÃO WEBHOOKS */}
      <div className="bg-[#0e101a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Webhooks de Vendas & Pagamentos</span>
          </div>
          <p className="text-xs text-slate-400">
            Conecte plataformas de vendas para receber pedidos, pagamentos e comissões automaticamente nos seus funis.
          </p>
        </div>

        {/* Grid de Plataformas (2 Colunas, igual prints) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORMS.map((platform) => {
            const isVisible = !!showTokens[platform.id];
            const isCopied = copiedId === platform.id;
            const isSaved = savedId === platform.id;
            const postbackUrl = getPostbackUrl(platform.id);

            return (
              <div 
                key={platform.id}
                className="bg-[#141624] border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 space-y-4 transition-all shadow-md flex flex-col justify-between"
              >
                {/* Header da Plataforma */}
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-xl ${platform.iconBg} flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md`}>
                    {platform.iconText}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{platform.name}</h3>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{platform.description}</p>
                  </div>
                </div>

                {/* Bloco URL de Postback */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">
                      Sua URL de Postback (cole na plataforma)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Mantenha esta URL secreta — ela permite acionar seus fluxos.</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#0b0c14] border border-slate-800 rounded-xl p-1.5 px-3">
                    <span className="text-xs font-mono text-slate-300 flex-1 truncate select-all">
                      {isVisible ? postbackUrl : '••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </span>

                    <button
                      onClick={() => setShowTokens(prev => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                      title={isVisible ? 'Ocultar URL' : 'Mostrar URL'}
                      className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleCopy(platform.id)}
                      title="Copiar URL de Postback"
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isCopied 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Bloco URL do Webhook Opcional */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-slate-400">
                    URL do Webhook (opcional)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={customUrls[platform.id] || ''}
                      onChange={(e) => setCustomUrls({ ...customUrls, [platform.id]: e.target.value })}
                      className="flex-1 bg-[#0b0c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => handleSaveCustomUrl(platform.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSaved 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {isSaved ? 'Salvo!' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL CONFIGURAÇÃO SMTP */}
      {showSmtpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#12131f] border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-400" />
                Configurar Servidor E-mail SMTP
              </h3>
              <button 
                onClick={() => setShowSmtpModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Host SMTP</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full bg-[#181a28] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Porta</label>
                  <input
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full bg-[#181a28] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Segurança</label>
                  <select className="w-full bg-[#181a28] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    <option>TLS / STARTTLS</option>
                    <option>SSL</option>
                    <option>Nenhuma</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Usuário / E-mail</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full bg-[#181a28] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Senha SMTP</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full bg-[#181a28] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nome do Remetente</label>
                <input
                  type="text"
                  value={smtpSender}
                  onChange={(e) => setSmtpSender(e.target.value)}
                  className="w-full bg-[#181a28] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowSmtpModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setSmtpConnected(true);
                  setShowSmtpModal(false);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-500"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
