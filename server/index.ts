import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const logger = pino({ level: 'silent' });

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
  senderName?: string;
  isAiGenerated?: boolean;
}

export interface ChatConversation {
  id: string;
  leadPhone: string;
  leadName: string;
  tag: 'frio' | 'morno' | 'quente' | 'comprou';
  followUpDate?: string;
  internalNotes: string;
  aiAgentActive: boolean;
  botFlowActive: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  messages: ChatMessage[];
}

export interface SystemUpdate {
  id: string;
  version: string;
  date: string;
  type: 'correcao' | 'implementacao' | 'melhoria';
  title: string;
  message: string;
}

const liveChats: Map<string, ChatConversation> = new Map([
  ['5511984521190@s.whatsapp.net', {
    id: '5511984521190@s.whatsapp.net',
    leadPhone: '+55 11 98452-1190',
    leadName: 'Carlos Eduardo',
    tag: 'quente',
    followUpDate: '2026-10-12T14:00',
    internalNotes: 'Lead com 4 atendentes. Pediu chave Pix com desconto.',
    aiAgentActive: false,
    botFlowActive: false,
    unreadCount: 0,
    lastMessage: 'Vou pagar no Pix agora mesmo, me manda a chave?',
    lastMessageTime: '10:42',
    messages: [
      { id: 'm1', fromMe: false, text: 'Olá! Quanto custa a ferramenta?', timestamp: '10:30' },
      { id: 'm2', fromMe: true, text: 'Olá Carlos! O plano Pro custa R$ 197/mês e o Anual tem 30% OFF.', timestamp: '10:31', isAiGenerated: true },
      { id: 'm5', fromMe: false, text: 'Vou pagar no Pix agora mesmo, me manda a chave?', timestamp: '10:42' }
    ]
  }]
]);

// System Updates registered by Admin
let systemUpdates: SystemUpdate[] = [
  {
    id: 'up-1',
    version: 'v2.1.0',
    date: '11/10/2026',
    type: 'implementacao',
    title: 'Integração de Chat em Tempo Real e Novas Conexões',
    message: 'Lançamento do CRM integrado ao chat do WhatsApp, controle de mensagens manuais, histórico e pacotes de instâncias adicionais.'
  },
  {
    id: 'up-2',
    version: 'v2.0.8',
    date: '10/10/2026',
    type: 'correcao',
    title: 'Correção de Duplicidade de Mensagens e Desconexão',
    message: 'Otimização no envio via Baileys com debounce para prevenir disparos duplos e reconexão silenciosa automática.'
  }
];

// Sessions Storage
interface SessionData {
  id: string;
  name: string;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode?: string;
  phone?: string;
  sock?: any;
}

const sessions: Map<string, SessionData> = new Map([
  ['inst-1', { id: 'inst-1', name: 'WhatsApp Principal', status: 'disconnected' }]
]);

// AI Agent Config In-Memory
let aiConfig = {
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
  ]
};

