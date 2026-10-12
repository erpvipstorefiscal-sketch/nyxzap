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
  Users
} from 'lucide-react';
import { ChatConversation, LeadTag, ChatMessage, WhatsAppGroup } from '../types';
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

  const handleSendMessage = async () => {
    if (!replyText.trim() || !activeChat) return;

    const textToSend = replyText.trim();
    setReplyText('');

    try {
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

  const handleUpdateFollowUp = async (followUpDate: string) => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate })
      });
      fetchChats();
    } catch (err) {
      console.error(err);
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

  const handleSendGroupMessage = async () => {
    if (!selectedGroupId || !groupMessageText.trim()) return;
    setIsSendingGroupMessage(true);
    try {
      await fetch(`/api/chats/${encodeURIComponent(selectedGroupId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: groupMessageText.trim() })
      });
      setGroupMessageText('');
      await alertDialog({
        title: 'Comunicado Enviado',
        message: 'Sua mensagem foi transmitida com sucesso para todos os membros do grupo no WhatsApp.',
        variant: 'success',
        confirmText: 'OK'
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem para o grupo:', err);
    } finally {
      setIsSendingGroupMessage(false);
    }
  };

  const getTagBadge = (tag: LeadTag) => {
    switch (tag) {
      case 'quente':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">🔥 Quente</span>;
      case 'morno':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">⚡ Morno</span>;
      case 'frio':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">❄️ Frio</span>;
      case 'comprou':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">💎 Comprou</span>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-nyx-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-fadeIn">
      {/* 1. LEFT SIDEBAR: CONVERSATIONS LIST */}
      <div className="w-80 border-r border-slate-800 bg-[#0c0d14] flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Conversas WhatsApp</span>
            <button 
              onClick={fetchChats}
              className={`p-1.5 rounded-lg bg-[#151824] hover:bg-purple-600/20 text-slate-400 hover:text-purple-400 transition-all border border-slate-800 ${
                isRefreshing ? 'animate-spin text-purple-400' : ''
              }`}
              title="Atualizar conversas agora"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar contato ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#151824] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

            <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-semibold">
            {['todos', 'grupos', 'quente', 'morno', 'frio', 'comprou'].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFilterTag(t);
                  if (t === 'grupos') fetchGroups();
                }}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all flex items-center gap-1 ${
                  filterTag === t 
                    ? t === 'grupos' ? 'bg-emerald-600 text-white font-bold' : 'bg-purple-600 text-white font-bold' 
                    : 'bg-[#151824] text-slate-400 hover:text-white'
                }`}
              >
                {t === 'grupos' && <Users className="w-3 h-3" />}
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
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Nenhuma conversa encontrada.</p>
                <p className="text-[10px]">As mensagens do WhatsApp conectado aparecem aqui automaticamente.</p>
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
                    className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1.5 select-none relative group ${
                      isSelected ? 'bg-purple-950/20 border-l-4 border-purple-500' : 'hover:bg-[#151824]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate max-w-[140px]">
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
                      <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                        {c.lastMessage}
                      </p>
                      {getTagBadge(c.tag)}
                    </div>

                    {/* Exclusively show only ONE automation state badge */}
                    <div className="flex items-center gap-1.5 pt-1 text-[9px]">
                      {c.botFlowActive ? (
                        <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          <Workflow className="w-3 h-3" /> Bot Ativo
                        </span>
                      ) : c.aiAgentActive ? (
                        <span className="flex items-center gap-1 text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                          <Bot className="w-3 h-3" /> IA Ativa
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          <UserCheck className="w-3 h-3" /> Manual
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

                <button
                  onClick={fetchGroups}
                  disabled={isSyncingGroups}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-[#151824] text-slate-300 border border-slate-700 hover:text-white"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGroups ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="bg-[#10111a] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Informações do Grupo
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#151824] p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total de Membros</span>
                      <span className="text-lg font-bold text-emerald-400">{activeGroup.participantsCount} membros</span>
                    </div>
                    <div className="bg-[#151824] p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Identificador (JID)</span>
                      <span className="text-[11px] font-mono text-slate-300 truncate block">{activeGroup.id}</span>
                    </div>
                  </div>
                  {activeGroup.desc && (
                    <div className="bg-[#151824] p-3.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Descrição do Grupo</span>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{activeGroup.desc}</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#10111a] border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    Disparo de Comunicado no Grupo
                  </h4>
                  <p className="text-xs text-slate-400">
                    Envie uma mensagem instantânea para todos os membros deste grupo pelo WhatsApp conectado:
                  </p>
                  <textarea
                    rows={4}
                    placeholder="Digite seu comunicado ou mensagem para o grupo..."
                    value={groupMessageText}
                    onChange={(e) => setGroupMessageText(e.target.value)}
                    className="w-full bg-[#151824] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSendGroupMessage}
                      disabled={isSendingGroupMessage || !groupMessageText.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingGroupMessage ? 'Enviando...' : 'Enviar Comunicado'}</span>
                    </button>
                  </div>
                </div>
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
        <div className="flex-1 flex flex-col bg-[#090a0f]">
          <div className="p-3.5 border-b border-slate-800 bg-[#0f111a] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                {activeChat.leadName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="bg-nyx-850 border border-purple-500 rounded px-2 py-0.5 text-xs text-white font-bold"
                    />
                    <button onClick={handleSaveName} className="text-xs text-emerald-400 font-bold">✓ Salvar</button>
                    <button onClick={() => setIsEditingName(false)} className="text-xs text-slate-400">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{activeChat.leadName}</h3>
                    <button 
                      onClick={() => { setEditedName(activeChat.leadName); setIsEditingName(true); }}
                      className="text-slate-500 hover:text-purple-400 transition-colors"
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
            <div className="flex items-center gap-1.5 bg-[#151824] p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setChatAutomationMode(activeChat.botFlowActive ? 'none' : 'flow')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeChat.botFlowActive
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Ativar Bot de Fluxo (desativa IA automaticamente)"
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>{activeChat.botFlowActive ? '⚡ Bot Fluxo Ativo' : 'Bot Fluxo'}</span>
              </button>

              <button
                onClick={() => setChatAutomationMode(activeChat.aiAgentActive ? 'none' : 'ai')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeChat.aiAgentActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Ativar Agente IA (desativa Bot de Fluxo automaticamente)"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{activeChat.aiAgentActive ? '🤖 Agente IA Ativo' : 'Agente IA'}</span>
              </button>

              <button
                onClick={() => setChatAutomationMode('none')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  !activeChat.botFlowActive && !activeChat.aiAgentActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Atendimento manual (desativa Bot e IA)"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Manual</span>
              </button>
            </div>
          </div>

          {!activeChat.aiAgentActive && !activeChat.botFlowActive && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Você está em modo Manual. O Bot de Fluxo e a IA estão pausados para esta conversa.
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeChat.messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.fromMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-2xl text-xs leading-relaxed ${
                    m.fromMe
                      ? m.isAiGenerated
                        ? 'bg-purple-900/40 text-purple-100 border border-purple-500/30 rounded-tr-none'
                        : 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-[#151824] text-slate-200 border border-slate-800 rounded-tl-none'
                  }`}
                >
                  {m.fromMe && m.isAiGenerated && (
                    <div className="text-[9px] font-bold uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Resposta da IA (Gemini)
                    </div>
                  )}
                  <p>{m.text}</p>
                  <span className="text-[9px] text-slate-400/80 font-mono block text-right mt-1">
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-800 bg-[#0f111a] flex items-center gap-2">
            <input
              type="text"
              placeholder="Digite uma mensagem para o WhatsApp (assume atendimento manual)..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-[#151824] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSendMessage}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md shadow-emerald-600/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
          Selecione uma conversa ao lado para visualizar.
        </div>
      )}

      {/* 3. RIGHT SIDEBAR: LEAD CRM INFO */}
      {activeChat && (
        <div className="w-72 border-l border-slate-800 bg-[#0c0d14] p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">
          <div className="border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Classificação do Lead (Tag)</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 pt-2.5">
              {(['frio', 'morno', 'quente', 'comprou'] as LeadTag[]).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleUpdateTag(tag)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                    activeChat.tag === tag
                      ? tag === 'quente' ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow'
                      : tag === 'morno' ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow'
                      : tag === 'frio' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow'
                      : 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow'
                      : 'bg-[#151824] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-800 pb-3 space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Cadastrar Follow-up</span>
            </h4>
            <input
              type="datetime-local"
              value={activeChat.followUpDate || ''}
              onChange={(e) => handleUpdateFollowUp(e.target.value)}
              className="w-full bg-[#151824] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            {activeChat.followUpDate && (
              <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Agendado para {new Date(activeChat.followUpDate).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          <div className="flex-1 flex flex-col space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Notas Internas do Lead</span>
            </h4>
            <textarea
              rows={8}
              placeholder="Adicione observações particulares sobre este lead..."
              value={activeChat.internalNotes}
              onChange={(e) => handleUpdateNotes(e.target.value)}
              className="w-full flex-1 bg-[#151824] border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
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
