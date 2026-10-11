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
  AlertTriangle
} from 'lucide-react';
import { ChatConversation, LeadTag, ChatMessage } from '../types';

export const LiveChatManager: React.FC = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!confirm('Deseja realmente excluir esta conversa?')) return;

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

  const toggleAI = async () => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiAgentActive: !activeChat.aiAgentActive })
      });
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleBotFlow = async () => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botFlowActive: !activeChat.botFlowActive })
      });
      fetchChats();
    } catch (err) {
      console.error(err);
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
            {['todos', 'quente', 'morno', 'frio', 'comprou'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(t)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  filterTag === t 
                    ? 'bg-purple-600 text-white font-bold' 
                    : 'bg-[#151824] text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
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

                  <div className="flex items-center gap-1.5 pt-1 text-[9px] text-slate-500">
                    {c.aiAgentActive && (
                      <span className="flex items-center gap-1 text-purple-400 font-bold">
                        <Bot className="w-3 h-3" /> IA Ativa
                      </span>
                    )}
                    {c.botFlowActive && (
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        <Workflow className="w-3 h-3" /> Bot Ativo
                      </span>
                    )}
                    {!c.aiAgentActive && !c.botFlowActive && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <UserCheck className="w-3 h-3" /> Manual
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. CENTER: LIVE CHAT MESSAGES */}
      {activeChat ? (
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

            <div className="flex items-center gap-2">
              <button
                onClick={toggleAI}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeChat.aiAgentActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-[#151824] text-slate-400 border border-slate-700 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{activeChat.aiAgentActive ? 'IA Ligada' : 'IA Desativada'}</span>
              </button>

              <button
                onClick={toggleBotFlow}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeChat.botFlowActive
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-[#151824] text-slate-400 border border-slate-700 hover:text-white'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>{activeChat.botFlowActive ? 'Fluxo Ligado' : 'Fluxo Pausado'}</span>
              </button>
            </div>
          </div>

          {!activeChat.aiAgentActive && !activeChat.botFlowActive && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Você está atendendo manualmente este lead. A IA e o Bot estão pausados.
              </span>
              <button 
                onClick={() => { toggleAI(); toggleBotFlow(); }}
                className="underline font-bold hover:text-emerald-300"
              >
                Reativar IA e Bot
              </button>
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
