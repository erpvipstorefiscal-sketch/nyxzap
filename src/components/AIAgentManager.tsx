import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Brain, 
  Globe, 
  FileText, 
  Eye, 
  Send, 
  AlertCircle, 
  Plus, 
  Save, 
  CheckCircle2, 
  Layers, 
  Cpu,
  Trash2,
  HelpCircle,
  PhoneCall,
  Bell,
  Clock,
  Calendar,
  Volume2,
  Mic,
  Image as ImageIcon,
  Video,
  Music,
  Upload,
  Lock,
  ShieldCheck,
  ChevronRight,
  X,
  Edit3,
  RefreshCw,
  Radio,
  Check,
  MessageSquare
} from 'lucide-react';
import { AIAgentConfig, UserAuth, AIMediaItem, GoogleCalendarConfig } from '../types';

export type AIAgentSubTab = 'config' | 'human_alert' | 'follow_up' | 'audio' | 'media' | 'group_broadcasts' | 'calendar' | 'knowledge' | 'playground';

// Componente ToggleSwitch idêntico ao modelo da Foto 3 (chave verde esmeralda com botão branco)
export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, title, description, disabled }) => {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`p-4 rounded-xl bg-[#141622] border border-white/[0.06] flex items-center justify-between gap-4 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/10'
      }`}
    >
      <div className="flex-1 pr-2">
        <span className="text-xs font-bold text-white block select-none">{title}</span>
        {description && (
          <span className="text-[11px] text-slate-400 block mt-0.5 select-none leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 cursor-pointer ${
          checked ? 'bg-[#009b62]' : 'bg-zinc-700'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-md absolute top-0.5 left-0.5 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export const InlineToggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 cursor-pointer ${
        checked ? 'bg-[#009b62]' : 'bg-zinc-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-md absolute top-0.5 left-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

interface AIAgentManagerProps {
  user?: UserAuth | null;
  activeTab?: AIAgentSubTab;
  onTabChange?: (tab: AIAgentSubTab) => void;
}

export const AIAgentManager: React.FC<AIAgentManagerProps> = ({ 
  user,
  activeTab: controlledTab,
  onTabChange: onControlledTabChange
}) => {
  const isProUser = Boolean(user?.role === 'admin' || user?.planName?.toLowerCase().includes('pro'));
  
  const [internalTab, setInternalTab] = useState<AIAgentSubTab>('config');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = (tab: AIAgentSubTab) => {
    if (onControlledTabChange) {
      onControlledTabChange(tab);
    }
    setInternalTab(tab);
  };

  const [config, setConfig] = useState<AIAgentConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-3.8-flash',
    reasoningLevel: 'high',
    mediaResolution: 'maximo',
    webSearchEnabled: true,
    systemPrompt: 'Você é o NyxZap Concierge, assistente de vendas e automações via WhatsApp. Seja persuasivo e profissional.',
    escapeKeywords: ['humano', 'falar com atendente', 'cancelar', 'reclamação', 'processo'],
    knowledgeDocs: [
      { id: '1', name: 'Tabela_Precos_2026.pdf', size: '1.2 MB', uploadedAt: '11/10/2026', type: 'pdf' },
      { id: '2', name: 'Playbook_Vendas.docx', size: '850 KB', uploadedAt: '11/10/2026', type: 'docx' }
    ],
    humanAlertEnabled: true,
    humanAlertNumbers: ['5514988342207'],
    pauseAiOnHumanRequest: true,
    pauseDurationHours: '24 horas',
    includeChatSummaryInAlert: true,
    useCustomInterventionRules: true,
    customInterventionRulesPrompt: `Quando o cliente solicitar EXPLICITAMENTE falar com um humano/atendente/pessoa real, você DEVE OBRIGATORIAMENTE chamar a função "request_human_intervention" IMEDIATAMENTE, ANTES de responder.
Exemplos de quando usar: "quero falar com humano", "me passa para um atendente", "preciso de ajuda humana", "quero falar com uma pessoa", "pode me transferir", "quero atendimento humano".
- SEMPRE chame a função request_human_intervention nesses casos
NÃO peça confirmação de dados antes de chamar a função.`,
    followUpAiEnabled: false,
    followUpPrompt: `## Assistente de Follow-up Inteligente para WhatsApp

Você é um assistente especializado em comunicação comercial e relacionamento com clientes pelo WhatsApp. Sua função é analisar o histórico de uma conversa e elaborar uma sequência de 3 mensagens estratégicas para retomar o contato de forma natural e aumentar as chances de resposta.

### OBJETIVO
Criar mensagens que incentivem o cliente a continuar a conversa, esclareçam possíveis dúvidas e facilitem a tomada de decisão, sem parecer insistentes ou automatizadas.

### SEQUÊNCIA DE MENSAGENS

**1. Primeiro contato — Reaproximação**
Retome a conversa de maneira cordial e descontraída. Utilize algum detalhe relevante do histórico para demonstrar atenção ao que o cliente comentou anteriormente.

**2. Segundo contato — Suporte e solução**
Seja mais objetivo, oferecendo esclarecimentos, ajuda para resolver dúvidas ou informações adicionais relacionadas ao interesse demonstrado pelo cliente.

**3. Terceiro contato — Encerramento estratégico**
Envie uma última mensagem que estimule uma resposta ou decisão, utilizando um senso de prioridade apenas quando houver justificativa real na conversa. Mantenha a cordialidade e deixe o cliente à vontade para responder.

### DIRETRIZES DE GERAÇÃO
- Considere o histórico completo antes de elaborar as mensagens.
- Personalize cada abordagem com base nas informações efetivamente mencionadas pelo cliente.
- Escreva em português natural, com linguagem humana e adequada ao contexto comercial.
- Mantenha uma comunicação profissional, acessível e empática.
- Produza mensagens com no mínimo 10 e no máximo 50 palavras cada.
- Utilize somente informações confirmadas na conversa sobre produtos, serviços, preços, condições e benefícios.
- Dê a cada mensagem uma finalidade própria, evitando frases ou argumentos repetidos.
- Não invente descontos, prazos, escassez, promoções ou condições especiais.
- Evite cobranças, pressão excessiva ou expressões que possam causar desconforto.
- Se o cliente já tiver recusado a oferta, solicitado para não receber mensagens ou concluído a compra, adapte a abordagem ou não envie novos follow-ups, conforme o contexto.

### FORMATO DA RESPOSTA

**Mensagem 1 — Reaproximação**
[Texto personalizado]

**Mensagem 2 — Oferta de ajuda**
[Texto personalizado]

**Mensagem 3 — Último contato**
[Texto personalizado]

### INSTRUÇÃO FINAL
Entregue somente as três mensagens prontas para envio, sem explicar sua estratégia ou acrescentar comentários. Cada texto deve estar adequado ao momento da conversa e funcionar como uma continuação coerente do atendimento.`,
    followUpCount: 3,
    followUpIntervalHours: 24,
    followUpOffHoursEnabled: false,
    followUpTimezone: 'America/Sao_Paulo (GMT-3)',
    audioEnabled: false,
    voiceProvider: 'elevenlabs',
    voiceName: 'Rachel (Feminina)',
    elevenlabsApiKey: '',
    useCustomVoiceId: false,
    customVoiceId: '',
    substituteTextWithAudio: false,
    autoReplyWithAudio: true,
    smartAudioEnabled: false,
    smartAudioMinChars: 70,
    aiMediaList: [],
    googleCalendar: {
      connected: false,
      email: '',
      autoScheduleEnabled: false,
      minBookingLeadTimeHours: 1,
      defaultMeetingDurationMinutes: 45,
      businessHours: {
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '18:00'
      },
      customConfirmationMessageEnabled: true,
      customConfirmationMessage: 'Sua reunião foi confirmada com sucesso! Enviamos os detalhes e o link do Google Meet.',
      customMeetingTitleEnabled: true,
      customMeetingTitle: 'Reunião Comercial - NyxZap & {cliente}',
      requireEmailForBooking: false,
      lastSyncAt: new Date().toLocaleString('pt-BR'),
      freeSlotsCount: 7,
      scheduledMeetingsCount: 0
    }
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [saveToast, setSaveToast] = useState(false);

  // Human Alert Number Input
  const [newAlertPhone, setNewAlertPhone] = useState('');

  // Follow-up Prompt Modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [tempFollowUpPrompt, setTempFollowUpPrompt] = useState(config.followUpPrompt || '');

  // Media upload state
  const [mediaDescription, setMediaDescription] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Group Scheduled Broadcasts state
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [newBroadcastGroup, setNewBroadcastGroup] = useState('Todos os Grupos');
  const [newBroadcastType, setNewBroadcastType] = useState<'fixed' | 'ai'>('ai');
  const [newBroadcastContent, setNewBroadcastContent] = useState('Envie uma dica prática de engajamento no WhatsApp comercial para fidelizar clientes.');
  const [newBroadcastFrequency, setNewBroadcastFrequency] = useState('daily_09');

  // Playground state
  const [testPrompt, setTestPrompt] = useState('Qual é a garantia do plano e como funciona o suporte?');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ reasoning?: string; response?: string; citations?: string[] } | null>(null);

  // Fetch initial AI config
  useEffect(() => {
    fetch('/api/ai-config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setConfig(prev => ({
            ...prev,
            ...data,
            googleCalendar: { ...prev.googleCalendar, ...(data.googleCalendar || {}) }
          }));
          if (data.followUpPrompt) {
            setTempFollowUpPrompt(data.followUpPrompt);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Fetch scheduled broadcasts when tab is selected
  useEffect(() => {
    if (activeTab === 'group_broadcasts') {
      fetchScheduledBroadcasts();
    }
  }, [activeTab]);

  const fetchScheduledBroadcasts = async () => {
    setLoadingScheduled(true);
    try {
      const res = await fetch('/api/whatsapp/groups/scheduled');
      const data = await res.json();
      if (data.success && Array.isArray(data.broadcasts)) {
        setScheduledList(data.broadcasts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const handleSave = async () => {
    try {
      await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
    }
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const kw = newKeyword.trim().toLowerCase();
    if (!config.escapeKeywords.includes(kw)) {
      setConfig({ ...config, escapeKeywords: [...config.escapeKeywords, kw] });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (index: number) => {
    const updated = config.escapeKeywords.filter((_, i) => i !== index);
    setConfig({ ...config, escapeKeywords: updated });
  };

  const handleAddAlertPhone = () => {
    if (!newAlertPhone.trim()) return;
    const clean = newAlertPhone.replace(/\D/g, '');
    if (clean.length >= 10) {
      const current = config.humanAlertNumbers || [];
      if (!current.includes(clean)) {
        setConfig({ ...config, humanAlertNumbers: [...current, clean] });
      }
      setNewAlertPhone('');
    }
  };

  const handleRemoveAlertPhone = (idx: number) => {
    const current = config.humanAlertNumbers || [];
    setConfig({ ...config, humanAlertNumbers: current.filter((_, i) => i !== idx) });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', mediaDescription || file.name);

      const res = await fetch('/api/ai-media/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.item) {
        setConfig(prev => ({
          ...prev,
          aiMediaList: [...(prev.aiMediaList || []), data.item]
        }));
        setMediaDescription('');
      }
    } catch (err) {
      console.error('Erro no upload de mídia:', err);
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (id: string) => {
    const updated = (config.aiMediaList || []).filter(m => m.id !== id);
    setConfig({ ...config, aiMediaList: updated });
  };

  const handleCreateScheduledBroadcast = async () => {
    if (!newBroadcastContent.trim()) return;
    try {
      const scheduledDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await fetch('/api/whatsapp/groups/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: '120363025@g.us',
          groupName: newBroadcastGroup,
          text: newBroadcastType === 'ai' 
            ? `[IA Programada: ${newBroadcastContent}]` 
            : newBroadcastContent,
          scheduledAt: scheduledDate
        })
      });
      fetchScheduledBroadcasts();
      setNewBroadcastContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteScheduled = async (id: string) => {
    try {
      await fetch(`/api/whatsapp/groups/scheduled/${id}`, { method: 'DELETE' });
      setScheduledList(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch('/api/google-calendar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'contato@nyxzap.com.br' })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(prev => ({ ...prev, googleCalendar: data.googleCalendar }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      const res = await fetch('/api/google-calendar/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConfig(prev => ({ ...prev, googleCalendar: data.googleCalendar }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncCalendar = async () => {
    try {
      const res = await fetch('/api/google-calendar/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConfig(prev => ({ ...prev, googleCalendar: data.googleCalendar }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestPlayground = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testPrompt })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTestLoading(false);
    }
  };

  const elevenlabsVoices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Feminina - Calma & Comercial)', preview: 'Olá, seja muito bem-vindo ao suporte.' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Masculino - Firme & Autoritário)', preview: 'Com certeza, posso te apresentar os planos.' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Masculino - Jovem & Amigável)', preview: 'Opa, tudo bem? Vamos fechar essa proposta hoje?' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Feminina - Suave & Elegante)', preview: 'Seu agendamento foi confirmado com sucesso.' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Masculino - Narrador Profissional)', preview: 'Conheça agora as principais vantagens do sistema.' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Feminina - Dinâmica & Enérgica)', preview: 'Estamos com condições imperdíveis hoje!' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card border border-white/[0.08] p-5 rounded-2xl">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Agente de IA Multimodal & Automações
              </h2>
              {isProUser ? (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Plano Pro: NyxzapIA Ilimitada
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                  Plano Dinder
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Atendimento autônomo, vozes humanas, agendamentos no Google Calendar, mídias e transbordo humano.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary px-4 py-2.5 text-white rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-indigo-600/20"
        >
          <Save className="w-4 h-4" />
          <span>{saveToast ? 'Alterações Salvas no Banco!' : 'Salvar Alterações'}</span>
        </button>
      </div>

      {/* Sub-menu Breadcrumb & Quick Switch */}
      {(() => {
        const tabList: { id: AIAgentSubTab; label: string; icon: any; color?: string }[] = [
          { id: 'config', label: 'Modelos & IA', icon: Cpu, color: 'text-indigo-400' },
          { id: 'human_alert', label: 'Alerta Humano', icon: PhoneCall, color: 'text-amber-400' },
          { id: 'follow_up', label: 'Follow-up IA', icon: Clock, color: 'text-cyan-400' },
          { id: 'audio', label: 'Áudio com IA', icon: Volume2, color: 'text-purple-400' },
          { id: 'media', label: `Mídias da IA (${config.aiMediaList?.length || 0})`, icon: ImageIcon, color: 'text-blue-400' },
          { id: 'group_broadcasts', label: 'Postagens em Grupos', icon: Radio, color: 'text-pink-400' },
          { id: 'calendar', label: 'Google Calendar', icon: Calendar, color: 'text-emerald-400' },
          { id: 'knowledge', label: `Base de Conhecimento (${config.knowledgeDocs?.length || 0})`, icon: FileText, color: 'text-zinc-400' },
          { id: 'playground', label: 'Playground', icon: Sparkles, color: 'text-emerald-400' }
        ];
        const currentTabInfo = tabList.find(t => t.id === activeTab) || tabList[0];
        const CurrentTabIcon = currentTabInfo.icon;

        return (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-zinc-500 font-medium">Agente de IA</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-white font-bold flex items-center gap-1.5">
                <CurrentTabIcon className={`w-3.5 h-3.5 ${currentTabInfo.color || 'text-indigo-400'}`} />
                <span>{currentTabInfo.label}</span>
              </span>
            </div>

            {/* Quick pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full text-xs">
              {tabList.map(tab => {
                const TabIcon = tab.icon;
                const isTabActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-1.5 px-3 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
                      isTabActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-subtle'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* TAB 1: MODELOS & IA                                             */}
      {/* ============================================================== */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Provider Selection Cards (4 Options) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. NyxzapIA (Proprietary AI) */}
            <div
              onClick={() => {
                if (isProUser) {
                  setConfig({ ...config, provider: 'nyxzapia', model: 'nyxzap-ultra-v2' });
                }
              }}
              className={`p-5 rounded-2xl border transition-all relative overflow-hidden ${
                config.provider === 'nyxzapia'
                  ? 'bg-indigo-950/30 border-indigo-500 shadow-lg shadow-indigo-500/10'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              } ${!isProUser ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> NyxzapIA
                </span>
                {isProUser ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    IA Própria • PRO
                  </span>
                ) : (
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                    <Lock className="w-2.5 h-2.5" /> Requer Pro
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                IA nativa sem necessidade de conectar chave de API. Respostas ultra-rápidas para WhatsApp comercial.
              </p>
              {!isProUser && (
                <div className="mt-3 pt-3 border-t border-white/[0.06] text-[10px] text-amber-400 font-medium">
                  Bloqueada no plano Dinder. Faça upgrade para o Pro para usar ilimitado!
                </div>
              )}
            </div>

            {/* 2. Google Gemini */}
            <div
              onClick={() => setConfig({ ...config, provider: 'gemini', model: 'gemini-3.8-flash' })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                config.provider === 'gemini'
                  ? 'bg-surface-card border-indigo-500/80 shadow-subtle'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2 text-xs">
                  <Brain className="w-4 h-4 text-indigo-400" /> Google Gemini
                </span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-medium">
                  Flash 3.8
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Modelo oficial Gemini 3, ultra-inteligente, respostas rápidas para WhatsApp e raciocínio dinâmico.
              </p>
            </div>

            {/* 3. OpenAI GPT */}
            <div
              onClick={() => setConfig({ ...config, provider: 'openai', model: 'gpt-4o' })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                config.provider === 'openai'
                  ? 'bg-surface-card border-indigo-500/80 shadow-subtle'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2 text-xs">
                  <Layers className="w-4 h-4 text-emerald-400" /> OpenAI GPT
                </span>
                <span className="text-[10px] bg-white/[0.05] text-zinc-300 border border-white/10 px-2 py-0.5 rounded font-mono">
                  GPT-4o
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Atendimento rápido para WhatsApp com grande repertório e raciocínio lógico comprovado.
              </p>
            </div>

            {/* 4. Anthropic Claude */}
            <div
              onClick={() => setConfig({ ...config, provider: 'claude', model: 'claude-3-7-sonnet' })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                config.provider === 'claude'
                  ? 'bg-surface-card border-indigo-500/80 shadow-subtle'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2 text-xs">
                  <Bot className="w-4 h-4 text-cyan-400" /> Anthropic Claude
                </span>
                <span className="text-[10px] bg-white/[0.05] text-zinc-300 border border-white/10 px-2 py-0.5 rounded font-mono">
                  Sonnet 5.5 / 3.7
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Excelente em nuance de negociação comercial, tom empático e fechamento de vendas.
              </p>
            </div>
          </div>

          {/* Model Selector & API Key */}
          <div className="p-5 rounded-2xl bg-surface-card border border-white/[0.08] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Modelo Selecionado */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                  Modelo Específico ({config.provider.toUpperCase()})
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full bg-[#141622] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer font-medium"
                >
                  {config.provider === 'nyxzapia' && (
                    <>
                      <option value="nyxzap-ultra-v2">NyxzapIA Ultra 3.8 (Otimizado para WhatsApp - Recomendado)</option>
                      <option value="nyxzap-fast-v1">NyxzapIA Fast (Velocidade Extrema)</option>
                    </>
                  )}
                  {config.provider === 'gemini' && (
                    <>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recomendado Oficial - Mais Rápido & Inteligente)</option>
                      <option value="gemini-3.7-flash">Gemini 3.7 Flash (Estabilidade & Código)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Velocidade & Rotina)</option>
                      <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Super Econômico)</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Raciocínio Complexo)</option>
                    </>
                  )}
                  {config.provider === 'openai' && (
                    <>
                      <option value="gpt-4o">GPT-4o (Omnimodal - Recomendado)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (Ultra Rápido & Econômico)</option>
                      <option value="o3-mini">OpenAI o3-mini (Raciocínio Lógico & Programação)</option>
                      <option value="o4-mini">OpenAI o4-mini (Raciocínio Rápido Multimodal)</option>
                      <option value="gpt-4.5-preview">GPT-4.5 Preview (Alta Nuance & Escrita Natural)</option>
                    </>
                  )}
                  {config.provider === 'claude' && (
                    <>
                      <option value="claude-3-7-sonnet">Claude 3.7 Sonnet / Sonnet 5.5 (Raciocínio Híbrido - Recomendado)</option>
                      <option value="claude-3-5-haiku">Claude 3.5 Haiku / Haiku 5.5 (Respostas Instantâneas & Baixo Custo)</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Padrão Ouro de Escrita Comercial)</option>
                      <option value="claude-3-opus">Claude 3 Opus / Opus 5.5 (Tarefas Complexas e Pesquisa)</option>
                    </>
                  )}
                </select>
                <span className="text-[11px] text-slate-500">
                  {config.provider === 'nyxzapia' 
                    ? 'Incluso no seu plano PRO. Não consome créditos externos.' 
                    : 'Ajuste a versão do modelo conforme sua preferência de custo e velocidade.'}
                </span>
              </div>

              {/* Chave de API */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                  {config.provider === 'nyxzapia' ? 'Chave de API (Não necessária no Plano PRO)' : `Chave da API (${config.provider.toUpperCase()})`}
                </label>
                {config.provider === 'nyxzapia' ? (
                  <div className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Autenticação nativa do servidor gerenciada automaticamente.</span>
                  </div>
                ) : (
                  <input
                    type="password"
                    placeholder={`Cole sua API Key do ${config.provider.toUpperCase()} aqui...`}
                    value={config.apiKey || ''}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    className="w-full bg-[#141622] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-600"
                  />
                )}
                <span className="text-[11px] text-slate-500">
                  {config.provider === 'nyxzapia' 
                    ? 'Você não precisa pagar nem configurar nenhuma API para usar a NyxzapIA.' 
                    : 'Sua chave fica protegida localmente no seu banco de dados PostgreSQL.'}
                </span>
              </div>
            </div>
          </div>

          {/* Special Controls: Reasoning, Media Res, Web Search */}
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-5">
            <h3 className="text-xs font-semibold text-white flex items-center gap-2 border-b border-white/[0.06] pb-3 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Controles Especiais da IA</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nível de Raciocínio */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Nível de Raciocínio da IA</span>
                  <span className="text-indigo-400 font-mono text-[10px]">{config.reasoningLevel.toUpperCase()}</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Controla a profundidade do raciocínio interno do modelo antes de formular a resposta.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(['low', 'medium', 'high'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfig({ ...config, reasoningLevel: lvl })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                        config.reasoningLevel === lvl
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-subtle'
                          : 'bg-[#141622] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      {lvl.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolução de Mídia */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Resolução de Mídia (Imagens & Comprovantes)</span>
                  <span className="text-cyan-400 font-mono text-[10px]">{config.mediaResolution.toUpperCase()}</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Controla a qualidade do processamento visual de imagens recebidas pelo WhatsApp.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(['baixo', 'medio', 'maximo'] as const).map(res => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setConfig({ ...config, mediaResolution: res })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                        config.mediaResolution === res
                          ? 'bg-cyan-600/80 border-cyan-500 text-white shadow-subtle'
                          : 'bg-[#141622] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Search Grounding */}
            <div 
              onClick={() => setConfig({ ...config, webSearchEnabled: !config.webSearchEnabled })}
              className="p-4 rounded-xl bg-[#141622] border border-white/[0.06] flex items-center justify-between cursor-pointer hover:border-white/10 transition-colors"
            >
              <div className="space-y-1 select-none pr-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Pesquisa na Web (Google Search Grounding)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Ativa a habilidade do modelo de pesquisar na web informações em tempo real quando necessário.
                </p>
              </div>

              <InlineToggle
                checked={config.webSearchEnabled}
                onChange={(val) => setConfig({ ...config, webSearchEnabled: val })}
              />
            </div>
          </div>

          {/* System Prompt */}
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>System Prompt / Comportamento do Agente</span>
            </h3>
            <p className="text-xs text-slate-400">
              Defina como o agente vai se comportar, tom de voz, regras de negociação e critérios de qualificação.
            </p>
            <textarea
              rows={6}
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              className="w-full bg-[#141622] border border-white/10 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* Palavras-chave Tradicionais */}
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-white flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Palavras-chave de Escape Rápido (Transbordo Imediato)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Se o cliente digitar qualquer uma destas palavras, o agente pausa automaticamente e notifica atendentes.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Adicionar palavra (ex: cancelar, processo, atendente)..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                className="flex-1 bg-[#141622] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleAddKeyword}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {(config.escapeKeywords || []).map((kw, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-[#141622] border border-white/10 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-2 group hover:border-amber-500/40"
                >
                  <span>{kw}</span>
                  <button
                    onClick={() => handleRemoveKeyword(i)}
                    className="text-slate-500 hover:text-rose-400 text-xs font-bold transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ALERTA DE ATENDIMENTO HUMANO (Photo 1)                   */}
      {/* ============================================================== */}
      {activeTab === 'human_alert' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Alerta de Atendimento Humano</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure notificações automáticas pelo WhatsApp para sua equipe quando um cliente pedir para falar com atendente ou acionar o transbordo.
              </p>
            </div>

            {/* Toggle 1: Ativar Alerta de Atendimento Humano */}
            <ToggleSwitch
              title="Ativar Alerta de Atendimento Humano"
              description="Envia mensagens de alerta para os números do WhatsApp cadastrados abaixo."
              checked={config.humanAlertEnabled}
              onChange={(val) => setConfig({ ...config, humanAlertEnabled: val })}
            />

            {/* Números do WhatsApp para receber o alerta */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Números do WhatsApp para receber o alerta:
              </label>

              {/* Lista dos números cadastrados com visual idêntico à Foto 1 */}
              <div className="space-y-2">
                {(config.humanAlertNumbers || []).map((num, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#141622] border border-white/[0.08]"
                  >
                    <span className="font-mono text-xs text-white">{num}</span>
                    <button
                      onClick={() => handleRemoveAlertPhone(idx)}
                      className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                      title="Remover número"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Input para adicionar novo número */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 5514988342207 (DDI + DDD + Número)"
                  value={newAlertPhone}
                  onChange={(e) => setNewAlertPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAlertPhone()}
                  className="flex-1 bg-[#141622] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleAddAlertPhone}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
            </div>

            {/* Toggle 2: Pausar o Agente de IA ao solicitar atendimento humano */}
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              <ToggleSwitch
                title="Pausar o Agente de IA ao solicitar atendimento humano"
                description="Evita que a IA continue respondendo enquanto um humano assume a conversa."
                checked={config.pauseAiOnHumanRequest}
                onChange={(val) => setConfig({ ...config, pauseAiOnHumanRequest: val })}
              />

              {/* Seletor de Duração da pausa */}
              {config.pauseAiOnHumanRequest && (
                <div className="p-4 rounded-xl bg-[#141622]/60 border border-white/[0.06] space-y-1.5 ml-4">
                  <label className="text-xs font-semibold text-slate-300 block">Duração da pausa</label>
                  <select
                    value={config.pauseDurationHours || '24 horas'}
                    onChange={(e) => setConfig({ ...config, pauseDurationHours: e.target.value })}
                    className="w-full bg-[#141622] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="24 horas">24 horas</option>
                    <option value="12 horas">12 horas</option>
                    <option value="6 horas">6 horas</option>
                    <option value="1 hora">1 hora</option>
                    <option value="permanente">Permanente (até reativar manualmente)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Toggle 3: Incluir resumo da conversa no alerta */}
            <ToggleSwitch
              title="Incluir resumo da conversa no alerta"
              description="Gera um resumo dos tópicos abordados para o atendente humano ler antes de assumir o chat."
              checked={config.includeChatSummaryInAlert}
              onChange={(val) => setConfig({ ...config, includeChatSummaryInAlert: val })}
            />

            {/* Toggle 4: Usar regras customizadas de intervenção */}
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              <ToggleSwitch
                title="Usar regras customizadas de intervenção"
                description="Instruções específicas para a IA identificar a hora certa de chamar um humano."
                checked={config.useCustomInterventionRules}
                onChange={(val) => setConfig({ ...config, useCustomInterventionRules: val })}
              />

              {/* Textarea com o texto exato da Foto 1 */}
              {config.useCustomInterventionRules && (
                <div className="space-y-2 ml-4">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Regras customizadas de intervenção humana (Instruções para a IA):
                  </label>
                  <textarea
                    rows={6}
                    value={config.customInterventionRulesPrompt || ''}
                    onChange={(e) => setConfig({ ...config, customInterventionRulesPrompt: e.target.value })}
                    className="w-full bg-[#141622] border border-white/10 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: MENSAGENS DE FOLLOW-UP POR IA                           */}
      {/* ============================================================== */}
      {activeTab === 'follow_up' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Mensagens de Follow-up por IA</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Recupere leads que pararam de responder enviando mensagens personalizadas geradas pela IA com base no histórico da conversa.
              </p>
            </div>

            {/* Toggle de Ativação do Follow-up */}
            <ToggleSwitch
              title="Ativar Mensagens de Follow-up por IA"
              description="A IA analisa conversas sem resposta recente e cria abordagens naturais para reaquecer o contato."
              checked={config.followUpAiEnabled}
              onChange={(val) => setConfig({ ...config, followUpAiEnabled: val })}
            />

            {/* Botão para Editar o Prompt de Follow-up */}
            <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" /> Prompt de Follow-up Personalizado
                </span>
                <p className="text-[11px] text-slate-400">
                  Personalize o tom, os argumentos comerciais e a sequência estratégica de mensagens que a IA deve adotar.
                </p>
              </div>

              <button
                onClick={() => setShowFollowUpModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-2 self-start sm:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Prompt de Follow-up</span>
              </button>
            </div>

            {/* Configurações de Parâmetros do Follow-up */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
              {/* Quantidade de Mensagens */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#141622] border border-white/[0.06]">
                <label className="text-xs font-semibold text-slate-300 block">Quantidade de mensagens na sequência</label>
                <select
                  value={config.followUpCount || 3}
                  onChange={(e) => setConfig({ ...config, followUpCount: Number(e.target.value) })}
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={1}>1 mensagem</option>
                  <option value={2}>2 mensagens</option>
                  <option value={3}>3 mensagens (Recomendado)</option>
                  <option value={4}>4 mensagens</option>
                  <option value={5}>5 mensagens</option>
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Define quantas tentativas espaçadas a IA fará antes de arquivar o contato.
                </span>
              </div>

              {/* Intervalo entre mensagens */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#141622] border border-white/[0.06]">
                <label className="text-xs font-semibold text-slate-300 block">Intervalo entre disparos (horas)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={config.followUpIntervalHours || 24}
                    onChange={(e) => setConfig({ ...config, followUpIntervalHours: Number(e.target.value) })}
                    className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="text-xs text-slate-400 font-medium">horas</span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Tempo mínimo de espera em silêncio antes de acionar a próxima mensagem de follow-up.
                </span>
              </div>

              {/* Disparar fora do horário comercial */}
              <ToggleSwitch
                title="Disparar fora do horário comercial"
                description="Se desativado, o envio aguardará o início do próximo dia útil (09:00)."
                checked={config.followUpOffHoursEnabled}
                onChange={(val) => setConfig({ ...config, followUpOffHoursEnabled: val })}
              />

              {/* Fuso horário */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#141622] border border-white/[0.06]">
                <label className="text-xs font-semibold text-slate-300 block">Fuso horário da operação</label>
                <select
                  value={config.followUpTimezone || 'America/Sao_Paulo (GMT-3)'}
                  onChange={(e) => setConfig({ ...config, followUpTimezone: e.target.value })}
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="America/Sao_Paulo (GMT-3)">Brasília / São Paulo (GMT-3)</option>
                  <option value="America/Manaus (GMT-4)">Manaus (GMT-4)</option>
                  <option value="America/Fortaleza (GMT-3)">Nordeste (GMT-3)</option>
                  <option value="Europe/Lisbon (GMT+0)">Lisboa / Portugal (GMT+0)</option>
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Utilizado para calcular janelas de horário comercial.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDITAR PROMPT DE FOLLOW-UP                              */}
      {/* ============================================================== */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#10121d] border border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Prompt de Follow-up Inteligente</h3>
              </div>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informative Guidance Box */}
            <div className="p-4 rounded-xl bg-[#141622] border border-white/[0.08] space-y-3 text-xs leading-relaxed">
              <div className="space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-400" /> O que é este prompt?
                </span>
                <p className="text-slate-300">
                  Este prompt instrui a IA sobre como gerar mensagens de follow-up personalizadas baseadas no contexto de cada conversa.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-white/[0.06]">
                <span className="font-bold text-white">Por que personalizar?</span>
                <ul className="text-slate-300 space-y-1 list-disc list-inside">
                  <li>Adaptar o tom das mensagens ao seu negócio</li>
                  <li>Incluir informações específicas do seu produto/serviço</li>
                  <li>Definir regras customizadas para follow-up</li>
                </ul>
              </div>
            </div>

            {/* Prompt Editor */}
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <label className="text-xs font-semibold text-slate-300 block">
                Conteúdo do Prompt de Instrução da IA:
              </label>
              <textarea
                value={tempFollowUpPrompt}
                onChange={(e) => setTempFollowUpPrompt(e.target.value)}
                rows={12}
                className="w-full flex-1 bg-[#141622] border border-white/10 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed overflow-y-auto"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfig({ ...config, followUpPrompt: tempFollowUpPrompt });
                  setShowFollowUpModal(false);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Salvar Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: ÁUDIO COM AGENTE DE IA                                  */}
      {/* ============================================================== */}
      {activeTab === 'audio' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Banner Educativo: Como Funciona o Áudio com IA */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-surface-card to-indigo-950/20 border border-purple-500/20 space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Como Funciona o Áudio com IA</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#141622]/80 border border-white/[0.06] space-y-2">
                <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
                  Passo 1
                </span>
                <h4 className="text-xs font-bold text-white">Recebimento & Transcrição</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Quando o cliente envia um áudio no WhatsApp, a IA transcreve a mensagem instantaneamente para compreender a intenção.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141622]/80 border border-white/[0.06] space-y-2">
                <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold">
                  Passo 2
                </span>
                <h4 className="text-xs font-bold text-white">Raciocínio & Resposta</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Formula a melhor resposta considerando suas tabelas, base de conhecimento e regras de fechamento de venda.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141622]/80 border border-white/[0.06] space-y-2">
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                  Passo 3
                </span>
                <h4 className="text-xs font-bold text-white">Síntese de Voz Humana</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Converte o texto formulado em um áudio idêntico a uma voz humana real (PT-BR) e dispara como mensagem de voz no WhatsApp.
                </p>
              </div>
            </div>
          </div>

          {/* Configuração do Áudio */}
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6">
            {/* Toggle Principal: Ativar Áudio (Modelo da Foto 3) */}
            <ToggleSwitch
              title="Habilitar Audio com IA"
              description="Habilita a capacidade de usar áudio (não altera comportamento automaticamente)"
              checked={config.audioEnabled}
              onChange={(val) => setConfig({ ...config, audioEnabled: val })}
            />

            {/* Provedor de Voz (ElevenLabs vs Nativo) */}
            <div className="space-y-4 pt-2 border-t border-white/[0.06]">
              <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
                Motor de Voz Humana
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setConfig({ ...config, voiceProvider: 'elevenlabs' })}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    config.voiceProvider === 'elevenlabs'
                      ? 'bg-purple-950/20 border-purple-500 shadow-subtle'
                      : 'bg-[#141622] border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-400" /> ElevenLabs Premium
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Vozes ultra-realistas com respiração, entonação comercial natural e sotaque brasileiro perfeito.
                  </p>
                </div>

                <div
                  onClick={() => setConfig({ ...config, voiceProvider: 'native' })}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    config.voiceProvider === 'native'
                      ? 'bg-indigo-950/20 border-indigo-500 shadow-subtle'
                      : 'bg-[#141622] border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Mic className="w-4 h-4 text-indigo-400" /> Voz Nativa da Plataforma
                    </span>
                    <span className="text-[10px] bg-white/[0.05] text-zinc-400 px-2 py-0.5 rounded font-mono">
                      Gratuito
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Sintetizador padrão integrado sem necessidade de chave de API externa.
                  </p>
                </div>
              </div>

              {/* Se ElevenLabs: API Key e Seleção de Vozes */}
              {config.voiceProvider === 'elevenlabs' && (
                <div className="space-y-4 p-5 rounded-2xl bg-[#141622] border border-white/[0.08]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Chave da API da ElevenLabs
                    </label>
                    <input
                      type="password"
                      placeholder="Cole sua API Key da ElevenLabs (ex: sk_...)..."
                      value={config.elevenlabsApiKey || ''}
                      onChange={(e) => setConfig({ ...config, elevenlabsApiKey: e.target.value })}
                      className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Vozes Pré-definidas */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Voz Principal do Agente
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {elevenlabsVoices.map(voice => (
                        <div
                          key={voice.id}
                          onClick={() => setConfig({ ...config, voiceName: voice.name, customVoiceId: voice.id })}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            (config.customVoiceId === voice.id || config.voiceName === voice.name)
                              ? 'bg-purple-900/30 border-purple-500 text-white'
                              : 'bg-[#181a29] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/20'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold block">{voice.name}</span>
                            <span className="text-[10px] text-slate-400 italic">"{voice.preview}"</span>
                          </div>
                          {(config.customVoiceId === voice.id || config.voiceName === voice.name) && (
                            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Usar Voice ID Personalizado */}
                  <div className="pt-2 border-t border-white/[0.06] space-y-3">
                    <div 
                      onClick={() => setConfig({ ...config, useCustomVoiceId: !config.useCustomVoiceId })}
                      className="flex items-center justify-between cursor-pointer py-1"
                    >
                      <span className="text-xs font-semibold text-slate-300 select-none">
                        Usar Voice ID Personalizado (Clone de Voz próprio)
                      </span>
                      <InlineToggle
                        checked={config.useCustomVoiceId}
                        onChange={(val) => setConfig({ ...config, useCustomVoiceId: val })}
                      />
                    </div>

                    {config.useCustomVoiceId && (
                      <input
                        type="text"
                        placeholder="Ex: 21m00Tcm4TlvDq8ikWAM..."
                        value={config.customVoiceId || ''}
                        onChange={(e) => setConfig({ ...config, customVoiceId: e.target.value })}
                        className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Configurações de Envio de Áudio */}
            <div className="space-y-4 pt-2 border-t border-white/[0.06]">
              <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
                Configurações de Envio com Áudio
              </label>

              {/* 1. Substituir Texto por Áudio */}
              <ToggleSwitch
                title="Substituir Texto por Áudio"
                description="Envia exclusivamente a mensagem de voz ao cliente sem enviar o texto correspondente."
                checked={config.substituteTextWithAudio}
                onChange={(val) => setConfig({ ...config, substituteTextWithAudio: val })}
              />

              {/* 2. Resposta Automática com Áudio */}
              <ToggleSwitch
                title="Resposta Automática com Áudio"
                description="Sempre que o cliente enviar uma mensagem de voz, responder obrigatoriamente com áudio."
                checked={config.autoReplyWithAudio}
                onChange={(val) => setConfig({ ...config, autoReplyWithAudio: val })}
              />

              {/* 3. Áudio Inteligente (Comprimento Mínimo e Exemplos) */}
              <div className="p-5 rounded-2xl bg-[#141622] border border-white/[0.08] space-y-4">
                <div 
                  onClick={() => setConfig({ ...config, smartAudioEnabled: !config.smartAudioEnabled })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="select-none pr-3">
                    <span className="text-xs font-bold text-white block">Áudio Inteligente</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Gera áudio apenas para respostas explicativas ou parágrafos, economizando créditos em mensagens curtas.
                    </span>
                  </div>
                  <InlineToggle
                    checked={config.smartAudioEnabled}
                    onChange={(val) => setConfig({ ...config, smartAudioEnabled: val })}
                  />
                </div>

                {config.smartAudioEnabled && (
                  <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">Comprimento mínimo para gerar áudio:</span>
                        <span className="font-mono text-purple-400 font-bold">{config.smartAudioMinChars || 70} caracteres</span>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={200}
                        step={10}
                        value={config.smartAudioMinChars || 70}
                        onChange={(e) => setConfig({ ...config, smartAudioMinChars: Number(e.target.value) })}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    {/* Exemplos Visuais Interativos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-[#181a29] border border-white/[0.06] space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-300">Resposta Curta</span>
                          <span className="text-amber-400 text-[10px] font-mono">Texto simples</span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">"Claro! Qual seu e-mail?"</p>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-purple-300">Resposta Média</span>
                          <span className="text-purple-400 text-[10px] font-mono">Gera Áudio 🔊</span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          "Perfeito! Vou verificar a disponibilidade do plano e te envio as opções agora."
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-purple-300">Parágrafo Longo</span>
                          <span className="text-purple-400 text-[10px] font-mono">Gera Áudio 🔊</span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic line-clamp-2">
                          "O plano anual já contempla garantia de 7 dias, conexões simultâneas e suporte exclusivo via WhatsApp."
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: MÍDIAS DA IA (Upload & Gatilhos)                         */}
      {/* ============================================================== */}
      {activeTab === 'media' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>Mídias com Agente de IA</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Cadastre catálogos, vídeos explicativos, áudios e comprovantes com palavras-chave e descrições para a IA enviar automaticamente no chat.
              </p>
            </div>

            {/* Upload Area */}
            <div className="p-6 border-2 border-dashed border-white/10 rounded-2xl bg-[#141622]/50 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto flex items-center justify-center text-blue-400">
                <Upload className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-white">Upload de Mídias para a Inteligência Artificial</p>
                <p className="text-[11px] text-slate-400">
                  Formatos suportados: <span className="text-blue-300 font-mono">JPG, PNG, GIF, WEBP, MP4, MP3, PDF, DOCX</span> (até 50MB)
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <input
                  type="text"
                  placeholder="Descrição e palavras-chave para a IA saber quando enviar (ex: Tabela de Preços Oficial 2026)..."
                  value={mediaDescription}
                  onChange={(e) => setMediaDescription(e.target.value)}
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
                />

                <div>
                  <input
                    type="file"
                    id="ai-media-upload-input"
                    className="hidden"
                    onChange={handleMediaUpload}
                  />
                  <label
                    htmlFor="ai-media-upload-input"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md shadow-blue-600/20"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadingMedia ? 'Enviando arquivo...' : 'Selecionar Arquivo'}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Media List */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Mídias Cadastradas no Repertório ({config.aiMediaList?.length || 0})
              </h4>

              {(!config.aiMediaList || config.aiMediaList.length === 0) ? (
                <div className="p-8 rounded-xl bg-[#141622] border border-white/[0.06] text-center text-xs text-slate-500">
                  Nenhuma mídia cadastrada ainda. Faça upload de arquivos acima para a IA enviar nos momentos certos.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {config.aiMediaList.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-[#141622] border border-white/[0.08] flex flex-col justify-between space-y-3 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                          {item.type === 'image' && <ImageIcon className="w-5 h-5 text-blue-400" />}
                          {item.type === 'video' && <Video className="w-5 h-5 text-purple-400" />}
                          {item.type === 'audio' && <Music className="w-5 h-5 text-emerald-400" />}
                          {item.type === 'document' && <FileText className="w-5 h-5 text-amber-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-white block truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {item.size} • {item.type.toUpperCase()}
                          </span>
                          <p className="text-[11px] text-slate-300 mt-1 line-clamp-2" title={item.description}>
                            🎯 {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visualizar
                        </a>
                        <button
                          onClick={() => handleRemoveMedia(item.id)}
                          className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                          title="Excluir mídia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: POSTAGENS AGENDADAS COM IA EM GRUPOS                    */}
      {/* ============================================================== */}
      {activeTab === 'group_broadcasts' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-pink-400" />
                <span>Postagens Agendadas com IA em Grupos do WhatsApp</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automatize publicações em grupos com frequência periódica. A IA pode gerar conteúdos inéditos a cada postagem!
              </p>
            </div>

            {/* Formulário de Novo Agendamento */}
            <div className="p-5 rounded-2xl bg-[#141622] border border-white/[0.08] space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Criar Nova Programação de Postagem
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Grupo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">Grupo de Destino</label>
                  <select
                    value={newBroadcastGroup}
                    onChange={(e) => setNewBroadcastGroup(e.target.value)}
                    className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-pink-500 cursor-pointer"
                  >
                    <option value="Todos os Grupos">Todos os Grupos</option>
                    <option value="Grupo VIP - Clientes">Grupo VIP - Clientes</option>
                    <option value="Comunidade Leads">Comunidade Leads</option>
                    <option value="Mentoria de Vendas">Mentoria de Vendas</option>
                  </select>
                </div>

                {/* Frequência */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">Frequência da Postagem</label>
                  <select
                    value={newBroadcastFrequency}
                    onChange={(e) => setNewBroadcastFrequency(e.target.value)}
                    className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-pink-500 cursor-pointer"
                  >
                    <option value="daily_09">Diário às 09:00</option>
                    <option value="daily_10">Diário às 10:00</option>
                    <option value="daily_12">Diário às 12:00 (Almoço)</option>
                    <option value="daily_18">Diário às 18:00</option>
                    <option value="weekday_09">Segunda a Sexta às 09:00</option>
                    <option value="monday_09">Toda Segunda-feira às 09:00</option>
                    <option value="friday_17">Toda Sexta-feira às 17:00</option>
                  </select>
                </div>

                {/* Tipo de Conteúdo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">Tipo de Conteúdo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewBroadcastType('ai')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        newBroadcastType === 'ai'
                          ? 'bg-pink-600 border-pink-500 text-white'
                          : 'bg-[#181a29] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Gerar com IA
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBroadcastType('fixed')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        newBroadcastType === 'fixed'
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-[#181a29] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Texto Fixo
                    </button>
                  </div>
                </div>
              </div>

              {/* Mensagem ou Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  {newBroadcastType === 'ai' ? 'Instrução / Prompt para a IA gerar:' : 'Texto da Mensagem:'}
                </label>
                <textarea
                  rows={3}
                  value={newBroadcastContent}
                  onChange={(e) => setNewBroadcastContent(e.target.value)}
                  placeholder={newBroadcastType === 'ai' 
                    ? "Ex: Gere uma dica curta de vendas para WhatsApp estimulando o grupo a engajar..."
                    : "Digite a mensagem exata..."}
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateScheduledBroadcast}
                  className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Agendar Postagem
                </button>
              </div>
            </div>

            {/* Tabela Paginada de Agendamentos (10 por página) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Postagens Programadas ({scheduledList.length})
                </h4>
                <button
                  onClick={fetchScheduledBroadcasts}
                  className="text-slate-400 hover:text-white p-1 text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingScheduled ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              </div>

              {scheduledList.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#141622] border border-white/[0.06] text-center text-xs text-slate-500">
                  Nenhum agendamento ativo. Crie uma postagem periódica acima!
                </div>
              ) : (
                <div className="border border-white/[0.08] rounded-xl overflow-hidden divide-y divide-white/[0.06]">
                  {scheduledList.slice((scheduledPage - 1) * 10, scheduledPage * 10).map((item) => (
                    <div key={item.id} className="p-4 bg-[#141622] flex items-center justify-between text-xs gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.groupName || 'Grupo'}</span>
                          <span className="text-[10px] bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded font-mono">
                            {item.status === 'sent' ? 'Enviado' : 'Agendado'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] truncate">{item.text}</p>
                        <span className="text-[10px] text-slate-500 block">
                          Disparo em: {new Date(item.scheduledAt).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteScheduled(item.id)}
                        className="text-slate-400 hover:text-rose-400 p-2 transition-colors"
                        title="Cancelar agendamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Paginação */}
                  {scheduledList.length > 10 && (
                    <div className="p-3 bg-[#10121d] flex items-center justify-between text-xs text-slate-400">
                      <span>Página {scheduledPage} de {Math.ceil(scheduledList.length / 10)}</span>
                      <div className="flex gap-2">
                        <button
                          disabled={scheduledPage === 1}
                          onClick={() => setScheduledPage(p => p - 1)}
                          className="px-3 py-1 rounded bg-[#181a29] border border-white/10 disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          disabled={scheduledPage >= Math.ceil(scheduledList.length / 10)}
                          onClick={() => setScheduledPage(p => p + 1)}
                          className="px-3 py-1 rounded bg-[#181a29] border border-white/10 disabled:opacity-40"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 7: GOOGLE CALENDAR (Photos 2 a 6)                          */}
      {/* ============================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Card de Conexão com Google Calendar */}
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Google Calendar</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Conecte sua conta do Google Calendar para permitir que o Agente de IA consulte disponibilidade e agende reuniões automaticamente.
                </p>
              </div>
            </div>

            {/* Status de Conexão */}
            {!config.googleCalendar?.connected ? (
              <div className="p-6 rounded-2xl bg-[#141622] border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Conta não conectada</span>
                    <span className="text-[11px] text-slate-400">
                      Conecte sua agenda para ativar consultas e agendamentos inteligentes.
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleConnectCalendar}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" /> Conectar Google Calendar
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Google Calendar Conectado</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                          Sincronizado
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {config.googleCalendar.email || 'contato@nyxzap.com.br'} • Última sincronização: {config.googleCalendar.lastSyncAt}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncCalendar}
                      className="px-3.5 py-2 bg-[#141622] hover:bg-white/[0.05] text-slate-300 border border-white/10 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                    <button
                      onClick={handleDisconnectCalendar}
                      className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>

                {/* Métricas rápidas da agenda */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
                  <div className="p-3 rounded-xl bg-[#141622] border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Vagas Livres Hoje</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {config.googleCalendar.freeSlotsCount ?? 7} horários
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#141622] border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Reuniões Agendadas Hoje</span>
                    <span className="text-lg font-bold text-indigo-400 font-mono">
                      {config.googleCalendar.scheduledMeetingsCount ?? 0} reuniões
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Toggle: Permitir agendamentos automáticos pela IA */}
            <ToggleSwitch
              title="Permitir que a IA faça agendamentos automáticos na agenda"
              description="A IA pode verificar disponibilidade e criar eventos no Google Calendar diretamente pelo WhatsApp."
              checked={config.googleCalendar?.autoScheduleEnabled || false}
              onChange={(val) => setConfig({
                ...config,
                googleCalendar: { ...config.googleCalendar, autoScheduleEnabled: val }
              })}
            />

            {/* Banner de Aviso: Base de Conhecimento */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed">
                <span className="font-bold text-amber-300 block mb-0.5">Aviso Importante:</span>
                Para que a IA ofereça agendamentos na conversa, lembre-se de instruí-la no System Prompt ou na Base de Conhecimento que ela possui acesso à agenda e pode marcar compromissos para o cliente.
              </div>
            </div>

            {/* Parâmetros de Agendamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
              {/* Antecedência Mínima */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#141622] border border-white/[0.06]">
                <label className="text-xs font-semibold text-slate-300 block">Antecedência mínima para agendamento</label>
                <select
                  value={config.googleCalendar?.minBookingLeadTimeHours || 1}
                  onChange={(e) => setConfig({
                    ...config,
                    googleCalendar: { ...config.googleCalendar, minBookingLeadTimeHours: Number(e.target.value) }
                  })}
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={1}>1 hora de antecedência</option>
                  <option value={2}>2 horas de antecedência</option>
                  <option value={4}>4 horas de antecedência</option>
                  <option value={24}>24 horas (1 dia antes)</option>
                  <option value={48}>48 horas (2 dias antes)</option>
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Impede agendamentos em cima da hora sem tempo hábil de preparação.
                </span>
              </div>

              {/* Duração Padrão */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#141622] border border-white/[0.06]">
                <label className="text-xs font-semibold text-slate-300 block">Duração padrão da reunião</label>
                <select
                  value={config.googleCalendar?.defaultMeetingDurationMinutes || 45}
                  onChange={(e) => setConfig({
                    ...config,
                    googleCalendar: { ...config.googleCalendar, defaultMeetingDurationMinutes: Number(e.target.value) }
                  })}
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos (Recomendado)</option>
                  <option value={60}>60 minutos (1 hora)</option>
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Tempo reservado no bloco da sua agenda do Google.
                </span>
              </div>

              {/* Mensagem Personalizada de Confirmação */}
              <div className="space-y-2 p-4 rounded-xl bg-[#141622] border border-white/[0.06] md:col-span-2">
                <div 
                  onClick={() => setConfig({
                    ...config,
                    googleCalendar: { 
                      ...config.googleCalendar, 
                      customConfirmationMessageEnabled: !(config.googleCalendar?.customConfirmationMessageEnabled !== false) 
                    }
                  })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs font-bold text-white select-none">Mensagem personalizada de confirmação</span>
                  <InlineToggle
                    checked={config.googleCalendar?.customConfirmationMessageEnabled !== false}
                    onChange={(val) => setConfig({
                      ...config,
                      googleCalendar: { ...config.googleCalendar, customConfirmationMessageEnabled: val }
                    })}
                  />
                </div>
                <input
                  type="text"
                  value={config.googleCalendar?.customConfirmationMessage || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    googleCalendar: { ...config.googleCalendar, customConfirmationMessage: e.target.value }
                  })}
                  placeholder="Ex: Sua reunião foi confirmada com sucesso! Enviamos os detalhes e o link do Google Meet."
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Título Personalizado do Evento */}
              <div className="space-y-2 p-4 rounded-xl bg-[#141622] border border-white/[0.06] md:col-span-2">
                <div 
                  onClick={() => setConfig({
                    ...config,
                    googleCalendar: { 
                      ...config.googleCalendar, 
                      customMeetingTitleEnabled: !(config.googleCalendar?.customMeetingTitleEnabled !== false) 
                    }
                  })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs font-bold text-white select-none">Título personalizado do evento</span>
                  <InlineToggle
                    checked={config.googleCalendar?.customMeetingTitleEnabled !== false}
                    onChange={(val) => setConfig({
                      ...config,
                      googleCalendar: { ...config.googleCalendar, customMeetingTitleEnabled: val }
                    })}
                  />
                </div>
                <input
                  type="text"
                  value={config.googleCalendar?.customMeetingTitle || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    googleCalendar: { ...config.googleCalendar, customMeetingTitle: e.target.value }
                  })}
                  placeholder="Ex: Reunião Comercial - NyxZap & {cliente}"
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Exigir e-mail do cliente */}
              <div className="md:col-span-2">
                <ToggleSwitch
                  title="Exigir e-mail do cliente para agendar"
                  description="A IA solicitará o e-mail antes de fechar a reunião para enviar o convite com link do Google Meet."
                  checked={config.googleCalendar?.requireEmailForBooking || false}
                  onChange={(val) => setConfig({
                    ...config,
                    googleCalendar: { ...config.googleCalendar, requireEmailForBooking: val }
                  })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 8: BASE DE CONHECIMENTO                                    */}
      {/* ============================================================== */}
      {activeTab === 'knowledge' && (
        <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-white">Base de Conhecimento (PDF, DOCX, TXT)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Suba manuais de produtos, FAQs, tabelas de preços e playbooks para o Agente de IA consultar instantaneamente.
            </p>
          </div>

          <div className="p-8 border-2 border-dashed border-white/10 rounded-2xl text-center space-y-3 bg-[#141622]/50">
            <FileText className="w-10 h-10 text-cyan-400 mx-auto" />
            <div>
              <p className="text-xs font-bold text-white">Clique para selecionar arquivos ou arraste aqui</p>
              <p className="text-[11px] text-slate-400">Suporta PDF, DOCX, TXT (até 25MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              id="file-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const newDoc = {
                    id: String(Date.now()),
                    name: file.name,
                    size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
                    uploadedAt: new Date().toLocaleDateString('pt-BR'),
                    type: file.name.split('.').pop() || 'pdf'
                  };
                  setConfig({ ...config, knowledgeDocs: [...config.knowledgeDocs, newDoc] });
                }
              }}
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-cyan-600/20"
            >
              Fazer Upload de Documento
            </label>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase">Documentos Ativos na Memória da IA</h4>
            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden">
              {config.knowledgeDocs.map(doc => (
                <div key={doc.id} className="p-3.5 bg-[#141622] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-bold text-white">{doc.name}</div>
                      <div className="text-[10px] text-slate-500">{doc.size} • Adicionado em {doc.uploadedAt}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, knowledgeDocs: config.knowledgeDocs.filter(d => d.id !== doc.id) })}
                    className="text-slate-500 hover:text-rose-400 text-xs transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 9: PLAYGROUND DE TESTE                                      */}
      {/* ============================================================== */}
      {activeTab === 'playground' && (
        <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Playground de Teste em Tempo Real</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Faça perguntas ao seu agente e inspecione o raciocínio interno do modelo e as citações da base de conhecimento.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase">Pergunta do Cliente (Simulação)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="flex-1 bg-[#141622] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
              <button
                onClick={handleTestPlayground}
                disabled={testLoading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{testLoading ? 'Processando Raciocínio...' : 'Testar Agente'}</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div className="space-y-4 pt-2">
              {/* Reasoning Inspector */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 uppercase font-mono">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Inspeção do Raciocínio Interno da IA
                </span>
                <p className="text-xs text-purple-100/90 whitespace-pre-line font-mono bg-[#10121d] p-3 rounded-lg leading-relaxed">
                  {testResult.reasoning}
                </p>
              </div>

              {/* Citations */}
              {testResult.citations && testResult.citations.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="font-bold text-cyan-400">Fontes consultadas:</span>
                  {testResult.citations.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Final Output */}
              <div className="p-4 rounded-xl bg-[#141622] border border-white/[0.08] space-y-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                  <Bot className="w-4 h-4" />
                  Resposta Final Enviada ao WhatsApp
                </span>
                <p className="text-xs text-slate-100 bg-[#10121d] p-4 rounded-lg leading-relaxed">
                  {testResult.response}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
