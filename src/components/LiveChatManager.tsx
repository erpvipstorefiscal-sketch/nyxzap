import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Tag, 
  Bot, 
  Workflow, 
  Calendar, 
  Edit3, 
  UserCheck, 
  Clock, 
  FileText, 
  Sparkles, 
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Download,
  Paperclip,
  Image as ImageIcon,
  Video,
  Mic,
  AtSign,
  X
} from 'lucide-react';
import { ChatConversation, LeadTag, ChatMessage, WhatsAppGroup, ScheduledBroadcast } from '../types';
import { confirmDialog, alertDialog } from './ModalConfirm';

export const LiveChatManager: React.FC = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real WhatsApp Groups state
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMessageText, setGroupMessageText] = useState('');
  const [isSendingGroupMessage, setIsSendingGroupMessage] = useState(false);

  // Group Broadcast extensions: Attachments, Mentions, Scheduling, Export
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<ScheduledBroadcast[]>([]);
  const [broadcastMedia, setBroadcastMedia] = useState<{ url: string; type: 'image' | 'video' | 'audio' | 'document'; fileName: string } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mentionAll, setMentionAll] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [isExtractingContacts, setIsExtractingContacts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Follow-up CRM state
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpText, setFollowUpText] = useState('');
  const [followUpMedia, setFollowUpMedia] = useState<{ url: string; type: 'image' | 'video' | 'audio' | 'document'; fileName: string } | null>(null);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [isUploadingFollowUpMedia, setIsUploadingFollowUpMedia] = useState(false);
  const followUpFileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGroups = async () => {
    setIsSyncingGroups(true);
    try {
      const res = await fetch('/api/whatsapp/groups');
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
        if (data.groups.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data.groups[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar grupos:', err);
    } finally {
      setIsSyncingGroups(false);
    }
  };

  // Fetch chats from server
  const fetchChats = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/chats');
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && (!activeChatId || !data.some((c: any) => c.id === activeChatId))) {
        setActiveChatId(data[0].id);
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchScheduledBroadcasts();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      try {
        const { type } = JSON.parse(event.data);
        if (type === 'chat_message' || type === 'chat_update' || type === 'chat_deleted') {
          fetchChats();
        }
      } catch (err) {
        console.error(err);
      }
    };

    const interval = setInterval(fetchChats, 3000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [activeChatId]);

  const activeChat = conversations.find(c => c.id === activeChatId) || conversations[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  // Filtered list
  const filteredChats = conversations.filter(c => {
    const matchesTag = filterTag === 'todos' || c.tag === filterTag;
    const matchesSearch = c.leadName.toLowerCase().includes(searchTerm.toLowerCase()) || c.leadPhone.includes(searchTerm);
    return matchesTag && matchesSearch;
  });

  // Sync follow-up fields when active chat changes
  useEffect(() => {
    if (activeChat) {
      setFollowUpDate(activeChat.followUpDate || '');
      setFollowUpText(activeChat.followUpText || '');
      if (activeChat.followUpMediaPath) {
        setFollowUpMedia({
          url: activeChat.followUpMediaPath,
          type: (activeChat.followUpMediaType as any) || 'document',
          fileName: activeChat.followUpFileName || 'arquivo'
        });
      } else {
        setFollowUpMedia(null);
      }
    }
  }, [activeChatId, activeChat?.followUpDate, activeChat?.followUpText, activeChat?.followUpMediaPath]);

  const handleSendMessage = async () => {
    if (!replyText.trim() || !activeChat) return;

    const textToSend = replyText.trim();
    setReplyText('');

    try {
      // Optimistically switch to Manual Mode in UI immediately
      setConversations(prev => prev.map(c => 
        c.id === activeChat.id ? { ...c, botFlowActive: false, aiAgentActive: false } : c
      ));

      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend })
      });
      fetchChats();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({
      title: 'Excluir Conversa',
      message: 'Deseja realmente excluir esta conversa do histórico? Todas as mensagens desta conversa serão removidas.',
      variant: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/chats/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setConversations(conversations.filter(c => c.id !== id));
      if (activeChatId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        setActiveChatId(remaining[0]?.id || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTag = async (tag: LeadTag) => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      });
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNotes = async (internalNotes: string) => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes })
      });
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!activeChat) return;
    if (!followUpDate) {
      await alertDialog({
        title: 'Data Obrigatória',
        message: 'Por favor, selecione a data e o horário para o disparo automático do follow-up.',
        variant: 'danger',
        confirmText: 'Entendi'
      });
      return;
    }
    if (!followUpText.trim() && !followUpMedia) {
      await alertDialog({
        title: 'Mensagem Obrigatória',
        message: 'Digite uma mensagem ou anexe uma mídia (foto, vídeo, áudio ou documento) para o follow-up.',
        variant: 'danger',
        confirmText: 'Entendi'
      });
      return;
    }

    setIsSavingFollowUp(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpDate,
          followUpText: followUpText.trim(),
          followUpMediaPath: followUpMedia?.url || '',
          followUpMediaType: followUpMedia?.type || '',
          followUpFileName: followUpMedia?.fileName || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        await alertDialog({
          title: 'Follow-up Agendado!',
          message: `O disparo automático foi programado com sucesso para ${new Date(followUpDate).toLocaleString('pt-BR')}!`,
          variant: 'success',
          confirmText: 'OK'
        });
        fetchChats();
      } else {
        await alertDialog({
          title: 'Erro no Agendamento',
          message: data.error || 'Falha ao agendar follow-up.',
          variant: 'danger',
          confirmText: 'OK'
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const handleCancelFollowUp = async () => {
    if (!activeChat) return;
    const ok = await confirmDialog({
      title: 'Cancelar Follow-up',
      message: 'Deseja realmente cancelar este follow-up agendado?',
      confirmText: 'Sim, Cancelar',
      cancelText: 'Voltar',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/follow-up`, { method: 'DELETE' });
      setFollowUpDate('');
      setFollowUpText('');
      setFollowUpMedia(null);
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadFollowUpMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      await alertDialog({
        title: 'Arquivo Muito Grande',
        message: 'O arquivo não pode ultrapassar 50MB.',
        variant: 'danger',
        confirmText: 'Entendi'
      });
      return;
    }

    setIsUploadingFollowUpMedia(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/flow/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';

        setFollowUpMedia({
          url: data.url,
          type: mediaType,
          fileName: data.filename || file.name
        });
      } else {
        await alertDialog({
          title: 'Erro no Upload',
          message: data.error || 'Falha ao enviar arquivo.',
          variant: 'danger',
          confirmText: 'OK'
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingFollowUpMedia(false);
      if (followUpFileInputRef.current) followUpFileInputRef.current.value = '';
    }
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || !activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadName: editedName.trim() })
      });
      setIsEditingName(false);
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  // Mutually exclusive automation mode: 'flow' | 'ai' | 'none'
  const setChatAutomationMode = async (mode: 'flow' | 'ai' | 'none') => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          aiAgentActive: mode === 'ai',
          botFlowActive: mode === 'flow'
        })
      });
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchScheduledBroadcasts = async () => {
    try {
      const res = await fetch('/api/whatsapp/groups/scheduled');
      const data = await res.json();
      if (data.success && Array.isArray(data.broadcasts)) {
        setScheduledBroadcasts(data.broadcasts);
      }
    } catch (err) {
      console.error('Erro ao buscar disparos agendados:', err);
    }
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      await alertDialog({
        title: 'Arquivo Muito Grande',
        message: 'O arquivo não pode ultrapassar 50MB.',
        variant: 'danger',
        confirmText: 'Entendi'
      });
      return;
    }

    setIsUploadingMedia(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/flow/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';

        setBroadcastMedia({
          url: data.url,
          type: mediaType,
          fileName: data.filename || file.name
        });
      } else {
        await alertDialog({
          title: 'Erro no Upload',
          message: data.error || 'Falha ao enviar arquivo.',
          variant: 'danger',
          confirmText: 'OK'
        });
      }
    } catch (err: any) {
      console.error('[Upload Error]', err);
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportContacts = async (group: WhatsAppGroup) => {
    setIsExtractingContacts(true);
    try {
      // 1. Consultar endpoint com metadata interativa e resolução reversa de LID para número real
      const res = await fetch(`/api/whatsapp/groups/${encodeURIComponent(group.id)}/contacts`);
      const data = await res.json();

      let phoneNumbers: string[] = [];

      if (data.success && Array.isArray(data.phones) && data.phones.length > 0) {
        phoneNumbers = data.phones;
      } else {
        // Fallback: usar participantes locais caso o endpoint falhe
        const participants = group.participants || [];
        phoneNumbers = participants
          .map(p => {
            const raw = p.phone || (p.id?.endsWith('@s.whatsapp.net') ? p.id.split('@')[0] : '');
            return raw.replace(/\D/g, '');
          })
          .filter(p => p.length >= 8 && !p.startsWith('175')); // evita LIDs internos do Baileys
      }

      // Remover duplicados e manter somente números válidos
      const uniquePhones = Array.from(new Set(phoneNumbers)).filter(
        num => num.length >= 8 && !(num.startsWith('175') && num.length >= 15)
      );

      if (uniquePhones.length === 0) {
        await alertDialog({
          title: 'Nenhum Número Identificado',
          message: 'Não foi possível extrair números de telefone válidos para este grupo (os membros podem estar com privacidade de número oculta ou o WhatsApp ainda não sincronizou os dados).',
          variant: 'danger',
          confirmText: 'OK'
        });
        return;
      }

      const lines = [
        `# NyxZap - Contatos Extraídos do Grupo`,
        `# Nome do Grupo: ${group.name}`,
        `# ID do Grupo: ${group.id}`,
        `# Total de Telefones Extraídos: ${uniquePhones.length}`,
        `# Data de Extração: ${new Date().toLocaleString('pt-BR')}`,
        `# ----------------------------------------------------`,
        ``,
        ...uniquePhones.map(num => `+${num}`)
      ];

      const content = lines.join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = group.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      link.download = `contatos_${safeName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await alertDialog({
        title: 'Contatos Extraídos com Sucesso!',
        message: `${uniquePhones.length} número(s) de telefone reais foram extraídos e salvos no arquivo TXT.`,
        variant: 'success',
        confirmText: 'OK'
      });
    } catch (err: any) {
      console.error('[Export Contacts Error]', err);
      await alertDialog({
        title: 'Erro na Extração',
        message: 'Falha ao buscar participantes do grupo: ' + (err.message || err),
        variant: 'danger',
        confirmText: 'OK'
      });
    } finally {
      setIsExtractingContacts(false);
    }
  };

  const handleToggleMentionAll = (checked: boolean) => {
    setMentionAll(checked);
  };

  const handleReuseBroadcast = (b: ScheduledBroadcast) => {
    setGroupMessageText(b.text || '');
    if (b.mediaPath) {
      setBroadcastMedia({
        url: b.mediaPath,
        type: (b.mediaType as any) || 'document',
        fileName: b.fileName || 'arquivo'
      });
    } else {
      setBroadcastMedia(null);
    }
    setMentionAll(Boolean(b.mentionAll));
    setIsScheduling(true);

    // Set default date to +1 hour from now
    const nextDate = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setScheduledDate(`${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}T${pad(nextDate.getHours())}:${pad(nextDate.getMinutes())}`);

    alertDialog({
      title: 'Disparo Carregado!',
      message: 'Os dados da mensagem foram carregados no formulário. Ajuste a data e horário desejado e clique em "Confirmar Agendamento"!',
      variant: 'success',
      confirmText: 'Entendi'
    });
  };

  const handleDeleteScheduledBroadcast = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Excluir Disparo',
      message: 'Tem certeza que deseja excluir este disparo do histórico/agendamentos?',
      confirmText: 'Sim, Excluir',
      cancelText: 'Voltar',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await fetch(`/api/whatsapp/groups/scheduled/${id}`, { method: 'DELETE' });
      fetchScheduledBroadcasts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendGroupMessage = async () => {
    if (!selectedGroupId) return;
    if (!groupMessageText.trim() && !broadcastMedia) {
      await alertDialog({
        title: 'Mensagem Vazia',
        message: 'Digite um texto ou anexe uma mídia para realizar o disparo no grupo.',
        variant: 'danger',
        confirmText: 'OK'
      });
      return;
    }

    if (isScheduling && !scheduledDate) {
      await alertDialog({
        title: 'Data Obrigatória',
        message: 'Selecione a data e o horário para o agendamento do disparo.',
        variant: 'danger',
        confirmText: 'OK'
      });
      return;
    }

    setIsSendingGroupMessage(true);
    const activeGroup = groups.find(g => g.id === selectedGroupId);

    try {
      const res = await fetch('/api/whatsapp/groups/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          groupName: activeGroup?.name || 'Grupo WhatsApp',
          text: groupMessageText.trim(),
          mediaPath: broadcastMedia?.url,
          mediaType: broadcastMedia?.type,
          fileName: broadcastMedia?.fileName,
          mentionAll,
          scheduledAt: isScheduling ? scheduledDate : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setGroupMessageText('');
        setBroadcastMedia(null);
        setMentionAll(false);
        setIsScheduling(false);
        setScheduledDate('');
        fetchScheduledBroadcasts();

        await alertDialog({
          title: data.scheduled ? 'Disparo Agendado!' : 'Comunicado Enviado!',
          message: data.message || 'Operação realizada com sucesso no WhatsApp.',
          variant: 'success',
          confirmText: 'OK'
        });
      } else {
        await alertDialog({
          title: 'Erro no Disparo',
          message: data.error || 'Falha ao processar comunicado.',
          variant: 'danger',
          confirmText: 'OK'
        });
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem para o grupo:', err);
    } finally {
      setIsSendingGroupMessage(false);
    }
  };

  const getTagBadge = (tag: LeadTag) => {
    switch (tag) {
      case 'quente':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Quente</span>;
      case 'morno':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Morno</span>;
      case 'frio':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Frio</span>;
      case 'comprou':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Comprou</span>;
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0D0F17] border-0 overflow-hidden animate-fadeIn">
      {/* 1. LEFT SIDEBAR: CONVERSATIONS LIST */}
      <div className="w-80 border-r border-white/[0.06] bg-[#0E1017] flex flex-col shrink-0">
        <div className="p-3.5 border-b border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Conversas WhatsApp</span>
            <button 
              onClick={fetchChats}
              className={`p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all border border-white/[0.06] ${
                isRefreshing ? 'animate-spin text-indigo-400' : ''
              }`}
              title="Atualizar conversas agora"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar contato ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B0C10] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 text-[11px] font-medium">
            {['todos', 'grupos', 'quente', 'morno', 'frio', 'comprou'].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFilterTag(t);
                  if (t === 'grupos') fetchGroups();
                }}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all flex items-center gap-1.5 ${
                  filterTag === t 
                    ? 'bg-white/[0.1] text-white border border-white/[0.12] shadow-sm' 
                    : 'bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                {t === 'grupos' && <Users className="w-3 h-3 text-emerald-400" />}
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations or Groups List */}
        {filterTag === 'grupos' ? (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            <div className="p-2.5 bg-[#151824]/40 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Grupos WhatsApp ({groups.length})
              </span>
              <button
                onClick={fetchGroups}
                disabled={isSyncingGroups}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                title="Sincronizar grupos do WhatsApp"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingGroups ? 'animate-spin' : ''}`} />
                <span>{isSyncingGroups ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            </div>
            {groups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Nenhum grupo sincronizado.</p>
                <p className="text-[10px] text-slate-400">Verifique se o WhatsApp está conectado no menu Conexões.</p>
                <button
                  onClick={fetchGroups}
                  disabled={isSyncingGroups}
                  className="mt-2 px-3 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-xs font-bold transition-all border border-emerald-500/30"
                >
                  {isSyncingGroups ? 'Sincronizando...' : 'Sincronizar Grupos Agora'}
                </button>
              </div>
            ) : (
              groups.map((g) => {
                const isSelected = selectedGroupId === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1.5 select-none relative group ${
                      isSelected ? 'bg-emerald-950/20 border-l-4 border-emerald-500' : 'hover:bg-[#151824]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate max-w-[170px] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {g.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {g.participantsCount} membros
                      </span>
                    </div>
                    {g.desc ? (
                      <p className="text-[10px] text-slate-400 truncate">
                        {g.desc}
                      </p>
                    ) : (
                      <p className="text-[9px] text-slate-600 font-mono truncate">
                        {g.id}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mx-auto text-zinc-500">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-zinc-300">Nenhuma conversa encontrada</p>
                  <p className="text-[11px] text-zinc-500 max-w-[200px] mx-auto leading-relaxed">As conversas ativas do WhatsApp sincronizam aqui automaticamente.</p>
                </div>
              </div>
            ) : (
              filteredChats.map((c) => {
                const isSelected = activeChat && c.id === activeChat.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveChatId(c.id);
                      setEditedName(c.leadName);
                      setIsEditingName(false);
                    }}
                    className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1.5 select-none relative group border-b border-white/[0.04] ${
                      isSelected ? 'bg-white/[0.04] border-l-2 border-indigo-500' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white truncate max-w-[140px] tracking-tight">
                        {c.leadName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-mono">{c.lastMessageTime}</span>
                        <button
                          onClick={(e) => handleDeleteChat(c.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 rounded transition-all"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-400 truncate max-w-[170px] leading-snug">
                        {c.lastMessage}
                      </p>
                      {getTagBadge(c.tag)}
                    </div>

                    {/* Exclusively show only ONE automation state badge */}
                    <div className="flex items-center gap-1.5 pt-1 text-[9px]">
                      {c.botFlowActive ? (
                        <span className="flex items-center gap-1 text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <Workflow className="w-3 h-3 text-amber-400" /> Bot Fluxo
                        </span>
                      ) : c.aiAgentActive ? (
                        <span className="flex items-center gap-1 text-indigo-300 font-medium bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          <Bot className="w-3 h-3 text-indigo-400" /> Agente IA
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <UserCheck className="w-3 h-3 text-emerald-400" /> Manual
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 2. CENTER: LIVE CHAT OR GROUP DETAILS */}
      {filterTag === 'grupos' ? (
        (() => {
          const activeGroup = groups.find(g => g.id === selectedGroupId) || groups[0];
          return activeGroup ? (
            <div className="flex-1 flex flex-col bg-[#090a0f]">
              <div className="p-3.5 border-b border-slate-800 bg-[#0f111a] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-bold text-white text-base shadow-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      {activeGroup.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span>{activeGroup.participantsCount} participantes</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-bold">Grupo WhatsApp</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportContacts(activeGroup)}
                    disabled={isExtractingContacts}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/25 transition-all shadow-sm disabled:opacity-50"
                    title="Exportar todos os números dos participantes deste grupo em formato .TXT"
                  >
                    <Download className={`w-3.5 h-3.5 ${isExtractingContacts ? 'animate-bounce' : ''}`} />
                    <span>{isExtractingContacts ? 'Extraindo Contatos...' : 'Extrair Contatos (.TXT)'}</span>
                  </button>

                  <button
                    onClick={fetchGroups}
                    disabled={isSyncingGroups}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-[#151824] text-slate-300 border border-slate-700 hover:text-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGroups ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Informações do Grupo */}
                <div className="bg-[#10111a] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Informações do Grupo
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      ID: <span className="font-mono text-slate-300">{activeGroup.id}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#151824] p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total de Membros</span>
                      <span className="text-lg font-bold text-emerald-400">{activeGroup.participantsCount} membros</span>
                    </div>
                    <div className="bg-[#151824] p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Exportação</span>
                      <span className="text-xs font-medium text-slate-300">Pronto para extrair contatos em TXT</span>
                    </div>
                  </div>
                  {activeGroup.desc && (
                    <div className="bg-[#151824] p-3.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Descrição do Grupo</span>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{activeGroup.desc}</p>
                    </div>
                  )}
                </div>

                {/* Disparo de Comunicado no Grupo */}
                <div className="bg-[#10111a] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Send className="w-4 h-4 text-emerald-400" />
                      Disparo de Comunicado no Grupo
                    </h4>
                    <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {isScheduling ? '📅 Modo Agendamento' : '⚡ Disparo Imediato'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Transmita comunicados, fotos, vídeos, áudios ou documentos para todos os membros deste grupo.
                  </p>

                  {/* Input de arquivo invisível */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleUploadMedia}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />

                  {/* Anexos de Mídia */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
                      <Paperclip className="w-3.5 h-3.5" /> Anexar:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*';
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={isUploadingMedia}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                      <span>Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'video/*';
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={isUploadingMedia}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <Video className="w-3.5 h-3.5 text-rose-400" />
                      <span>Vídeo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'audio/*';
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={isUploadingMedia}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <Mic className="w-3.5 h-3.5 text-violet-400" />
                      <span>Áudio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={isUploadingMedia}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#151824] hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Documento</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGroupMessageText(prev => {
                          if (!prev.includes('@todos')) {
                            return (prev.trim() + ' @todos ').trimStart();
                          }
                          return prev;
                        });
                        setMentionAll(true);
                        setShowMentionSuggestions(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Inserir marcação @todos no grupo"
                    >
                      <AtSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Marcar @todos</span>
                    </button>

                    {isUploadingMedia && (
                      <span className="text-xs text-purple-400 flex items-center gap-1 ml-2">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Fazendo upload...
                      </span>
                    )}
                  </div>

                  {/* Prévia da mídia anexada */}
                  {broadcastMedia && (
                    <div className="bg-[#151824] border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {broadcastMedia.type === 'image' && <ImageIcon className="w-4 h-4 text-pink-400" />}
                        {broadcastMedia.type === 'video' && <Video className="w-4 h-4 text-rose-400" />}
                        {broadcastMedia.type === 'audio' && <Mic className="w-4 h-4 text-violet-400" />}
                        {broadcastMedia.type === 'document' && <FileText className="w-4 h-4 text-amber-400" />}
                        <div>
                          <span className="text-xs font-bold text-white block">{broadcastMedia.fileName}</span>
                          <span className="text-[10px] text-purple-300 capitalize">Anexo tipo {broadcastMedia.type}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setBroadcastMedia(null)}
                        className="p-1 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                        title="Remover anexo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Sugestão @todos idêntica ao WhatsApp (Foto e Vídeo) */}
                  {showMentionSuggestions && (
                    <div className="bg-[#181b29] border border-emerald-500/40 rounded-2xl p-1.5 shadow-2xl shadow-black/80 animate-fadeIn backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => {
                          setGroupMessageText(prev => {
                            if (prev.endsWith('@')) {
                              return prev.slice(0, -1) + '@todos ';
                            } else if (prev.includes('@') && !prev.includes('@todos')) {
                              return prev.replace(/@([^\s]*)$/, '@todos ');
                            } else if (!prev.includes('@todos')) {
                              return (prev.trim() + ' @todos ').trimStart();
                            }
                            return prev;
                          });
                          setMentionAll(true);
                          setShowMentionSuggestions(false);
                        }}
                        className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-emerald-500/15 text-left transition-all border border-transparent hover:border-emerald-500/30 group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-emerald-400 transition-all shadow-inner">
                          <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white tracking-wide">todos</span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                              @todos
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">
                            Mencione todos os membros do grupo
                          </p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Campo de Texto do Comunicado */}
                  <div className="relative">
                    <textarea
                      rows={4}
                      placeholder="Digite seu comunicado ou mensagem para o grupo (digite @ para selecionar 'todos')..."
                      value={groupMessageText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGroupMessageText(val);
                        if (/(?:^|\s)@[^\s]*$/.test(val) && !val.includes('@todos')) {
                          setShowMentionSuggestions(true);
                        } else {
                          setShowMentionSuggestions(false);
                        }
                        if (val.includes('@todos')) {
                          setMentionAll(true);
                        }
                      }}
                      className="w-full bg-[#151824] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Indicador de @todos ativo */}
                  {mentionAll && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-emerald-300">
                      <span className="flex items-center gap-1.5 font-bold">
                        <AtSign className="w-4 h-4 text-emerald-400" />
                        <span>Marcação @todos ativada:</span>
                        <span className="font-normal text-slate-300">uma nova mensagem "@todos" será enviada 2s após o comunicado marcando todos os membros.</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setMentionAll(false)}
                        className="text-slate-400 hover:text-rose-400 font-bold px-1.5 py-0.5"
                        title="Desativar marcação @todos"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Controles: Marcar @todos e Agendamento */}
                  <div className="bg-[#151824]/60 border border-slate-800 rounded-xl p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Checkbox @todos */}
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={mentionAll}
                          onChange={(e) => handleToggleMentionAll(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-0 bg-[#0f111a] border-slate-700"
                        />
                        <span className="flex items-center gap-1 font-bold">
                          <AtSign className="w-3.5 h-3.5 text-emerald-400" />
                          Marcar @todos no grupo
                        </span>
                        <span className="text-[10px] text-slate-400">(disparo 2s após a mensagem)</span>
                      </label>

                      {/* Alternador Enviar Agora vs Agendar */}
                      <div className="flex items-center gap-1 bg-[#0f111a] p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsScheduling(false)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            !isScheduling
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Enviar Agora
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsScheduling(true)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                            isScheduling
                              ? 'bg-purple-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          Agendar Disparo
                        </button>
                      </div>
                    </div>

                    {/* Campo de Data/Hora quando Agendamento estiver ativo */}
                    {isScheduling && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-xs text-purple-300 font-bold flex items-center gap-1 shrink-0">
                          <Clock className="w-3.5 h-3.5" /> Escolha data e horário de Brasília:
                        </span>
                        <input
                          type="datetime-local"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="bg-[#0f111a] border border-purple-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400 flex-1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSendGroupMessage}
                      disabled={isSendingGroupMessage || (!groupMessageText.trim() && !broadcastMedia)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                        isScheduling
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      } disabled:opacity-50`}
                    >
                      {isSendingGroupMessage ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : isScheduling ? (
                        <>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Confirmar Agendamento</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Comunicado Agora</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Lista de Disparos Agendados para este Grupo */}
                {scheduledBroadcasts.filter(b => b.groupId === activeGroup.id).length > 0 && (
                  <div className="bg-[#10111a] border border-slate-800 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      Disparos Agendados e Histórico ({scheduledBroadcasts.filter(b => b.groupId === activeGroup.id).length})
                    </h4>
                    <div className="space-y-2.5">
                      {scheduledBroadcasts.filter(b => b.groupId === activeGroup.id).map(b => (
                        <div
                          key={b.id}
                          className="bg-[#151824] border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5 transition-all shadow-sm"
                        >
                          {/* Linha Superior: Status, Data, Badges e Botões na Direita */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.status === 'pending'
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : b.status === 'sent'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {b.status === 'pending' ? '🕒 Agendado' : b.status === 'sent' ? '✓ Enviado' : '✕ Falhou'}
                              </span>
                              <span className="text-[11px] text-slate-300 font-mono">
                                {new Date(b.scheduledAt).toLocaleString('pt-BR')}
                              </span>
                              {b.mentionAll && (
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                  <AtSign className="w-3 h-3" /> todos
                                </span>
                              )}
                              {b.mediaType && (
                                <span className="text-[10px] text-pink-400 font-bold bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">
                                  📎 {b.mediaType}
                                </span>
                              )}
                            </div>

                            {/* Botões de Ação na Direita */}
                            <div className="flex items-center gap-2 ml-auto shrink-0">
                              <button
                                onClick={() => handleReuseBroadcast(b)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e2235] hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/30 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                                title="Reaproveitar esta mensagem e reagendar com nova data"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                                <span>Reaproveitar / Reagendar</span>
                              </button>

                              <button
                                onClick={() => handleDeleteScheduledBroadcast(b.id)}
                                className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                title="Excluir este disparo do histórico"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Linha Inferior: Conteúdo do Texto / Arquivo */}
                          <div className="bg-[#0f111a] border border-slate-800/80 rounded-lg p-2.5">
                            <p className="text-xs text-slate-300 break-words leading-relaxed whitespace-pre-wrap">
                              {b.text || (b.fileName ? `Arquivo: ${b.fileName}` : 'Disparo de mídia')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
              <Users className="w-12 h-12 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">Nenhum grupo do WhatsApp selecionado.</p>
              <p className="text-xs max-w-sm">Conecte seu WhatsApp e clique em "Sincronizar" para listar seus grupos.</p>
            </div>
          );
        })()
      ) : activeChat ? (
        <div className="flex-1 flex flex-col bg-[#0B0C10]">
          <div className="px-5 py-3.5 border-b border-white/[0.06] bg-[#0E1017] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-card border border-white/10 flex items-center justify-center font-semibold text-white text-xs shadow-subtle">
                {activeChat.leadName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="bg-[#141622] border border-indigo-500/50 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none"
                    />
                    <button onClick={handleSaveName} className="text-xs text-emerald-400 font-semibold px-1.5 py-0.5 hover:bg-emerald-500/10 rounded">✓ Salvar</button>
                    <button onClick={() => setIsEditingName(false)} className="text-xs text-slate-400 hover:text-white px-1">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white text-sm tracking-tight">{activeChat.leadName}</h3>
                    <button 
                      onClick={() => { setEditedName(activeChat.leadName); setIsEditingName(true); }}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                      title="Mudar nome do cliente"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <span className="text-[11px] text-slate-400 font-mono">{activeChat.leadPhone}</span>
              </div>
            </div>

            {/* Mutually exclusive 3-mode selector: Bot Fluxo OR Agente IA OR Manual */}
            <div className="flex items-center gap-1 bg-[#12141D] p-1 rounded-xl border border-white/[0.06]">
              <button
                onClick={() => setChatAutomationMode(activeChat.botFlowActive ? 'none' : 'flow')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeChat.botFlowActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Ativar Bot de Fluxo (desativa IA automaticamente)"
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>{activeChat.botFlowActive ? 'Bot Fluxo Ativo' : 'Bot Fluxo'}</span>
              </button>

              <button
                onClick={() => setChatAutomationMode(activeChat.aiAgentActive ? 'none' : 'ai')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeChat.aiAgentActive
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Ativar Agente IA (desativa Bot de Fluxo automaticamente)"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{activeChat.aiAgentActive ? 'Agente IA Ativo' : 'Agente IA'}</span>
              </button>

              <button
                onClick={() => setChatAutomationMode('none')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  !activeChat.botFlowActive && !activeChat.aiAgentActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Atendimento manual (desativa Bot e IA)"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Manual</span>
              </button>
            </div>
          </div>

          {!activeChat.aiAgentActive && !activeChat.botFlowActive && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 font-medium">
              <span className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                Você está em modo Manual. O Bot de Fluxo e a IA estão pausados para esta conversa.
              </span>
            </div>
          )}

          {/* Area de Mensagens Estilo CRM Executivo */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#090A0F] bg-dot-grid relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#090A0F]/90 via-transparent to-[#090A0F]/90 pointer-events-none" />
            <div className="relative z-10 space-y-3.5">
              {activeChat.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.fromMe ? 'items-end' : 'items-start'} group`}
                >
                  <div
                    className={`max-w-[65%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed transition-all ${
                      m.fromMe
                        ? m.isAiGenerated
                          ? 'bg-gradient-to-br from-[#181A28] to-[#121422] text-slate-100 border border-indigo-500/30 rounded-tr-xs shadow-lg shadow-indigo-950/20'
                          : 'bg-gradient-to-br from-[#242A42] to-[#1B2034] text-white border border-indigo-400/20 rounded-tr-xs shadow-md'
                        : 'bg-[#151724] text-slate-200 border border-white/[0.08] rounded-tl-xs shadow-md'
                    }`}
                  >
                    {m.fromMe && m.isAiGenerated && (
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 mb-1.5 flex items-center gap-1.5 border-b border-indigo-500/20 pb-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span>Resposta do Agente de IA</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap selection:bg-indigo-500/30 selection:text-white font-normal">{m.text}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1.5 pt-0.5">
                      <span className="text-[10px] font-mono text-slate-400/80">
                        {m.timestamp}
                      </span>
                      {m.fromMe && (
                        <Check className="w-3 h-3 text-indigo-400 opacity-80" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Barra de Digitação */}
          <div className="p-3.5 border-t border-white/[0.06] bg-[#0E1017] flex items-center gap-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Digite uma mensagem para responder (assume atendimento humano)..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="w-full bg-[#12141F] border border-white/[0.08] hover:border-white/[0.15] rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
            </div>
            <button
              onClick={handleSendMessage}
              className="p-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-medium rounded-xl transition-all shadow-subtle flex items-center justify-center gap-1.5"
              title="Enviar mensagem"
            >
              <span>Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0B0C10] bg-dot-grid relative p-8 select-none">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-transparent to-[#0B0C10]/80 pointer-events-none" />
          <div className="relative z-10 max-w-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#141724] border border-white/[0.08] shadow-subtle flex items-center justify-center mx-auto text-indigo-400">
              <MessageSquare className="w-6 h-6 stroke-[1.75]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-white tracking-tight">Nenhuma conversa selecionada</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Selecione um contato na lista à esquerda para visualizar o histórico de mensagens, acionar agentes de IA ou assumir o atendimento humano.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sincronização em tempo real
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. RIGHT SIDEBAR: LEAD CRM INFO */}
      {activeChat && (
        <div className="w-80 border-l border-white/[0.06] bg-[#0E1017] p-5 flex flex-col gap-5 shrink-0 overflow-y-auto">
          {/* Classificação do Lead */}
          <div className="bg-[#12141F] border border-white/[0.06] rounded-2xl p-4 shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Status do Funil</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">CRM</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['frio', 'morno', 'quente', 'comprou'] as LeadTag[]).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleUpdateTag(tag)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium capitalize transition-all border ${
                    activeChat.tag === tag
                      ? tag === 'quente' ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm'
                      : tag === 'morno' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                      : tag === 'frio' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                      : 'bg-[#171926] border-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Follow-up Automático */}
          <div className="bg-[#12141F] border border-white/[0.06] rounded-2xl p-4 shadow-subtle space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <h4 className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Follow-up Agendado</span>
              </h4>
              {activeChat.followUpStatus === 'scheduled' && (
                <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Agendado
                </span>
              )}
              {activeChat.followUpStatus === 'completed' && (
                <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Concluído
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              Programe o disparo de mensagens e anexos para retomar contato automaticamente:
            </p>

            {/* Input de arquivo invisível para follow-up */}
            <input
              ref={followUpFileInputRef}
              type="file"
              onChange={handleUploadFollowUpMedia}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            />

            {/* Data e Hora */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-slate-300 block">Horário de Envio</span>
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full bg-[#171926] border border-white/[0.06] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            {/* Texto do Follow-up */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-slate-300 block">Mensagem Programada</span>
              <textarea
                rows={3}
                placeholder="Ex: Olá {nome}, tudo bem? Passando para saber o que achou da nossa proposta..."
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                className="w-full bg-[#171926] border border-white/[0.06] focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed transition-colors"
              />
            </div>

            {/* Anexos de Mídia do Follow-up */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-300 flex items-center gap-1">
                  <Paperclip className="w-3 h-3 text-indigo-400" /> Anexar Conteúdo
                </span>
                {isUploadingFollowUpMedia && (
                  <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Subindo...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (followUpFileInputRef.current) {
                      followUpFileInputRef.current.accept = 'image/*';
                      followUpFileInputRef.current.click();
                    }
                  }}
                  disabled={isUploadingFollowUpMedia}
                  className="py-1.5 px-1 rounded-xl text-[10px] font-medium bg-[#171926] hover:bg-white/[0.04] text-slate-300 border border-white/[0.04] flex flex-col items-center gap-1 transition-all"
                  title="Anexar Foto"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                  <span>Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (followUpFileInputRef.current) {
                      followUpFileInputRef.current.accept = 'video/*';
                      followUpFileInputRef.current.click();
                    }
                  }}
                  disabled={isUploadingFollowUpMedia}
                  className="py-1.5 px-1 rounded-xl text-[10px] font-medium bg-[#171926] hover:bg-white/[0.04] text-slate-300 border border-white/[0.04] flex flex-col items-center gap-1 transition-all"
                  title="Anexar Vídeo"
                >
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>Vídeo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (followUpFileInputRef.current) {
                      followUpFileInputRef.current.accept = 'audio/*';
                      followUpFileInputRef.current.click();
                    }
                  }}
                  disabled={isUploadingFollowUpMedia}
                  className="py-1.5 px-1 rounded-xl text-[10px] font-medium bg-[#171926] hover:bg-white/[0.04] text-slate-300 border border-white/[0.04] flex flex-col items-center gap-1 transition-all"
                  title="Anexar Áudio"
                >
                  <Mic className="w-3.5 h-3.5 text-violet-400" />
                  <span>Áudio</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (followUpFileInputRef.current) {
                      followUpFileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
                      followUpFileInputRef.current.click();
                    }
                  }}
                  disabled={isUploadingFollowUpMedia}
                  className="py-1.5 px-1 rounded-xl text-[10px] font-medium bg-[#171926] hover:bg-white/[0.04] text-slate-300 border border-white/[0.04] flex flex-col items-center gap-1 transition-all"
                  title="Anexar Documento"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Doc</span>
                </button>
              </div>

              {/* Mídia Anexada */}
              {followUpMedia && (
                <div className="bg-[#171926] border border-indigo-500/20 rounded-xl p-2.5 flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {followUpMedia.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                    {followUpMedia.type === 'video' && <Video className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {followUpMedia.type === 'audio' && <Mic className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                    {followUpMedia.type === 'document' && <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    <span className="text-[11px] text-slate-200 truncate font-mono">{followUpMedia.fileName}</span>
                  </div>
                  <button
                    onClick={() => setFollowUpMedia(null)}
                    className="p-1 text-slate-400 hover:text-rose-400 shrink-0 transition-colors"
                    title="Remover anexo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Ações: Salvar / Agendar ou Cancelar */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleScheduleFollowUp}
                disabled={isSavingFollowUp || !followUpDate}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white transition-all shadow-subtle disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingFollowUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Agendando...</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activeChat.followUpStatus === 'scheduled' ? 'Atualizar Agendamento' : 'Agendar Follow-up'}</span>
                  </>
                )}
              </button>

              {activeChat.followUpStatus === 'scheduled' && (
                <button
                  type="button"
                  onClick={handleCancelFollowUp}
                  className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancelar Follow-up</span>
                </button>
              )}
            </div>
          </div>

          {/* Notas Internas */}
          <div className="bg-[#12141F] border border-white/[0.06] rounded-2xl p-4 shadow-subtle flex-1 flex flex-col space-y-2">
            <h4 className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Notas do Lead</span>
            </h4>
            <textarea
              rows={5}
              placeholder="Adicione observações particulares sobre este lead..."
              value={activeChat.internalNotes}
              onChange={(e) => handleUpdateNotes(e.target.value)}
              className="w-full flex-1 bg-[#171926] border border-white/[0.06] rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed transition-colors"
            />
            <span className="text-[10px] text-slate-500">
              Salvo em tempo real no servidor.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
