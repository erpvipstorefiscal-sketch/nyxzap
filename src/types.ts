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
  qrCode?: string;
  connectedAt?: string;
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
  type: 'inicio' | 'ia' | 'condicao' | 'sms' | 'cakto' | 'whatsapp' | 'audio' | 'imagem' | 'video' | 'timer';
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
}
