export type UserRole = 'admin' | 'client';

export interface UserAuth {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  token?: string;
  planName?: string;
  validUntil?: string;
  instancesLimit: number;
}

export interface SystemUpdate {
  id: string;
  version: string;
  date: string;
  type: 'correcao' | 'implementacao' | 'melhoria';
  title: string;
  message: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: 'mensal' | 'anual';
  instancesLimit: number;
  aiCreditsLimit: number;
  features: string[];
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone: string;
  planId: string;
  planName: string;
  status: 'active' | 'pending' | 'expired' | 'canceled';
  mrrValue: number;
  validUntil: string;
  connectedInstances: number;
  instancesLimit?: number;
  createdAt: string;
}

export interface WhatsAppSession {
  id: string;
  name: string;
  phone?: string;
  status: 'disconnected' | 'connecting' | 'connected';
  automationMode?: 'flow' | 'ai' | 'none';
  qrCode?: string;
  connectedAt?: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participantsCount: number;
  participants?: Array<{ id: string; phone: string; admin?: string | null }>;
  desc?: string;
}

export interface ScheduledBroadcast {
  id: string;
  groupId: string;
  groupName?: string;
  text?: string;
  mediaPath?: string;
  mediaType?: string;
  fileName?: string;
  mentionAll: boolean;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'failed' | 'canceled';
  errorMessage?: string;
  createdAt: string;
}

export type LeadTag = 'frio' | 'morno' | 'quente' | 'comprou';

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
  tag: LeadTag;
  followUpDate?: string;
  followUpText?: string;
  followUpMediaPath?: string;
  followUpMediaType?: 'image' | 'video' | 'audio' | 'document';
  followUpFileName?: string;
  followUpStatus?: 'idle' | 'scheduled' | 'completed';
  internalNotes: string;
  aiAgentActive: boolean;
  botFlowActive: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  messages: ChatMessage[];
}

export interface AIAgentConfig {
  provider: 'gemini' | 'openai' | 'claude';
  apiKey?: string;
  model: string;
  reasoningLevel: 'low' | 'medium' | 'high';
  mediaResolution: 'baixo' | 'medium' | 'maximo';
  webSearchEnabled: boolean;
  systemPrompt: string;
  escapeKeywords: string[];
  knowledgeDocs: KnowledgeDoc[];
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  type: string;
}

export interface FlowNode {
  id: string;
  type: 
    | 'inicio' | 'ia' | 'condicao' | 'sms' | 'cakto' | 'whatsapp' 
    | 'audio' | 'imagem' | 'video' | 'pdf' | 'timer'
    | 'email' | 'ligacao' | 'contato' | 'randomizador' 
    | 'botoes' | 'carrossel' | 'resposta' | 'resposta_avancada'
    | 'ia_audio' | 'ia_video' | 'ia_ligacao'
    | 'funil' | 'acoes' | 'agendar' | 'pipeline' | 'grupo_wa'
    | 'webhook' | 'conectar_fluxo' | 'trocar_instancia' | 'anotacao' | 'finalizar';
  title: string;
  x: number;
  y: number;
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  fromHandle?: 'default' | 'response' | 'timeout' | 'yes' | 'no';
}