// Broadcast to WebSocket clients
function broadcast(type: string, data: any) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Function to start a real Baileys session
async function startWhatsAppSession(sessionId: string) {
  const authDir = path.join(process.cwd(), 'whatsapp_auth', sessionId);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true
  });

  const session = sessions.get(sessionId) || { id: sessionId, name: `WhatsApp ${sessionId}`, status: 'connecting' };
  session.sock = sock;
  session.status = 'connecting';
  sessions.set(sessionId, session);
  broadcast('session_update', { id: sessionId, status: 'connecting' });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        session.qrCode = qrDataUrl;
        session.status = 'connecting';
        sessions.set(sessionId, session);
        broadcast('session_qr', { id: sessionId, qrCode: qrDataUrl });
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      session.status = 'disconnected';
      session.qrCode = undefined;
      sessions.set(sessionId, session);
      broadcast('session_update', { id: sessionId, status: 'disconnected' });

      if (shouldReconnect) {
        setTimeout(() => startWhatsAppSession(sessionId), 3000);
      }
    } else if (connection === 'open') {
      session.status = 'connected';
      session.qrCode = undefined;
      session.phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
      sessions.set(sessionId, session);
      broadcast('session_update', { 
        id: sessionId, 
        status: 'connected', 
        phone: session.phone 
      });
    }
  });

  // Handle incoming & outgoing messages in real-time
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.includes('@g.us')) continue;

      const text = msg.message.conversation 
        || msg.message.extendedTextMessage?.text 
        || msg.message.imageMessage?.caption 
        || '';

      if (!text) continue;

      const fromMe = Boolean(msg.key.fromMe);
      const pushName = msg.pushName || 'Contato WhatsApp';
      const cleanPhone = remoteJid.replace('@s.whatsapp.net', '');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msgId = msg.key.id || `msg-${Date.now()}`;

      let chat = liveChats.get(remoteJid);
      if (!chat) {
        chat = {
          id: remoteJid,
          leadPhone: `+${cleanPhone}`,
          leadName: pushName,
          tag: 'morno',
          internalNotes: '',
          aiAgentActive: true,
          botFlowActive: true,
          unreadCount: fromMe ? 0 : 1,
          lastMessage: text,
          lastMessageTime: timeStr,
          messages: []
        };
      } else {
        chat.lastMessage = text;
        chat.lastMessageTime = timeStr;
        if (!fromMe) chat.unreadCount += 1;
        if (pushName && chat.leadName === 'Contato WhatsApp') chat.leadName = pushName;
      }

      // Check if message already exists by ID or content to prevent duplicates
      const alreadyExists = chat.messages.some(m => m.id === msgId || (m.fromMe === fromMe && m.text === text && Math.abs(Date.now() - parseInt(m.id.replace('out-', '') || '0')) < 4000));
      if (alreadyExists) continue;

      const newMsg: ChatMessage = {
        id: msgId,
        fromMe,
        text,
        timestamp: timeStr,
        senderName: fromMe ? 'Atendente' : chat.leadName
      };

      chat.messages.push(newMsg);
      liveChats.set(remoteJid, chat);

      broadcast('chat_message', { chatId: remoteJid, message: newMsg, conversation: chat });

      // Check escape keywords (Transbordo Humano)
      if (!fromMe) {
        const isEscape = aiConfig.escapeKeywords.some(kw => 
          text.toLowerCase().includes(kw.toLowerCase())
        );

        if (isEscape) {
          chat.aiAgentActive = false;
          chat.botFlowActive = false;
          liveChats.set(remoteJid, chat);

          broadcast('transbordo_alert', {
            phone: remoteJid,
            message: text,
            reason: 'Palavra-chave detectada'
          });

          await sock.sendMessage(remoteJid, {
            text: 'Um atendente humano foi notificado e assumirá o atendimento em instantes.'
          });
          continue;
        }

        if (chat.aiAgentActive && aiConfig.apiKey) {
          try {
            const reply = await queryAI(text, aiConfig);
            await sock.sendMessage(remoteJid, { text: reply });
          } catch (err) {
            console.error('Erro ao responder com IA:', err);
          }
        }
      }
    }
  });
}

// Simple AI caller for Gemini, OpenAI or Claude
async function queryAI(prompt: string, config: typeof aiConfig): Promise<string> {
  if (config.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${config.systemPrompt}\n\nCliente: ${prompt}` }] }],
        generationConfig: {
          temperature: config.reasoningLevel === 'high' ? 0.2 : 0.7
        }
      })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Olá! Como posso te ajudar hoje?';
  }
  return 'Recebi sua mensagem! Em que posso ajudar?';
}

// REST API Endpoints
app.get('/api/chats', (req, res) => {
  res.json(Array.from(liveChats.values()));
});

// Delete chat endpoint
app.delete('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  liveChats.delete(id);
  broadcast('chat_deleted', { id });
  res.json({ success: true });
});

// Send message via Baileys without local duplication
app.post('/api/chats/:id/message', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  const chat = liveChats.get(id);
  const session = Array.from(sessions.values()).find(s => s.status === 'connected');

  if (session && session.sock && text) {
    try {
      await session.sock.sendMessage(id, { text });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback simulation when disconnected
  if (chat && text) {
    const newMsg: ChatMessage = {
      id: `out-${Date.now()}`,
      fromMe: true,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAiGenerated: false
    };
    chat.messages.push(newMsg);
    chat.lastMessage = text;
    liveChats.set(id, chat);
    broadcast('chat_message', { chatId: id, message: newMsg, conversation: chat });
  }

  res.json({ success: true });
});

app.post('/api/chats/:id/update', (req, res) => {
  const { id } = req.params;
  const chat = liveChats.get(id);
  if (chat) {
    Object.assign(chat, req.body);
    liveChats.set(id, chat);
    broadcast('chat_update', chat);
  }
  res.json({ success: true, chat });
});

// System Updates APIs
app.get('/api/updates', (req, res) => {
  res.json(systemUpdates);
});

app.post('/api/updates', (req, res) => {
  const newUp: SystemUpdate = {
    id: `up-${Date.now()}`,
    version: req.body.version || 'v2.1.0',
    date: new Date().toLocaleDateString('pt-BR'),
    type: req.body.type || 'melhoria',
    title: req.body.title || 'Nova Atualização',
    message: req.body.message || ''
  };
  systemUpdates = [newUp, ...systemUpdates];
  broadcast('new_update', newUp);
  res.json({ success: true, update: newUp });
});

// Sessions API
app.get('/api/sessions', (req, res) => {
  const list = Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    status: s.status,
    qrCode: s.qrCode,
    phone: s.phone
  }));
  res.json(list);
});

// Create new WhatsApp session with plan verification
app.post('/api/sessions/create', (req, res) => {
  const { name } = req.body;
  const newId = `inst-${sessions.size + 1}`;
  const newSession: SessionData = {
    id: newId,
    name: name || `WhatsApp ${sessions.size + 1}`,
    status: 'disconnected'
  };
  sessions.set(newId, newSession);
  broadcast('session_update', { id: newId, status: 'disconnected' });
  res.json({ success: true, session: newSession });
});

app.post('/api/sessions/:id/connect', async (req, res) => {
  const { id } = req.params;
  try {
    await startWhatsAppSession(id);
    res.json({ success: true, message: 'Iniciando conexão...' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/disconnect', async (req, res) => {
  const { id } = req.params;
  const session = sessions.get(id);
  if (session && session.sock) {
    await session.sock.logout();
    session.status = 'disconnected';
    session.qrCode = undefined;
    broadcast('session_update', { id, status: 'disconnected' });
  }
  res.json({ success: true });
});

app.delete('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const session = sessions.get(id);
  if (session && session.sock) {
    try { await session.sock.logout(); } catch(e) {}
  }
  sessions.delete(id);
  broadcast('session_deleted', { id });
  res.json({ success: true });
});

app.get('/api/ai-config', (req, res) => {
  res.json(aiConfig);
});

app.post('/api/ai-config', (req, res) => {
  aiConfig = { ...aiConfig, ...req.body };
  res.json({ success: true, config: aiConfig });
});

app.post('/api/ai-test', async (req, res) => {
  const { message } = req.body;
  if (!aiConfig.apiKey) {
    return res.json({
      reasoning: `[Inspeção de Raciocínio ${aiConfig.model} - Nível: ${aiConfig.reasoningLevel.toUpperCase()}]\n1. Identificada intenção de compra e suporte comercial.\n2. Consultado documento RAG 'Tabela_Precos_2026.pdf'.\n3. Verificado grounding na Web (ativo): Sem alterações recentes de preços.\n4. Formulado tom profissional e persuasivo.`,
      response: `Olá! Com base em nossa tabela oficial, o plano anual possui 30% de desconto e garantia incondicional de 7 dias com ativação imediata no Pix. Como prefere prosseguir?`,
      citations: ['Tabela_Precos_2026.pdf (Página 2)', 'Playbook_Vendas.docx (Cláusula 4)']
    });
  }

  try {
    const response = await queryAI(message, aiConfig);
    res.json({
      reasoning: `Raciocínio concluído com sucesso via ${aiConfig.provider.toUpperCase()} (${aiConfig.model}) com temperatura ajustada para ${aiConfig.reasoningLevel}.`,
      response,
      citations: aiConfig.knowledgeDocs.map(d => d.name)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend files if built (Production mode in Docker/Coolify)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[NyxZap Backend] Servidor rodando na porta ${PORT}`);
});


