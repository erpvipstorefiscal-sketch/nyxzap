import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  Sparkles, 
  Scissors, 
  MessageSquare, 
  Clock, 
  Power, 
  Check, 
  X, 
  Smartphone,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
  Mail,
  Phone,
  UserCheck,
  Shuffle,
  Compass,
  Layers,
  Bot,
  Volume2,
  PhoneCall,
  Target,
  Calendar,
  GitBranch,
  Users,
  Webhook as WebhookIcon,
  Upload,
  Trash2,
  Copy,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  Link as LinkIcon,
  HelpCircle,
  Plus,
  StopCircle,
  ArrowLeft,
  FolderPlus,
  Edit3,
  Play,
  Pause,
  Search,
  Workflow,
  Send,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { FlowNode, FlowEdge, WhatsAppGroup } from '../types';
import { confirmDialog, alertDialog } from './ModalConfirm';

// Standard dimensions for calculating port positions precisely
const getNodeDimensions = (type: FlowNode['type'], waitForResponse?: boolean) => {
  const extraHeight = waitForResponse ? 50 : 0;
  switch (type) {
    case 'inicio':
      return { width: 270, height: 260 };
    case 'ia':
    case 'ia_audio':
    case 'ia_video':
    case 'ia_ligacao':
      return { width: 270, height: 260 };
    case 'condicao':
      return { width: 260, height: 220 };
    case 'sms':
    case 'whatsapp':
    case 'email':
      return { width: 270, height: 250 + extraHeight };
    case 'audio':
      return { width: 270, height: 260 + extraHeight };
    case 'imagem':
      return { width: 270, height: 280 + extraHeight };
    case 'video':
      return { width: 270, height: 280 + extraHeight };
    case 'pdf':
      return { width: 270, height: 250 + extraHeight };
    case 'timer':
      return { width: 260, height: 170 };
    case 'botoes':
    case 'carrossel':
    case 'resposta':
    case 'resposta_avancada':
      return { width: 270, height: 250 + extraHeight };
    case 'funil':
    case 'acoes':
    case 'agendar':
    case 'pipeline':
      return { width: 260, height: 220 };
    case 'grupo_wa':
      return { width: 280, height: 320 };
    case 'finalizar':
      return { width: 250, height: 95 };
    case 'conectar_fluxo':
      return { width: 290, height: 260 };
    case 'cakto':
    case 'webhook':
      return { width: 270, height: 280 };
    default:
      return { width: 260, height: 220 + extraHeight };
  }
};

const getNodeOutputPos = (
  node: FlowNode, 
  handleType: 'default' | 'response' | 'timeout' | 'yes' | 'no' = 'default'
) => {
  const { width, height } = getNodeDimensions(node.type, !!node.data.waitForResponse);
  if (node.data.waitForResponse) {
    if (handleType === 'response') {
      return { x: node.x + width, y: node.y + (height * 0.40) };
    }
    if (handleType === 'timeout') {
      return { x: node.x + width, y: node.y + (height * 0.76) };
    }
  }
  return { x: node.x + width, y: node.y + (height / 2) };
};

const getNodeInputPos = (node: FlowNode) => {
  const { height } = getNodeDimensions(node.type, !!node.data.waitForResponse);
  return { x: node.x, y: node.y + height / 2 };
};

const INITIAL_NODES: FlowNode[] = [
  {
    id: 'node-1',
    type: 'inicio',
    title: 'INÍCIO',
    x: 60,
    y: 80,
    data: { 
      trigger: 'palavra_chave', 
      keywords: ['quero saber sobre o curso', 'preço', 'comprar'], 
      instance: 'Inst. 1' 
    }
  },
  {
    id: 'node-4',
    type: 'whatsapp',
    title: 'WhatsApp Mensagem',
    x: 480,
    y: 80,
    data: { 
      message: 'Olá {nome}, seja muito bem-vindo! Você gostaria de ver nossos planos e condições exclusivas hoje?',
      waitForResponse: true,
      timeoutSeconds: 45,
      timeoutUnit: 'segundos'
    }
  },
  {
    id: 'node-2',
    type: 'ia',
    title: 'Assistente IA',
    x: 960,
    y: 40,
    data: { 
      tone: 'Profissional', 
      model: 'Gemini 2.5 Flash', 
      active: true,
      prompt: 'Tire dúvidas sobre os planos com foco em fechamento imediato' 
    }
  },
  {
    id: 'node-webhook',
    type: 'webhook',
    title: 'Webhook Integração',
    x: 960,
    y: 360,
    data: { 
      platform: 'cakto',
      activeEvents: ['Compra Aprovada', 'PIX Gerado']
    }
  }
];

const INITIAL_EDGES: FlowEdge[] = [
  { id: 'e1-4', from: 'node-1', to: 'node-4', label: 'Disparo', fromHandle: 'default' },
  { id: 'e4-2', from: 'node-4', to: 'node-2', label: 'Se responder', fromHandle: 'response' },
  { id: 'e4-wh', from: 'node-4', to: 'node-webhook', label: 'Não respondeu (45s)', fromHandle: 'timeout' }
];

export interface FlowSummary {
  id: string;
  name: string;
  description: string;
  active: boolean;
  executionCount?: number;
  nodeCount: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  updatedAt: string;
}

export const FlowBuilder: React.FC = () => {
  // Multi-flow state
  const [flowsList, setFlowsList] = useState<FlowSummary[]>([
    {
      id: 'default',
      name: 'Fluxo Principal de Vendas',
      description: 'Funil inteligente com mensagem inicial, gatilho por palavra-chave e respostas automáticas.',
      active: true,
      executionCount: 12,
      nodeCount: INITIAL_NODES.length,
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      updatedAt: new Date().toISOString()
    }
  ]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [currentFlowName, setCurrentFlowName] = useState<string>('Fluxo Principal');
  const [currentFlowDesc, setCurrentFlowDesc] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowNameInput, setNewFlowNameInput] = useState('');
  const [newFlowDescInput, setNewFlowDescInput] = useState('');
  
  // Edit flow meta state (name, description, status)
  const [editingFlow, setEditingFlow] = useState<FlowSummary | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [editDescInput, setEditDescInput] = useState('');

  // Test flow state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhoneInput, setTestPhoneInput] = useState('+55');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);

  // Load saved state or default
  const [nodes, setNodes] = useState<FlowNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<FlowEdge[]>(INITIAL_EDGES);

  const fetchFlows = async () => {
    setIsLoadingFlows(true);
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      if (data.success && Array.isArray(data.flows) && data.flows.length > 0) {
        setFlowsList(data.flows);
      } else {
        setFlowsList([{
          id: 'default',
          name: 'Fluxo Principal de Vendas',
          description: 'Funil inteligente com mensagem inicial, gatilho por palavra-chave e respostas automáticas.',
          active: true,
          executionCount: 12,
          nodeCount: INITIAL_NODES.length,
          nodes: INITIAL_NODES,
          edges: INITIAL_EDGES,
          updatedAt: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('[FlowBuilder] Erro ao buscar lista de fluxos:', err);
      setFlowsList([{
        id: 'default',
        name: 'Fluxo Principal de Vendas',
        description: 'Funil inteligente com mensagem inicial, gatilho por palavra-chave e respostas automáticas.',
        active: true,
        executionCount: 12,
        nodeCount: INITIAL_NODES.length,
        nodes: INITIAL_NODES,
        edges: INITIAL_EDGES,
        updatedAt: new Date().toISOString()
      }]);
    } finally {
      setIsLoadingFlows(false);
    }
  };

  // WhatsApp groups state for grupo_wa nodes
  const [groupsList, setGroupsList] = useState<WhatsAppGroup[]>([]);
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);

  const fetchGroups = async (targetInstance?: string) => {
    setIsFetchingGroups(true);
    try {
      const url = targetInstance 
        ? `/api/whatsapp/groups?instance=${encodeURIComponent(targetInstance)}`
        : '/api/whatsapp/groups';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroupsList(data.groups);
      }
    } catch (err) {
      console.error('[FlowBuilder] Erro ao sincronizar grupos:', err);
    } finally {
      setIsFetchingGroups(false);
    }
  };

  useEffect(() => {
    fetchFlows();
    fetchGroups();
  }, []);

  const openFlowEditor = (flow: FlowSummary) => {
    setActiveFlowId(flow.id);
    setCurrentFlowName(flow.name);
    setCurrentFlowDesc(flow.description || '');
    setNodes(Array.isArray(flow.nodes) && flow.nodes.length > 0 ? flow.nodes : INITIAL_NODES);
    setEdges(Array.isArray(flow.edges) ? flow.edges : INITIAL_EDGES);
    setFlowActive(flow.active !== false);
    setZoom(1.05);
    setPan({ x: 0, y: 0 });
    setConnectingFrom(null);
  };

  const [zoom, setZoom] = useState<number>(1.05);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Renomear cards inline no canvas
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');

  const startRenamingCard = (nodeId: string, currentTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCardId(nodeId);
    setEditingCardTitle(currentTitle);
  };

  const saveRenamedCard = (nodeId: string) => {
    if (editingCardTitle.trim()) {
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, title: editingCardTitle.trim() } : n));
    }
    setEditingCardId(null);
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  draggingIdRef.current = draggingId;
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  dragOffsetRef.current = dragOffset;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const rafIdRef = useRef<number | null>(null);

  // Connection line state
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    handleType: 'default' | 'response' | 'timeout';
    x: number;
    y: number;
  } | null>(null);
  const connectingFromRef = useRef(connectingFrom);
  connectingFromRef.current = connectingFrom;
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredTargetPortId, setHoveredTargetPortId] = useState<string | null>(null);
  const hoveredTargetPortIdRef = useRef<string | null>(null);
  hoveredTargetPortIdRef.current = hoveredTargetPortId;

  // Palette modal state
  const [showPaletteModal, setShowPaletteModal] = useState(false);

  // Uploading state tracking by nodeId
  const [uploadingNodeId, setUploadingNodeId] = useState<string | null>(null);

  // Input states for cards
  const [newKeywordInput, setNewKeywordInput] = useState<{ [nodeId: string]: string }>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flowActive, setFlowActive] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadContext, setActiveUploadContext] = useState<{ nodeId: string; accept: string } | null>(null);

  // GLOBAL POINTER LISTENERS: GUARANTEES CARDS NEVER GET STUCK OR GLUED ON RELEASE!
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setDraggingId(null);
      draggingIdRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('mouseup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
    };
  }, []);

  // Cancel connection on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connectingFrom) {
          setConnectingFrom(null);
          setHoveredTargetPortId(null);
        }
        setShowPaletteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom]);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom(prev => {
      const nextZoom = Math.min(2.0, Math.max(0.4, Number((prev + zoomFactor).toFixed(2))));
      return nextZoom;
    });
  };

  // Node Drag handlers
  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const currentConnecting = connectingFromRef.current;
    // If currently drawing a connection line from another node, clicking this card finishes the connection!
    if (currentConnecting) {
      if (currentConnecting.nodeId !== id) {
        handleInputPortRelease(id, e);
      } else {
        // Clicked the same card's body, cancel connection
        setConnectingFrom(null);
        setHoveredTargetPortId(null);
      }
      return;
    }
    
    const node = nodes.find(n => n.id === id);
    if (!node || !containerRef.current) return;

    setSelectedId(id);
    setDraggingId(id);
    draggingIdRef.current = id;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const mouseCanvasY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

    const offset = {
      x: mouseCanvasX - node.x,
      y: mouseCanvasY - node.y
    };
    setDragOffset(offset);
    dragOffsetRef.current = offset;
  };

  // Canvas Pan & Mouse handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (connectingFromRef.current) {
      // Clicking on empty canvas while connecting cancels connection immediately
      setConnectingFrom(null);
      setHoveredTargetPortId(null);
      return;
    }

    if (e.button === 0 && !draggingIdRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const currentDraggingId = draggingIdRef.current;
    const currentConnecting = connectingFromRef.current;
    
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentPan = panRef.current;
      const currentZoom = zoomRef.current;

      const mouseCanvasX = (clientX - rect.left - currentPan.x) / currentZoom;
      const mouseCanvasY = (clientY - rect.top - currentPan.y) / currentZoom;

      if (currentConnecting) {
        setCursorPos({ x: mouseCanvasX, y: mouseCanvasY });
        return;
      }

      if (currentDraggingId) {
        const offset = dragOffsetRef.current;
        const newX = Math.round(mouseCanvasX - offset.x);
        const newY = Math.round(mouseCanvasY - offset.y);
        
        setNodes(prev => prev.map(n => 
          n.id === currentDraggingId ? { ...n, x: newX, y: newY } : n
        ));
      } else if (isPanning) {
        setPan({
          x: clientX - panStart.x,
          y: clientY - panStart.y
        });
      }
    });
  };

  const handleMouseUp = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setDraggingId(null);
    draggingIdRef.current = null;
    setIsPanning(false);
  };

  // Start Connection from Output Port
  const handleOutputPortMouseDown = (
    nodeId: string, 
    handleType: 'default' | 'response' | 'timeout', 
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!containerRef.current) return;

    // Release any node drag immediately
    setDraggingId(null);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const startPos = getNodeOutputPos(node, handleType);
    setConnectingFrom({ nodeId, handleType, x: startPos.x, y: startPos.y });

    const rect = containerRef.current.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;
    setCursorPos({ x: mouseCanvasX, y: mouseCanvasY });
  };

  // Complete Connection at Input Port or Target Node
  const handleInputPortRelease = (targetNodeId: string, e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const currentConnecting = connectingFromRef.current;
    if (currentConnecting && currentConnecting.nodeId !== targetNodeId) {
      // Determine label based on handle
      let label = 'Disparo';
      if (currentConnecting.handleType === 'response') {
        label = 'Se responder';
      } else if (currentConnecting.handleType === 'timeout') {
        const sourceNode = nodes.find(n => n.id === currentConnecting.nodeId);
        const secs = sourceNode?.data?.timeoutSeconds || 30;
        const unit = sourceNode?.data?.timeoutUnit === 'minutos' ? 'm' : 's';
        label = `Não respondeu (${secs}${unit})`;
      }

      // Avoid duplicate edge with same handles
      const exists = edges.some(
        ed => ed.from === currentConnecting.nodeId && ed.to === targetNodeId && ed.fromHandle === currentConnecting.handleType
      );

      if (!exists) {
        const newEdge: FlowEdge = {
          id: `e-${currentConnecting.nodeId}-${targetNodeId}-${Date.now()}`,
          from: currentConnecting.nodeId,
          to: targetNodeId,
          label,
          fromHandle: currentConnecting.handleType
        };
        setEdges(prev => [...prev, newEdge]);
      }
    }

    // Always release connection cleanly!
    setConnectingFrom(null);
    setHoveredTargetPortId(null);
    setDraggingId(null);
  };

  // Save Flow
  const handleSaveFlow = async () => {
    try {
      const flowId = activeFlowId || 'default';
      const payload = {
        id: flowId,
        name: currentFlowName || 'Fluxo Principal',
        description: currentFlowDesc || '',
        nodes,
        edges,
        active: flowActive
      };

      // Save to local storage for quick fallback
      localStorage.setItem(`nyxzap_flow_${flowId}_nodes`, JSON.stringify(nodes));
      localStorage.setItem(`nyxzap_flow_${flowId}_edges`, JSON.stringify(edges));

      // Post to backend database
      await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Also sync active flow to /api/flow
      await fetch('/api/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: flowId,
          nodes,
          edges,
          active: flowActive
        })
      });

      setSaveSuccess(true);
      fetchFlows();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Create new flow
  const handleCreateFlow = async () => {
    if (!newFlowNameInput.trim()) return;
    const newId = `flow-${Date.now()}`;
    const newFlow: FlowSummary = {
      id: newId,
      name: newFlowNameInput.trim(),
      description: newFlowDescInput.trim(),
      active: true,
      nodeCount: INITIAL_NODES.length,
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      updatedAt: new Date().toISOString()
    };

    try {
      await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFlow)
      });
      await fetchFlows();
      setShowCreateModal(false);
      setNewFlowNameInput('');
      setNewFlowDescInput('');
      openFlowEditor(newFlow);
    } catch (err) {
      console.error('Erro ao criar fluxo:', err);
    }
  };

  // Duplicate flow
  const handleDuplicateFlow = async (flow: FlowSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `flow-${Date.now()}`;
    const duplicated: FlowSummary = {
      ...flow,
      id: newId,
      name: `${flow.name} (Cópia)`,
      updatedAt: new Date().toISOString()
    };
    try {
      await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicated)
      });
      await fetchFlows();
    } catch (err) {
      console.error('Erro ao duplicar fluxo:', err);
    }
  };

  // Delete flow
  const handleDeleteFlow = async (flowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({
      title: 'Excluir Fluxo de Automação',
      message: 'Tem certeza que deseja excluir este fluxo? Todos os cards, conexões e automações deste funil serão apagados permanentemente.',
      variant: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/flows/${flowId}`, { method: 'DELETE' });
      await fetchFlows();
      if (activeFlowId === flowId) {
        setActiveFlowId(null);
      }
    } catch (err) {
      console.error('Erro ao excluir fluxo:', err);
    }
  };

  // Toggle flow active status
  const handleToggleFlowActive = async (flow: FlowSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedActive = !flow.active;
    try {
      await fetch(`/api/flows/${flow.id}/meta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: updatedActive })
      });
      await fetchFlows();
      if (activeFlowId === flow.id) {
        setFlowActive(updatedActive);
      }
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  // Open Edit Modal for a flow
  const handleOpenEditModal = (flow: FlowSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFlow(flow);
    setEditNameInput(flow.name);
    setEditDescInput(flow.description || '');
  };

  // Save Edit Flow Meta (name, description)
  const handleSaveFlowMeta = async () => {
    if (!editingFlow || !editNameInput.trim()) return;
    try {
      await fetch(`/api/flows/${editingFlow.id}/meta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editNameInput.trim(),
          description: editDescInput.trim()
        })
      });
      await fetchFlows();
      if (activeFlowId === editingFlow.id) {
        setCurrentFlowName(editNameInput.trim());
        setCurrentFlowDesc(editDescInput.trim());
      }
      setEditingFlow(null);
    } catch (err) {
      console.error('Erro ao atualizar informações do fluxo:', err);
    }
  };

  // Disparar teste do fluxo para o WhatsApp
  const handleSendTestFlow = async () => {
    setTestResult(null);
    const phone = testPhoneInput.trim();

    if (!phone.startsWith('+')) {
      setTestResult({
        success: false,
        message: 'O número deve obrigatoriamente iniciar com o símbolo + e o código do país. Exemplo: +5511999999999'
      });
      return;
    }

    const clean = phone.replace(/\D/g, '');
    if (clean.length < 8) {
      setTestResult({
        success: false,
        message: 'Por favor, informe um número de WhatsApp válido com código de país e DDD.'
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/flow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          flowId: activeFlowId || 'default',
          nodes,
          edges
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setTestResult({
          success: false,
          message: data.error || 'Erro ao disparar teste do funil.'
        });
      } else {
        setTestResult({
          success: true,
          message: data.message || `Funil disparado com sucesso para ${phone}!`
        });
        fetchFlows();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro de comunicação ao disparar teste: ' + err.message
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Reset to default
  const handleResetFlow = async () => {
    const confirmed = await confirmDialog({
      title: 'Restaurar Configuração Padrão',
      message: 'Deseja restaurar o fluxo para a configuração inicial padrão? Quaisquer alterações não salvas no canvas atual serão descartadas.',
      variant: 'warning',
      confirmText: 'Restaurar Padrão',
      cancelText: 'Cancelar'
    });
    if (confirmed) {
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
      setZoom(1.05);
      setPan({ x: 0, y: 0 });
      setConnectingFrom(null);
      localStorage.removeItem('nyxzap_flow_builder_nodes');
      localStorage.removeItem('nyxzap_flow_builder_edges');
    }
  };

  // Delete node
  const deleteNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(edge => edge.from !== id && edge.to !== id));
    if (selectedId === id) setSelectedId(null);
    if (connectingFrom?.nodeId === id) setConnectingFrom(null);
  };

  // Duplicate node
  const duplicateNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const sourceNode = nodes.find(n => n.id === id);
    if (!sourceNode) return;

    const newNode: FlowNode = {
      ...sourceNode,
      id: `node-${Date.now()}`,
      title: `${sourceNode.title} (Cópia)`,
      x: sourceNode.x + 40,
      y: sourceNode.y + 40,
      data: JSON.parse(JSON.stringify(sourceNode.data))
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedId(newNode.id);
  };

  // Update node data helper
  const updateNodeData = (nodeId: string, updates: Partial<any>) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
  };

  // File Upload trigger
  const triggerFileUpload = (nodeId: string, acceptTypes: string) => {
    setActiveUploadContext({ nodeId, accept: acceptTypes });
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptTypes;
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle File Input Change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadContext) return;

    const { nodeId } = activeUploadContext;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Validation for Video: max 50MB
    if (node.type === 'video' && file.size > 50 * 1024 * 1024) {
      await alertDialog({
        title: 'Limite de Tamanho Excedido',
        message: 'O vídeo selecionado excede o tamanho máximo permitido de 50MB. Selecione um arquivo de vídeo menor ou comprima o arquivo.',
        variant: 'warning',
        confirmText: 'Entendido'
      });
      return;
    }

    setUploadingNodeId(nodeId);

    const formatBytes = (bytes: number) => {
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const readAsBase64 = (f: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(f);
      });
    };

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/flow/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (node.type === 'grupo_wa') {
          const base64Data = await readAsBase64(file);
          updateNodeData(nodeId, {
            groupPhotoUrl: data.url,
            groupPhotoBase64: base64Data,
            groupPhotoName: file.name
          });
        } else {
          updateNodeData(nodeId, {
            fileUrl: data.url,
            fileName: file.name,
            fileSize: formatBytes(file.size)
          });
        }
      } else {
        const localUrl = URL.createObjectURL(file);
        if (node.type === 'grupo_wa') {
          const base64Data = await readAsBase64(file);
          updateNodeData(nodeId, {
            groupPhotoUrl: base64Data || localUrl,
            groupPhotoBase64: base64Data,
            groupPhotoName: file.name
          });
        } else {
          updateNodeData(nodeId, {
            fileUrl: localUrl,
            fileName: file.name,
            fileSize: formatBytes(file.size)
          });
        }
      }
    } catch {
      const localUrl = URL.createObjectURL(file);
      if (node.type === 'grupo_wa') {
        const base64Data = await readAsBase64(file);
        updateNodeData(nodeId, {
          groupPhotoUrl: base64Data || localUrl,
          groupPhotoBase64: base64Data,
          groupPhotoName: file.name
        });
      } else {
        updateNodeData(nodeId, {
          fileUrl: localUrl,
          fileName: file.name,
          fileSize: formatBytes(file.size)
        });
      }
    } finally {
      setUploadingNodeId(null);
      setActiveUploadContext(null);
    }
  };

  // Add new node from dock or gallery
  const addNode = (type: FlowNode['type'], title: string) => {
    const defaultData: Record<string, any> = {};
    if (type === 'inicio') {
      defaultData.trigger = 'palavra_chave';
      defaultData.keywords = ['atendimento'];
      defaultData.instance = 'Todas';
    } else if (type === 'ia' || type === 'ia_audio' || type === 'ia_video' || type === 'ia_ligacao') {
      defaultData.tone = 'Profissional';
      defaultData.model = 'Gemini 2.5 Flash';
      defaultData.active = true;
      defaultData.prompt = 'Atenda o cliente tirando dúvidas';
    } else if (type === 'condicao') {
      defaultData.field = 'Score do Lead';
      defaultData.operator = '>=';
      defaultData.value = '50';
    } else if (type === 'sms' || type === 'whatsapp' || type === 'email' || type === 'resposta') {
      defaultData.message = 'Olá {nome}, como posso te ajudar hoje?';
      defaultData.waitForResponse = false;
      defaultData.timeoutSeconds = 30;
      defaultData.timeoutUnit = 'segundos';
    } else if (type === 'audio') {
      defaultData.audioUrl = '';
      defaultData.fileName = '';
      defaultData.fileSize = '';
      defaultData.delaySeconds = 3;
      defaultData.waitForResponse = false;
      defaultData.timeoutSeconds = 30;
      defaultData.timeoutUnit = 'segundos';
    } else if (type === 'imagem') {
      defaultData.imageUrl = '';
      defaultData.fileName = '';
      defaultData.fileSize = '';
      defaultData.caption = 'Confira nossos produtos!';
      defaultData.waitForResponse = false;
      defaultData.timeoutSeconds = 30;
      defaultData.timeoutUnit = 'segundos';
    } else if (type === 'video') {
      defaultData.videoUrl = '';
      defaultData.fileName = '';
      defaultData.fileSize = '';
      defaultData.caption = 'Veja a demonstração no vídeo!';
      defaultData.waitForResponse = false;
      defaultData.timeoutSeconds = 60;
      defaultData.timeoutUnit = 'segundos';
    } else if (type === 'pdf') {
      defaultData.pdfUrl = '';
      defaultData.fileName = '';
      defaultData.fileSize = '';
      defaultData.caption = 'Manual e proposta comercial';
      defaultData.waitForResponse = false;
      defaultData.timeoutSeconds = 45;
      defaultData.timeoutUnit = 'segundos';
    } else if (type === 'timer') {
      defaultData.delay = 5;
      defaultData.unit = 'minutos';
    } else if (type === 'cakto' || type === 'webhook') {
      defaultData.platform = 'cakto';
      defaultData.activeEvents = ['Compra Aprovada', 'PIX Gerado'];
    } else if (type === 'grupo_wa') {
      defaultData.action = 'adicionar';
      defaultData.instance = 'Inst. 1';
      defaultData.groupId = '';
    } else if (type === 'finalizar') {
      defaultData.reason = 'Fluxo concluído com sucesso';
    } else if (type === 'conectar_fluxo') {
      defaultData.targetFlow = 'Fluxo Principal de Vendas';
    }

    const spawnX = Math.round((-pan.x + 320) / zoom + (nodes.length % 5) * 35);
    const spawnY = Math.round((-pan.y + 160) / zoom + (nodes.length % 5) * 35);

    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type,
      title,
      x: Math.max(40, spawnX),
      y: Math.max(40, spawnY),
      data: defaultData
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedId(newNode.id);
    setShowPaletteModal(false);
  };

  // Delete edge
  const deleteEdge = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(prev => prev.filter(ed => ed.id !== edgeId));
  };

  // Keyword helper for Inicio
  const addKeywordToNode = (nodeId: string) => {
    const val = newKeywordInput[nodeId]?.trim();
    if (!val) return;
    const node = nodes.find(n => n.id === nodeId);
    const currentKeywords = node?.data?.keywords || [];
    if (!currentKeywords.includes(val)) {
      updateNodeData(nodeId, { keywords: [...currentKeywords, val] });
    }
    setNewKeywordInput(prev => ({ ...prev, [nodeId]: '' }));
  };

  const removeKeywordFromNode = (nodeId: string, kwToRemove: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const currentKeywords = node?.data?.keywords || [];
    updateNodeData(nodeId, {
      keywords: currentKeywords.filter((k: string) => k !== kwToRemove)
    });
  };

  // Insert variable into message helper
  const insertVariable = (nodeId: string, varName: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const currentMsg = node?.data?.message || '';
    updateNodeData(nodeId, { message: `${currentMsg} ${varName}` });
  };

  // DASHBOARD DE FLUXOS EM FORMATO DE CARDS (quando nenhum fluxo estiver aberto no editor)
  if (activeFlowId === null) {
    const filteredFlows = flowsList.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="space-y-6 animate-fadeIn flex flex-col h-full w-full p-4 lg:p-6 overflow-y-auto">
        {/* Top Header Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0f18] p-5 rounded-2xl border border-slate-800/80 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-surface-card border border-white/10 flex items-center justify-center text-white shadow-subtle">
              <Workflow className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">Fluxos de Automação</h1>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/[0.05] text-slate-300 border border-white/10 font-medium">
                  {flowsList.length} {flowsList.length === 1 ? 'Fluxo' : 'Fluxos'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie múltiplos funis interativos com WhatsApp, inteligência artificial, mídias e condicionais.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar fluxo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-[#141622] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 w-48 sm:w-64 transition-all"
              />
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-subtle"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Fluxo</span>
            </button>
          </div>
        </div>

        {/* Grid de Cards de Fluxos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFlows.map(flow => (
            <div
              key={flow.id}
              onClick={() => openFlowEditor(flow)}
              className="group bg-[#12141F] hover:bg-[#151824] border border-white/[0.08] hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-subtle hover:shadow-elevated flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                {/* Header do Card com Ícone, Contador de Execuções e Botão Pausar/Ativar */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-105">
                      <Zap className="w-4 h-4 fill-indigo-400/20" />
                    </div>
                    {/* Contador de quantas vezes o fluxo foi executado */}
                    <div 
                      className="bg-[#0B0D14] border border-white/[0.06] px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                      title="Número de vezes que este fluxo foi executado pelo WhatsApp"
                    >
                      <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                      <span className="text-[11px] font-mono font-medium text-slate-300">
                        {flow.executionCount ?? 0} {((flow.executionCount ?? 0) === 1) ? 'execução' : 'execuções'}
                      </span>
                    </div>
                  </div>

                  {/* Botão Pausar / Ativar Fluxo */}
                  <button
                    onClick={(e) => handleToggleFlowActive(flow, e)}
                    title={flow.active ? "Clique para pausar este fluxo" : "Clique para ativar este fluxo"}
                    className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      flow.active
                        ? 'bg-emerald-500/10 hover:bg-amber-500/10 text-emerald-300 hover:text-amber-300 border-emerald-500/20 hover:border-amber-500/20'
                        : 'bg-white/[0.03] hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-300 border-white/[0.06] hover:border-emerald-500/20'
                    }`}
                  >
                    {flow.active ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Ativo</span>
                        <Pause className="w-3 h-3 ml-0.5 opacity-60 group-hover:opacity-100" />
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>Pausado</span>
                        <Play className="w-3 h-3 ml-0.5 opacity-60 group-hover:opacity-100" />
                      </>
                    )}
                  </button>
                </div>

                {/* Nome do Fluxo */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 tracking-tight">
                    {flow.name}
                  </h3>
                  <button
                    onClick={(e) => handleOpenEditModal(flow, e)}
                    title="Editar dados"
                    className="p-1 hover:bg-white/[0.06] text-slate-400 hover:text-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Descrição do Fluxo */}
                <div className="mt-2.5 text-xs text-slate-400 line-clamp-2 min-h-[40px] bg-[#0B0D14]/60 p-2.5 rounded-xl border border-white/[0.04] leading-relaxed">
                  {flow.description ? (
                    flow.description
                  ) : (
                    <span className="italic text-slate-500">Sem descrição cadastrada. Clique no lápis para editar.</span>
                  )}
                </div>
              </div>

              {/* Rodapé com métricas e ações */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    {flow.nodeCount || flow.nodes?.length || 0} cards
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {flow.edges?.length || 0} conexões
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleOpenEditModal(flow, e)}
                    title="Editar Nome e Descrição"
                    className="p-1.5 hover:bg-white/[0.06] text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDuplicateFlow(flow, e)}
                    title="Duplicar Fluxo"
                    className="p-1.5 hover:bg-white/[0.06] text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteFlow(flow.id, e)}
                    title="Excluir Fluxo"
                    className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredFlows.length === 0 && !isLoadingFlows && (
            <div className="col-span-full py-16 text-center bg-surface-card rounded-2xl border border-white/[0.08] p-8 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.08] text-indigo-400 flex items-center justify-center">
                <Workflow className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="text-sm font-semibold text-white tracking-tight">Nenhum fluxo encontrado</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Crie seu primeiro funil visual com disparos de WhatsApp, inteligência artificial, condicionais e integrações.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-4 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Novo Fluxo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Criar Fluxo */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#11131f] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Novo Fluxo de Automação</h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Nome do Fluxo</label>
                  <input
                    type="text"
                    placeholder="Ex: Recuperação de Carrinho, Atendimento Geral..."
                    value={newFlowNameInput}
                    onChange={e => setNewFlowNameInput(e.target.value)}
                    className="w-full bg-[#181a28] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Descrição (opcional)</label>
                  <textarea
                    rows={3}
                    placeholder="Explique o objetivo deste funil..."
                    value={newFlowDescInput}
                    onChange={e => setNewFlowDescInput(e.target.value)}
                    className="w-full bg-[#181a28] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateFlow}
                  disabled={!newFlowNameInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar e Abrir Editor</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Dados do Fluxo (Nome, Descrição) */}
        {editingFlow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#11131f] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Editar Dados do Fluxo</h3>
                    <p className="text-[11px] text-slate-400">Altere o nome e a descrição da automação</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingFlow(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Nome do Fluxo</label>
                  <input
                    type="text"
                    value={editNameInput}
                    onChange={e => setEditNameInput(e.target.value)}
                    placeholder="Digite o nome do fluxo..."
                    className="w-full bg-[#181a28] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Descrição do Fluxo</label>
                  <textarea
                    rows={3}
                    placeholder="Explique o objetivo deste fluxo de atendimento..."
                    value={editDescInput}
                    onChange={e => setEditDescInput(e.target.value)}
                    className="w-full bg-[#181a28] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                <div className="bg-[#181a28] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-bold">Total de Execuções</span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold">
                    <Play className="w-3 h-3 fill-emerald-400" />
                    <span>{editingFlow.executionCount ?? 0} disparos realizados</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setEditingFlow(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveFlowMeta}
                  disabled={!editNameInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VISUAL CANVAS BUILDER (quando um fluxo estiver aberto)
  return (
    <div className="space-y-2 animate-fadeIn flex flex-col h-full w-full p-2 relative flex-1 min-h-0 overflow-hidden">
      {/* Hidden File Input for Native Direct PC Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0f18] p-3.5 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-3">
          {/* Voltar aos Fluxos */}
          <button
            onClick={() => { setActiveFlowId(null); fetchFlows(); }}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700/60 shadow-sm"
            title="Voltar para a listagem de fluxos"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Fluxos</span>
          </button>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentFlowName}
                onChange={e => setCurrentFlowName(e.target.value)}
                className="text-base font-black text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 focus:outline-none px-0.5"
                title="Clique para editar o nome do fluxo"
              />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                Editor Visual
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gatilhos de WhatsApp, IA, Mídias diretas do PC e Conexões Inteligentes.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Botão Testar Funil */}
          <button
            onClick={() => {
              setTestResult(null);
              setShowTestModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-500/40 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 active:scale-95"
            title="Disparar este funil como teste diretamente para um número de WhatsApp"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Testar Funil</span>
          </button>

          {/* Status Toggle */}
          <button 
            onClick={() => setFlowActive(!flowActive)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
              flowActive 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${flowActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
            {flowActive ? 'Fluxo Ativo' : 'Fluxo Pausado'}
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-[#131622] border border-slate-800 rounded-xl p-1 gap-1">
            <button 
              onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              title="Diminuir Zoom"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold text-white px-1.5 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => setZoom(z => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
              title="Aumentar Zoom"
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => { setZoom(1.05); setPan({ x: 0, y: 0 }); }}
              title="Resetar Zoom"
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset button */}
          <button
            onClick={handleResetFlow}
            title="Restaurar fluxo padrão"
            className="p-2 bg-[#131622] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveFlow}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
              saveSuccess 
                ? 'bg-emerald-600 text-white shadow-emerald-600/30' 
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
            }`}
          >
            {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'Fluxo Salvo!' : 'Salvar Fluxo'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Connecting Banner Notice */}
      {connectingFrom && (
        <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-900/60 border border-purple-500/50 text-purple-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between shadow-lg shadow-purple-900/20 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <LinkIcon className="w-4 h-4 text-cyan-400" />
            <span>
              Conectando saída <strong>({connectingFrom.handleType === 'response' ? 'Se responder' : connectingFrom.handleType === 'timeout' ? 'Se não responder' : 'Disparo'})</strong>: solte ou clique no ponto esquerdo do card de destino.
            </span>
          </div>
          <button 
            onClick={() => { setConnectingFrom(null); setHoveredTargetPortId(null); }}
            className="px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[11px] font-bold transition-colors"
          >
            Cancelar (Esc)
          </button>
        </div>
      )}

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 w-full min-h-[550px] h-[calc(100vh-140px)] bg-[#090a0f] border border-slate-800/80 rounded-2xl relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, #1a1e2e 1.2px, transparent 1.2px)',
          backgroundSize: `${Math.round(24 * zoom)}px ${Math.round(24 * zoom)}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        {/* Helper Badge in Canvas */}
        <div className="absolute top-3 left-3 z-30 pointer-events-none flex items-center gap-2 bg-[#131622]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 shadow-md">
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Arraste os pontos para conectar • Clique no fundo para soltar</span>
        </div>

        {/* Zoom & Pan Transform Container */}
        <div 
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '4500px',
            height: '4500px',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {/* SVG Connections Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-auto z-0 overflow-visible">
            <defs>
              <style>{`
                @keyframes flowLineDash {
                  from { stroke-dashoffset: 24; }
                  to { stroke-dashoffset: 0; }
                }
                @keyframes connectBeamPulse {
                  0%, 100% { opacity: 0.9; stroke-width: 3.5; }
                  50% { opacity: 1; stroke-width: 4.5; }
                }
                .flowing-edge {
                  animation: flowLineDash 0.8s linear infinite;
                }
                .connecting-line-anim {
                  animation: flowLineDash 0.5s linear infinite, connectBeamPulse 1.5s ease-in-out infinite;
                }
              `}</style>

              <linearGradient id="flowGradActive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>

              <linearGradient id="timeoutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>

              <linearGradient id="connectingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>

              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Render All Existing Edges with Animated Flowing Effect */}
            {edges.map(edge => {
              const src = nodes.find(n => n.id === edge.from);
              const tgt = nodes.find(n => n.id === edge.to);
              if (!src || !tgt) return null;

              const p1 = getNodeOutputPos(src, edge.fromHandle || 'default');
              const p2 = getNodeInputPos(tgt);

              const x1 = p1.x;
              const y1 = p1.y;
              const x2 = p2.x;
              const y2 = p2.y;
              const dx = Math.max(50, Math.abs(x2 - x1) / 2);

              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const isTimeout = edge.fromHandle === 'timeout';

              return (
                <g key={edge.id} className="group cursor-pointer">
                  {/* Outer Background Glow using pure opacity without rasterization blur */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isTimeout ? '#f97316' : '#8b5cf6'}
                    strokeWidth="7"
                    strokeOpacity="0.22"
                    strokeLinecap="round"
                  />

                  {/* Base Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isTimeout ? '#c2410c' : '#3b82f6'}
                    strokeWidth="2.5"
                    strokeOpacity="0.75"
                  />

                  {/* Animated Flowing Particles / Dashes */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isTimeout ? 'url(#timeoutGrad)' : 'url(#flowGradActive)'}
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    className="flowing-edge"
                  />

                  {/* Moving Particle Dot traversing the path */}
                  <circle r="3.5" fill={isTimeout ? '#fb923c' : '#38bdf8'}>
                    <animateMotion
                      path={pathD}
                      dur="2.5s"
                      repeatCount="indefinite"
                      rotate="auto"
                    />
                  </circle>

                  {/* Mid label badge with Click to Delete */}
                  <g 
                    transform={`translate(${midX}, ${midY})`} 
                    onClick={(e) => deleteEdge(edge.id, e)}
                  >
                    <rect 
                      x="-48" 
                      y="-12" 
                      width="96" 
                      height="24" 
                      rx="12" 
                      fill="#13141f" 
                      stroke={isTimeout ? '#f97316' : '#475569'} 
                      strokeWidth="1.5"
                      className="group-hover:stroke-rose-500 group-hover:fill-rose-950/80 transition-colors shadow-lg"
                    />
                    <text
                      x="0"
                      y="4"
                      fill={isTimeout ? '#fdba74' : '#e2e8f0'}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      textAnchor="middle"
                      className="select-none group-hover:fill-rose-300 transition-colors"
                    >
                      {edge.label || 'Ligado'} ×
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 2. Render Real-time Connecting Line Following the Cursor */}
            {connectingFrom && (() => {
              const x1 = connectingFrom.x;
              const y1 = connectingFrom.y;
              
              let x2 = cursorPos.x;
              let y2 = cursorPos.y;
              if (hoveredTargetPortId) {
                const targetNode = nodes.find(n => n.id === hoveredTargetPortId);
                if (targetNode) {
                  const targetPos = getNodeInputPos(targetNode);
                  x2 = targetPos.x;
                  y2 = targetPos.y;
                }
              }

              const dx = Math.max(60, Math.abs(x2 - x1) / 2);
              const connectPathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g className="pointer-events-none">
                  <path
                    d={connectPathD}
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="8"
                    strokeOpacity="0.25"
                  />
                  <path
                    d={connectPathD}
                    fill="none"
                    stroke="url(#connectingGrad)"
                    strokeWidth="3.5"
                    strokeDasharray="8 6"
                    strokeLinecap="round"
                    className="connecting-line-anim"
                  />
                  <circle cx={x1} cy={y1} r="6" fill="#38bdf8" />
                  <circle cx={x2} cy={y2} r="5" fill="#ec4899" />
                </g>
              );
            })()}
          </svg>

          {/* Nodes Layer */}
          <div className="relative z-10 w-full h-full pointer-events-none">
            {nodes.map(node => {
              const isSelected = selectedId === node.id;
              const isConnectingSource = connectingFrom?.nodeId === node.id;
              const canBeTarget = connectingFrom !== null && connectingFrom.nodeId !== node.id && node.type !== 'inicio';
              const isHoveredTarget = hoveredTargetPortId === node.id;
              const hasWaitForResponse = !!node.data.waitForResponse;
              const { width } = getNodeDimensions(node.type, hasWaitForResponse);

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${width}px`,
                    willChange: isSelected || draggingId === node.id ? 'left, top' : 'auto'
                  }}
                  className={`pointer-events-auto rounded-2xl bg-[#12141F] border shadow-2xl relative select-none ${
                    draggingId === node.id ? '' : 'transition-colors'
                  } ${
                    isSelected 
                      ? 'ring-1 ring-indigo-500 border-indigo-500/80 shadow-subtle' 
                      : 'border-white/[0.08] hover:border-white/[0.16]'
                  } ${isConnectingSource ? 'ring-1 ring-cyan-400 border-cyan-400' : ''} ${
                    isHoveredTarget ? 'ring-1 ring-emerald-400 border-emerald-400' : ''
                  }`}
                >
                  {/* Top Bar Header */}
                  <div 
                    className="px-3.5 py-2.5 rounded-t-2xl flex items-center justify-between text-xs font-semibold text-white cursor-move bg-[#171926] border-b border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-1">
                      {node.type === 'inicio' && (
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <Smartphone className="w-3 h-3" />
                        </div>
                      )}
                      {(node.type === 'ia' || node.type === 'ia_audio' || node.type === 'ia_video' || node.type === 'ia_ligacao') && (
                        <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <Bot className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'condicao' && (
                        <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                          <Scissors className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'audio' && (
                        <div className="w-5 h-5 rounded-md bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/20">
                          <Mic className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'imagem' && (
                        <div className="w-5 h-5 rounded-md bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0 border border-pink-500/20">
                          <ImageIcon className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'video' && (
                        <div className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                          <Video className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'pdf' && (
                        <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                          <FileText className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'timer' && (
                        <div className="w-5 h-5 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                          <Clock className="w-3 h-3" />
                        </div>
                      )}
                      {(node.type === 'cakto' || node.type === 'webhook') && (
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <WebhookIcon className="w-3 h-3" />
                        </div>
                      )}
                      {(node.type === 'sms' || node.type === 'whatsapp') && (
                        <div className="w-5 h-5 rounded-md bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
                          <MessageSquare className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'grupo_wa' && (
                        <div className="w-5 h-5 rounded-md bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
                          <Users className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'finalizar' && (
                        <div className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                          <StopCircle className="w-3 h-3" />
                        </div>
                      )}
                      {node.type === 'conectar_fluxo' && (
                        <div className="w-5 h-5 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                          <LinkIcon className="w-3 h-3" />
                        </div>
                      )}
                      
                      {editingCardId === node.id ? (
                        <input
                          type="text"
                          value={editingCardTitle}
                          onChange={(e) => setEditingCardTitle(e.target.value)}
                          onBlur={() => saveRenamedCard(node.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenamedCard(node.id);
                            if (e.key === 'Escape') setEditingCardId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full bg-black/50 text-white border border-white/40 rounded px-1.5 py-0.5 text-[11px] font-black uppercase outline-none focus:border-white shadow-inner"
                        />
                      ) : (
                        <span 
                          onClick={(e) => startRenamingCard(node.id, node.title, e)}
                          title="Clique para renomear este card"
                          className="tracking-wide uppercase text-[11px] font-black truncate cursor-pointer hover:underline"
                        >
                          {node.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-90 hover:opacity-100 shrink-0">
                      <button
                        onClick={(e) => startRenamingCard(node.id, node.title, e)}
                        title="Renomear Card"
                        className="p-1 hover:bg-black/25 rounded-md transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-white/80 hover:text-white" />
                      </button>
                      <button
                        onClick={(e) => duplicateNode(node.id, e)}
                        title="Duplicar Card"
                        className="p-1 hover:bg-black/25 rounded-md transition-colors"
                      >
                        <Copy className="w-3 h-3 text-white/80 hover:text-white" />
                      </button>
                      <button
                        onClick={(e) => deleteNode(node.id, e)}
                        title="Excluir Card"
                        className="p-1 hover:bg-rose-600/40 rounded-md transition-colors text-white/80 hover:text-rose-200"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content Based on Type */}
                  <div className="p-3.5 space-y-3 cursor-default" onMouseDown={(e) => e.stopPropagation()}>
                    {/* 1. INÍCIO CARD */}
                    {node.type === 'inicio' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#1c1d29] border border-slate-800">
                          <button
                            onClick={() => updateNodeData(node.id, { trigger: 'palavra_chave' })}
                            className={`py-1 px-2 text-[10px] font-bold rounded-lg transition-all ${
                              node.data.trigger === 'palavra_chave'
                                ? 'bg-emerald-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Palavra-chave
                          </button>
                          <button
                            onClick={() => updateNodeData(node.id, { trigger: 'boas_vindas' })}
                            className={`py-1 px-2 text-[10px] font-bold rounded-lg transition-all ${
                              node.data.trigger === 'boas_vindas'
                                ? 'bg-emerald-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Boas-vindas
                          </button>
                        </div>

                        {node.data.trigger === 'palavra_chave' && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Palavras que ativam:
                            </span>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                              {(node.data.keywords || []).map((kw: string) => (
                                <span
                                  key={kw}
                                  className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"
                                >
                                  {kw}
                                  <button onClick={() => removeKeywordFromNode(node.id, kw)} className="hover:text-rose-400">×</button>
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1">
                              <input
                                type="text"
                                value={newKeywordInput[node.id] || ''}
                                onChange={(e) => setNewKeywordInput({ ...newKeywordInput, [node.id]: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && addKeywordToNode(node.id)}
                                placeholder="Nova palavra e pressione Enter..."
                                className="bg-transparent text-[10px] text-white focus:outline-none w-full placeholder-slate-500"
                              />
                              <button
                                onClick={() => addKeywordToNode(node.id)}
                                className="w-5 h-5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Disparar na Instância:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {['Todas', 'Inst. 1', 'Inst. 2', 'Inst. 3', 'Inst. 4'].map((inst) => (
                              <button
                                key={inst}
                                onClick={() => updateNodeData(node.id, { instance: inst })}
                                className={`text-[9px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                                  (node.data.instance || 'Todas') === inst 
                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                    : 'bg-[#1c1d29] hover:bg-slate-800 text-slate-400'
                                }`}
                              >
                                {inst}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. WEBHOOK / INTEGRAÇÃO CARD */}
                    {(node.type === 'webhook' || node.type === 'cakto') && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Plataforma de Vendas:
                          </label>
                          <select
                            value={node.data.platform || 'cakto'}
                            onChange={(e) => updateNodeData(node.id, { platform: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                          >
                            <option value="site-proprio">🛍️ Site Próprio / E-commerce</option>
                            <option value="cakto">🌵 Cakto</option>
                            <option value="hotmart">🔥 Hotmart</option>
                            <option value="braip">🅱️ Braip</option>
                            <option value="kirvano">⬛ Kirvano</option>
                            <option value="logzz">🟩 Logzz</option>
                            <option value="payt">🟧 Payt</option>
                            <option value="appmax">🟪 AppMax</option>
                            <option value="ticto">⬛ Ticto</option>
                            <option value="hyppe">📦 Hyppe</option>
                            <option value="eon-digital">⚡ Eon Digital</option>
                            <option value="keedpay">💳 KeedPay</option>
                            <option value="mundpay">🌐 MundPay</option>
                            <option value="shopee">🛍️ Shopee</option>
                            <option value="personalizado">🔗 Outro Webhook</option>
                          </select>
                        </div>

                        {/* Eventos selecionáveis */}
                        <div className="space-y-1 pt-1 border-t border-slate-800/80">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Disparar quando receber evento:
                          </label>
                          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                            {['Compra Aprovada', 'PIX Gerado', 'Boleto Gerado', 'Carrinho Abandonado', 'Reembolso'].map((ev) => {
                              const isEventActive = (node.data.activeEvents || ['Compra Aprovada', 'PIX Gerado']).includes(ev);
                              return (
                                <button
                                  key={ev}
                                  type="button"
                                  onClick={() => {
                                    const current = node.data.activeEvents || ['Compra Aprovada', 'PIX Gerado'];
                                    const next = current.includes(ev) ? current.filter((x: string) => x !== ev) : [...current, ev];
                                    updateNodeData(node.id, { activeEvents: next });
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between border transition-all ${
                                    isEventActive 
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                      : 'bg-[#1c1d29] text-slate-500 border-slate-800 hover:text-slate-300'
                                  }`}
                                >
                                  <span>• {ev}</span>
                                  {isEventActive && <Check className="w-3 h-3 text-emerald-400" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="text-[9px] text-slate-500 pt-0.5">
                          URLs configuradas em <strong>Canais & Integrações</strong>.
                        </div>
                      </div>
                    )}

                    {/* 3. ÁUDIO CARD COM UPLOAD DIRETO DO PC */}
                    {node.type === 'audio' && (
                      <div className="space-y-2.5">
                        <div className="bg-[#1c1d29] border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5 text-violet-400" />
                              Áudio do PC
                            </span>
                            <span className="text-[8px] font-mono text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 font-bold">
                              MP3, WAV, OGG, OPUS, AAC
                            </span>
                          </div>

                          {node.data.fileName ? (
                            <div className="bg-[#13141f] border border-violet-500/30 rounded-lg p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white truncate max-w-[150px]">
                                  {node.data.fileName}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">{node.data.fileSize}</span>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => triggerFileUpload(node.id, '.mp3,.wav,.ogg,.opus,.m4a,.aac')}
                                  className="text-[9px] text-violet-400 hover:text-violet-300 font-bold underline"
                                >
                                  Trocar áudio
                                </button>
                                <span className="text-slate-600">•</span>
                                <button
                                  onClick={() => updateNodeData(node.id, { fileName: '', fileSize: '', fileUrl: '' })}
                                  className="text-[9px] text-rose-400 hover:text-rose-300 font-bold"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => triggerFileUpload(node.id, '.mp3,.wav,.ogg,.opus,.m4a,.aac')}
                              disabled={uploadingNodeId === node.id}
                              className="w-full py-2.5 px-3 bg-[#13141f] hover:bg-violet-950/30 border border-dashed border-violet-500/40 hover:border-violet-400 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
                            >
                              <Upload className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                                {uploadingNodeId === node.id ? 'Subindo áudio...' : 'Subir áudio do computador'}
                              </span>
                              <span className="text-[8px] text-slate-500">MP3, WAV, OGG, OPUS, M4A ou AAC</span>
                            </button>
                          )}
                        </div>

                        {/* Delay Gravação */}
                        <div className="flex items-center justify-between text-xs bg-[#1c1d29] px-2.5 py-1.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-medium">Simular "Gravando...":</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={node.data.delaySeconds || 3}
                              onChange={(e) => updateNodeData(node.id, { delaySeconds: Number(e.target.value) })}
                              className="w-12 bg-[#13141f] border border-slate-700 rounded-lg px-1.5 py-0.5 text-center text-[10px] text-white font-bold"
                            />
                            <span className="text-[10px] text-slate-400">seg</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. IMAGEM CARD COM UPLOAD DIRETO DO PC */}
                    {node.type === 'imagem' && (
                      <div className="space-y-2.5">
                        <div className="bg-[#1c1d29] border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                              Imagem do PC
                            </span>
                            <span className="text-[8px] font-mono text-pink-300 bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20 font-bold">
                              PNG, JPG, WEBP
                            </span>
                          </div>

                          {node.data.fileUrl || node.data.fileName ? (
                            <div className="bg-[#13141f] border border-pink-500/30 rounded-lg p-2 space-y-1.5">
                              {node.data.fileUrl && (
                                <img 
                                  src={node.data.fileUrl} 
                                  alt="Preview" 
                                  className="w-full h-24 object-cover rounded-md border border-slate-800" 
                                />
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white truncate max-w-[150px]">
                                  {node.data.fileName || 'Imagem carregada'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">{node.data.fileSize}</span>
                              </div>
                              <button
                                onClick={() => triggerFileUpload(node.id, 'image/*,.png,.jpg,.jpeg,.webp')}
                                className="text-[9px] text-pink-400 hover:text-pink-300 font-bold underline"
                              >
                                Trocar imagem
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => triggerFileUpload(node.id, 'image/*,.png,.jpg,.jpeg,.webp')}
                              disabled={uploadingNodeId === node.id}
                              className="w-full py-3 px-3 bg-[#13141f] hover:bg-pink-950/30 border border-dashed border-pink-500/40 hover:border-pink-400 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
                            >
                              <Upload className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                                {uploadingNodeId === node.id ? 'Subindo imagem...' : 'Subir imagem do PC'}
                              </span>
                              <span className="text-[8px] text-slate-500">PNG, JPG, JPEG, WEBP ou GIF</span>
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={node.data.caption || ''}
                          onChange={(e) => updateNodeData(node.id, { caption: e.target.value })}
                          placeholder="Legenda da imagem..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    )}

                    {/* 5. VÍDEO CARD COM UPLOAD DIRETO DO PC (MÁX 50MB) */}
                    {node.type === 'video' && (
                      <div className="space-y-2.5">
                        <div className="bg-[#1c1d29] border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-rose-400" />
                              Vídeo do PC
                            </span>
                            <span className="text-[8px] font-mono text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 font-bold">
                              MP4 (Máx 50MB)
                            </span>
                          </div>

                          {node.data.fileName ? (
                            <div className="bg-[#13141f] border border-rose-500/30 rounded-lg p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white truncate max-w-[150px]">
                                  {node.data.fileName}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">{node.data.fileSize}</span>
                              </div>
                              {node.data.fileUrl && (
                                <video 
                                  src={node.data.fileUrl} 
                                  controls 
                                  className="w-full h-24 object-cover rounded-md bg-black" 
                                />
                              )}
                              <button
                                onClick={() => triggerFileUpload(node.id, 'video/mp4,.mp4')}
                                className="text-[9px] text-rose-400 hover:text-rose-300 font-bold underline"
                              >
                                Trocar vídeo
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => triggerFileUpload(node.id, 'video/mp4,.mp4')}
                              disabled={uploadingNodeId === node.id}
                              className="w-full py-3 px-3 bg-[#13141f] hover:bg-rose-950/30 border border-dashed border-rose-500/40 hover:border-rose-400 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
                            >
                              <Upload className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                                {uploadingNodeId === node.id ? 'Subindo vídeo...' : 'Subir vídeo MP4 do PC'}
                              </span>
                              <span className="text-[8px] text-rose-300 font-semibold">Tamanho máximo: 50MB</span>
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={node.data.caption || ''}
                          onChange={(e) => updateNodeData(node.id, { caption: e.target.value })}
                          placeholder="Legenda do vídeo..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    )}

                    {/* 6. PDF CARD COM UPLOAD DIRETO DO PC */}
                    {node.type === 'pdf' && (
                      <div className="space-y-2.5">
                        <div className="bg-[#1c1d29] border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                              Documento PDF
                            </span>
                            <span className="text-[8px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                              PDF
                            </span>
                          </div>

                          {node.data.fileName ? (
                            <div className="bg-[#13141f] border border-amber-500/30 rounded-lg p-2 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <FileText className="w-6 h-6 text-amber-400 shrink-0" />
                                <div className="truncate flex-1">
                                  <span className="text-[10px] font-bold text-white block truncate">
                                    {node.data.fileName}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-400">{node.data.fileSize}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => triggerFileUpload(node.id, 'application/pdf,.pdf')}
                                className="text-[9px] text-amber-400 hover:text-amber-300 font-bold underline"
                              >
                                Trocar documento PDF
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => triggerFileUpload(node.id, 'application/pdf,.pdf')}
                              disabled={uploadingNodeId === node.id}
                              className="w-full py-3 px-3 bg-[#13141f] hover:bg-amber-950/30 border border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
                            >
                              <Upload className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                                {uploadingNodeId === node.id ? 'Subindo PDF...' : 'Subir arquivo PDF do computador'}
                              </span>
                              <span className="text-[8px] text-slate-500">Catálogos, propostas, contratos</span>
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={node.data.caption || ''}
                          onChange={(e) => updateNodeData(node.id, { caption: e.target.value })}
                          placeholder="Mensagem acompanhando o documento..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}

                    {/* 7. WHATSAPP / MENSAGEM / SMS */}
                    {(node.type === 'sms' || node.type === 'whatsapp' || node.type === 'email' || node.type === 'resposta') && (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={node.data.message || ''}
                          onChange={(e) => updateNodeData(node.id, { message: e.target.value })}
                          placeholder="Digite a mensagem..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-sans"
                        />
                        <div className="flex flex-wrap gap-1">
                          {['{nome}', '{telefone}', '{empresa}', '{saudacao}'].map((v) => (
                            <button
                              key={v}
                              onClick={() => insertVariable(node.id, v)}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 border border-slate-700 transition-colors"
                            >
                              + {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 8. ASSISTENTE IA CARD */}
                    {(node.type === 'ia' || node.type === 'ia_audio') && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between bg-[#1c1d29] border border-slate-800 px-3 py-1.5 rounded-xl">
                          <span className="text-[11px] font-medium text-slate-300">Status IA:</span>
                          <button
                            onClick={() => updateNodeData(node.id, { active: !node.data.active })}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all ${
                              node.data.active 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{node.data.active ? 'Ativa' : 'Pausada'}</span>
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Modelo:
                          </label>
                          <select
                            value={node.data.model || 'Gemini 2.5 Flash'}
                            onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-purple-300 font-semibold focus:outline-none"
                          >
                            <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Ultra-rápido)</option>
                            <option value="Gemini 3.8 Flash">Gemini 3.8 Flash (Recomendado)</option>
                            <option value="Gemini Pro">Gemini Pro (Raciocínio complexo)</option>
                            <option value="GPT-4o">OpenAI GPT-4o</option>
                            <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                          </select>
                        </div>

                        <input
                          type="text"
                          value={node.data.prompt || ''}
                          onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
                          placeholder="Objetivo da IA..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    )}

                    {/* 9. TIMER CARD */}
                    {node.type === 'timer' && (
                      <div className="space-y-2.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Aguardar antes de continuar:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="1"
                            value={node.data.delay || 5}
                            onChange={(e) => updateNodeData(node.id, { delay: Number(e.target.value) })}
                            className="bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none text-center font-bold"
                          />
                          <select
                            value={node.data.unit || 'minutos'}
                            onChange={(e) => updateNodeData(node.id, { unit: e.target.value })}
                            className="bg-[#1c1d29] border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="segundos">Segundos</option>
                            <option value="minutos">Minutos</option>
                            <option value="horas">Horas</option>
                            <option value="dias">Dias</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 10. GERENCIAR GRUPO CARD */}
                    {node.type === 'grupo_wa' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-300 block">
                            Ação no grupo
                          </label>
                          <select
                            value={node.data.action || 'adicionar'}
                            onChange={(e) => updateNodeData(node.id, { action: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                          >
                            <option value="criar">Criar novo grupo com o lead</option>
                            <option value="adicionar">Adicionar lead a um grupo existente</option>
                            <option value="remover">Remover lead de um grupo</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-300 block">
                            Instância do WhatsApp
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {['Inst. 1', 'Inst. 2', 'Inst. 3', 'Inst. 4'].map((inst) => (
                              <button
                                key={inst}
                                type="button"
                                onClick={() => {
                                  updateNodeData(node.id, { instance: inst });
                                  fetchGroups(inst);
                                }}
                                className={`py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  (node.data.instance || 'Inst. 1') === inst
                                    ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                                    : 'bg-[#1c1d29] text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {inst}
                              </button>
                            ))}
                          </div>
                          <p className="text-[9px] text-slate-500">
                            Ação executada pelo WhatsApp conectado na instância selecionada.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-300 block">
                            {node.data.action === 'remover' ? 'Remover do grupo' : node.data.action === 'criar' ? 'Nome do novo grupo' : 'Adicionar ao grupo'}
                          </label>

                          {node.data.action === 'criar' ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={node.data.newGroupName || ''}
                                onChange={(e) => updateNodeData(node.id, { newGroupName: e.target.value })}
                                placeholder="Ex: Mentoria - {nome}"
                                className="w-full bg-[#1c1d29] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                              />
                              <div className="flex flex-wrap gap-1">
                                {['{nome}', '{telefone}'].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => {
                                      const current = node.data.newGroupName || '';
                                      updateNodeData(node.id, { newGroupName: `${current} ${v}`.trim() });
                                    }}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700 transition-colors"
                                  >
                                    + {v}
                                  </button>
                                ))}
                              </div>

                              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                                <label className="text-[9px] font-bold text-slate-400 block">
                                  Foto do Grupo (Ícone do WhatsApp):
                                </label>
                                {node.data.groupPhotoUrl ? (
                                  <div className="bg-[#13141f] border border-emerald-500/30 rounded-xl p-2 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={node.data.groupPhotoUrl}
                                        alt="Foto do Grupo"
                                        className="w-12 h-12 object-cover rounded-full border-2 border-emerald-500/40 shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-white truncate">
                                          {node.data.groupPhotoName || 'Foto do grupo definida'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => triggerFileUpload(node.id, 'image/png,image/jpeg,image/jpg,image/webp')}
                                            className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                                          >
                                            Trocar foto
                                          </button>
                                          <span className="text-slate-600">•</span>
                                          <button
                                            type="button"
                                            onClick={() => updateNodeData(node.id, { groupPhotoUrl: '', groupPhotoBase64: '', groupPhotoName: '' })}
                                            className="text-[9px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                                          >
                                            Remover
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => triggerFileUpload(node.id, 'image/png,image/jpeg,image/jpg,image/webp')}
                                    disabled={uploadingNodeId === node.id}
                                    className="w-full py-2 px-3 bg-[#13141f] hover:bg-emerald-950/30 border border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-xl flex items-center justify-center gap-2 transition-all group cursor-pointer"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                                      {uploadingNodeId === node.id ? 'Enviando foto...' : 'Escolher foto do grupo'}
                                    </span>
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                                <label className="text-[9px] font-bold text-slate-400 block">
                                  Mensagem de Boas-Vindas no Grupo (Opcional):
                                </label>
                                <textarea
                                  rows={2}
                                  value={node.data.welcomeMessage || ''}
                                  onChange={(e) => updateNodeData(node.id, { welcomeMessage: e.target.value })}
                                  placeholder="Ex: Olá {nome}, seja muito bem-vindo ao seu grupo VIP exclusivo!"
                                  className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {node.data.groupName && (
                                <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 font-semibold flex items-center justify-between">
                                  <span className="truncate">✓ Grupo: <strong>{node.data.groupName}</strong></span>
                                  <button
                                    type="button"
                                    onClick={() => updateNodeData(node.id, { groupId: '', groupName: '' })}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 underline shrink-0 ml-2"
                                  >
                                    Trocar
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center justify-between">
                                <span className="text-[9px] text-slate-400">Selecionar da lista sincronizada:</span>
                                <button
                                  type="button"
                                  onClick={() => fetchGroups(node.data.instance || 'Inst. 1')}
                                  disabled={isFetchingGroups}
                                  className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-[#10111a] px-2 py-0.5 rounded border border-emerald-500/30 cursor-pointer"
                                >
                                  <RefreshCw className={`w-2.5 h-2.5 ${isFetchingGroups ? 'animate-spin' : ''}`} />
                                  <span>{isFetchingGroups ? 'Sincronizando...' : 'Sincronizar Grupos'}</span>
                                </button>
                              </div>

                              {groupsList.length > 0 ? (
                                <select
                                  value={node.data.groupId || ''}
                                  onChange={(e) => {
                                    const selected = groupsList.find(g => g.id === e.target.value);
                                    updateNodeData(node.id, { 
                                      groupId: e.target.value,
                                      groupName: selected ? selected.name : ''
                                    });
                                  }}
                                  className="w-full bg-[#1c1d29] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                                >
                                  <option value="">Selecione um grupo...</option>
                                  {groupsList.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.name} ({g.participantsCount} membros)
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="bg-[#10111a] border border-slate-800 rounded-xl p-2.5 text-center space-y-1">
                                  <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Nenhum grupo sincronizado no momento.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => fetchGroups(node.data.instance || 'Inst. 1')}
                                    className="text-[10px] text-emerald-400 font-bold hover:underline"
                                  >
                                    Clique aqui para sincronizar agora
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-[9px] text-slate-500">
                            {node.data.action === 'criar'
                              ? 'O bot cria o grupo no WhatsApp com o lead e envia o link caso ele possua privacidade de contato.'
                              : node.data.action === 'remover' 
                              ? 'O lead será removido do grupo selecionado.' 
                              : 'O lead será adicionado ao grupo selecionado (ou receberá o link se tiver privacidade ativa).'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 11. FINALIZAR FLUXO CARD */}
                    {node.type === 'finalizar' && (
                      <div className="py-2 px-1">
                        <div className="flex items-center gap-2 text-rose-400/90 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span>Encerra o funil ao chegar aqui</span>
                        </div>
                      </div>
                    )}

                    {/* 12. CONECTAR A OUTRO FLUXO CARD */}
                    {node.type === 'conectar_fluxo' && (
                      <div className="space-y-2.5">
                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5 flex items-start gap-2.5">
                          <LinkIcon className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[11px] font-bold text-cyan-300">Conectar a Outro Fluxo</h4>
                            <p className="text-[10px] text-cyan-400/80 leading-tight mt-0.5">
                              Quando o lead chegar neste bloco, o fluxo selecionado será iniciado automaticamente
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-300 block">
                            Fluxo de Destino
                          </label>
                          <select
                            value={node.data.targetFlow || ''}
                            onChange={(e) => updateNodeData(node.id, { targetFlow: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-purple-500/50 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                          >
                            <option value="">Selecione um fluxo...</option>
                            <option value="Fluxo Principal de Vendas">Fluxo Principal de Vendas</option>
                            <option value="Funil de Boas-Vindas & Onboarding">Funil de Boas-Vindas & Onboarding</option>
                            <option value="Recuperação de Boleto / PIX">Recuperação de Boleto / PIX</option>
                            <option value="Suporte & Atendimento Humano">Suporte & Atendimento Humano</option>
                            <option value="Pós-Venda e Fidelização">Pós-Venda e Fidelização</option>
                          </select>
                        </div>

                        <div className="bg-[#12141f] border border-slate-800/80 rounded-xl p-2 space-y-1">
                          <div className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                            <span>💡 Como funciona</span>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-relaxed">
                            O lead será redirecionado para o fluxo selecionado, iniciando a partir do bloco escolhido. Se nenhum bloco for selecionado, iniciará após o gatilho do fluxo de destino.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* CONFIGURAÇÃO DE TEMPO LIMITE DE RESPOSTA (FALLBACK) */}
                    {/* Disponível para mensagens, mídias e interações */}
                    {/* ======================================================== */}
                    {node.type !== 'inicio' && node.type !== 'timer' && node.type !== 'condicao' && node.type !== 'cakto' && node.type !== 'webhook' && node.type !== 'grupo_wa' && node.type !== 'finalizar' && node.type !== 'conectar_fluxo' && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Aguardar resposta do cliente
                          </span>
                          <input
                            type="checkbox"
                            checked={!!node.data.waitForResponse}
                            onChange={(e) => updateNodeData(node.id, { waitForResponse: e.target.checked })}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900 cursor-pointer"
                          />
                        </div>

                        {node.data.waitForResponse && (
                          <div className="bg-[#161724] border border-amber-500/30 rounded-xl p-2.5 space-y-2 animate-fadeIn">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[10px] text-amber-300 font-semibold">Tempo limite:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="5"
                                  value={node.data.timeoutSeconds || 30}
                                  onChange={(e) => updateNodeData(node.id, { timeoutSeconds: Number(e.target.value) })}
                                  className="w-14 bg-[#10111a] border border-amber-500/40 rounded-lg px-2 py-0.5 text-center text-xs text-amber-300 font-bold focus:outline-none"
                                />
                                <select
                                  value={node.data.timeoutUnit || 'segundos'}
                                  onChange={(e) => updateNodeData(node.id, { timeoutUnit: e.target.value })}
                                  className="bg-[#10111a] border border-amber-500/40 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none"
                                >
                                  <option value="segundos">seg</option>
                                  <option value="minutos">min</option>
                                  <option value="horas">h</option>
                                </select>
                              </div>
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">
                              Card tem <strong>2 saídas</strong>: Conexão 1 (Respondeu) e Conexão 2 (Tempo esgotado).
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ports / Handles */}
                  {/* Left Port (Input) - Except for Início */}
                  {node.type !== 'inicio' && (
                    <div
                      onMouseEnter={() => canBeTarget && setHoveredTargetPortId(node.id)}
                      onMouseLeave={() => setHoveredTargetPortId(null)}
                      onMouseDown={(e) => { e.stopPropagation(); }}
                      onPointerDown={(e) => { e.stopPropagation(); }}
                      onMouseUp={(e) => handleInputPortRelease(node.id, e)}
                      onPointerUp={(e) => handleInputPortRelease(node.id, e)}
                      onClick={(e) => handleInputPortRelease(node.id, e)}
                      title="Entrada (Solte ou clique aqui para conectar)"
                      className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-6 h-6 rounded-full bg-slate-900 border-2 transition-all flex items-center justify-center cursor-pointer z-30 group ${
                        isHoveredTarget 
                          ? 'scale-150 border-emerald-400 bg-emerald-500 shadow-lg shadow-emerald-500/50' 
                          : canBeTarget 
                          ? 'scale-125 border-cyan-400 bg-cyan-950 animate-pulse' 
                          : node.type === 'finalizar'
                          ? 'border-rose-500 hover:scale-125 hover:bg-rose-900'
                          : 'border-purple-500 hover:scale-125 hover:bg-purple-600'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        isHoveredTarget 
                          ? 'bg-white' 
                          : node.type === 'finalizar'
                          ? 'bg-rose-400 group-hover:bg-white'
                          : 'bg-purple-300 group-hover:bg-white'
                      }`}></div>
                    </div>
                  )}

                  {/* Right Ports (Output) - Omitted for Finalizar Fluxo */}
                  {node.type !== 'finalizar' && (
                    hasWaitForResponse ? (
                      <>
                        {/* Porta 1: SE RESPONDER (Verde / Cyan) */}
                        <div
                          onMouseDown={(e) => handleOutputPortMouseDown(node.id, 'response', e)}
                          title="Conexão 1: Se o cliente responder"
                          style={{ top: '40%' }}
                          className={`absolute right-0 -translate-y-1/2 translate-x-3 w-6 h-6 rounded-full bg-slate-900 border-2 border-emerald-400 hover:bg-emerald-500 hover:scale-135 transition-all flex items-center justify-center cursor-crosshair z-20 group shadow-md ${
                            connectingFrom?.nodeId === node.id && connectingFrom.handleType === 'response'
                              ? 'border-emerald-300 bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-135' 
                              : ''
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-400 group-hover:bg-white"></div>
                          <span className="absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-bold text-emerald-400 bg-[#13141f] px-1.5 py-0.5 rounded border border-emerald-500/30 opacity-80 group-hover:opacity-100">
                            Respondeu
                          </span>
                        </div>

                        {/* Porta 2: SE NÃO RESPONDER / TIMEOUT (Laranja / Âmbar) */}
                        <div
                          onMouseDown={(e) => handleOutputPortMouseDown(node.id, 'timeout', e)}
                          title={`Conexão 2: Se não responder em ${node.data.timeoutSeconds || 30}s`}
                          style={{ top: '76%' }}
                          className={`absolute right-0 -translate-y-1/2 translate-x-3 w-6 h-6 rounded-full bg-slate-900 border-2 border-amber-400 hover:bg-amber-500 hover:scale-135 transition-all flex items-center justify-center cursor-crosshair z-20 group shadow-md ${
                            connectingFrom?.nodeId === node.id && connectingFrom.handleType === 'timeout'
                              ? 'border-amber-300 bg-amber-500 shadow-lg shadow-amber-500/50 scale-135' 
                              : ''
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full bg-amber-400 group-hover:bg-white"></div>
                          <span className="absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-bold text-amber-400 bg-[#13141f] px-1.5 py-0.5 rounded border border-amber-500/30 opacity-80 group-hover:opacity-100">
                            Tempo ({node.data.timeoutSeconds || 30}s)
                          </span>
                        </div>
                      </>
                    ) : (
                      /* Porta Única Normal */
                      <div
                        onMouseDown={(e) => handleOutputPortMouseDown(node.id, 'default', e)}
                        title="Saída (Clique e arraste para ligar a outro card)"
                        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-6 h-6 rounded-full bg-slate-900 border-2 transition-all flex items-center justify-center cursor-crosshair z-20 group hover:scale-135 ${
                          isConnectingSource && connectingFrom?.handleType === 'default'
                            ? 'border-cyan-400 bg-cyan-500 shadow-lg shadow-cyan-500/50 scale-125' 
                            : 'border-blue-400 hover:border-cyan-400 hover:bg-blue-600'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-white group-hover:scale-110"></div>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Floating Quick Tools Dock */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#12141F]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-1.5">
          <button 
            onClick={() => addNode('inicio', 'WhatsApp')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Gatilho WhatsApp"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">WhatsApp</span>
          </button>

          <button 
            onClick={() => addNode('sms', 'Texto')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Mensagem de Texto"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Texto</span>
          </button>

          <button 
            onClick={() => addNode('audio', 'Áudio')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Áudio do PC"
          >
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Áudio</span>
          </button>

          <button 
            onClick={() => addNode('imagem', 'Imagem')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Imagem do PC"
          >
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Imagem</span>
          </button>

          <button 
            onClick={() => addNode('video', 'Vídeo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Vídeo MP4 (Máx 50MB)"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Vídeo</span>
          </button>

          <button 
            onClick={() => addNode('pdf', 'PDF')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Documento PDF do PC"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">PDF</span>
          </button>

          <button 
            onClick={() => addNode('timer', 'Timer')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Temporizador"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Timer</span>
          </button>

          <button 
            onClick={() => addNode('ia', 'Agente IA')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Inteligência Artificial"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <Bot className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Agente IA</span>
          </button>

          <button 
            onClick={() => addNode('webhook', 'Webhook')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Webhook de Vendas / Checkout"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <WebhookIcon className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Webhook</span>
          </button>

          <button 
            onClick={() => addNode('grupo_wa', 'Gerenciar Grupo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Gerenciar Grupos do WhatsApp"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Grupos</span>
          </button>

          <button 
            onClick={() => addNode('conectar_fluxo', 'Conectar Fluxo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Conectar a Outro Fluxo Cadastrado"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <LinkIcon className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Conectar</span>
          </button>

          <button 
            onClick={() => addNode('finalizar', 'Finalizar Fluxo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Finalizar Funil / Fluxo"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <StopCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Finalizar</span>
          </button>

          <div className="h-6 w-px bg-white/[0.08] mx-1"></div>

          <button 
            onClick={() => setShowPaletteModal(true)} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-all group"
            title="Abrir Galeria Completa de Cards"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-indigo-300">Todos</span>
          </button>
        </div>
      </div>

      {/* MODAL / GAVETA DE CARDS COMPLETA */}
      {showPaletteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#12131f] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-[#161827]">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Galeria de Cards e Ações do Fluxo
                </h3>
                <p className="text-xs text-slate-400">
                  Clique em qualquer item para adicionar instantaneamente ao canvas.
                </p>
              </div>
              <button 
                onClick={() => setShowPaletteModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* DISPAROS */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  DISPAROS
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <button onClick={() => addNode('inicio', 'WhatsApp')} className="p-3 bg-[#181a28] hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">WhatsApp</span>
                  </button>

                  <button onClick={() => addNode('sms', 'SMS')} className="p-3 bg-[#181a28] hover:bg-blue-950/40 border border-slate-800 hover:border-blue-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">SMS</span>
                  </button>

                  <button onClick={() => addNode('email', 'E-mail')} className="p-3 bg-[#181a28] hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">E-mail</span>
                  </button>

                  <button onClick={() => addNode('ligacao', 'Ligação')} className="p-3 bg-[#181a28] hover:bg-teal-950/40 border border-slate-800 hover:border-teal-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Ligação</span>
                  </button>

                  <button onClick={() => addNode('contato', 'Contato')} className="p-3 bg-[#181a28] hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Contato</span>
                  </button>
                </div>
              </div>

              {/* MÍDIA */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  MÍDIA (ARMAZENAMENTO DO SISTEMA E UPLOAD DO PC)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => addNode('audio', 'Áudio')} className="p-3 bg-[#181a28] hover:bg-violet-950/40 border border-slate-800 hover:border-violet-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mic className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Áudio</span>
                    <span className="text-[9px] text-slate-500">MP3, WAV, OGG, OPUS</span>
                  </button>

                  <button onClick={() => addNode('imagem', 'Imagem')} className="p-3 bg-[#181a28] hover:bg-pink-950/40 border border-slate-800 hover:border-pink-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Imagem</span>
                    <span className="text-[9px] text-slate-500">PNG, JPG, WEBP</span>
                  </button>

                  <button onClick={() => addNode('video', 'Vídeo')} className="p-3 bg-[#181a28] hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Video className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Vídeo</span>
                    <span className="text-[9px] text-rose-300 font-semibold">MP4 (Máx 50MB)</span>
                  </button>

                  <button onClick={() => addNode('pdf', 'PDF')} className="p-3 bg-[#181a28] hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">PDF</span>
                    <span className="text-[9px] text-slate-500">Documento / Proposta</span>
                  </button>
                </div>
              </div>

              {/* CONTROLE */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  CONTROLE
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button onClick={() => addNode('timer', 'Timer')} className="p-3 bg-[#181a28] hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Timer</span>
                  </button>

                  <button onClick={() => addNode('condicao', 'Condição')} className="p-3 bg-[#181a28] hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Scissors className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Condição</span>
                  </button>

                  <button onClick={() => addNode('webhook', 'Webhook / Integrações')} className="p-3 bg-[#181a28] hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <WebhookIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Webhook Vendas</span>
                  </button>
                </div>
              </div>

              {/* IA */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  INTELIGÊNCIA ARTIFICIAL (IA)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => addNode('ia', 'Agente IA')} className="p-3 bg-[#181a28] hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bot className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Agente IA</span>
                  </button>

                  <button onClick={() => addNode('ia_audio', 'IA Áudio')} className="p-3 bg-[#181a28] hover:bg-violet-950/40 border border-slate-800 hover:border-violet-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">IA Áudio</span>
                  </button>

                  <button onClick={() => addNode('ia_video', 'IA Vídeo')} className="p-3 bg-[#181a28] hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Video className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">IA Vídeo</span>
                  </button>

                  <button onClick={() => addNode('ia_ligacao', 'IA Ligação')} className="p-3 bg-[#181a28] hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">IA Ligação</span>
                  </button>
                </div>
              </div>

              {/* GERENCIAMENTO & FLUXO */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  GERENCIAMENTO & FLUXO
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button onClick={() => addNode('grupo_wa', 'Gerenciar Grupo')} className="p-3 bg-[#181a28] hover:bg-teal-950/40 border border-slate-800 hover:border-teal-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Gerenciar Grupo</span>
                    <span className="text-[9px] text-slate-500">Adicionar / Remover Lead</span>
                  </button>

                  <button onClick={() => addNode('conectar_fluxo', 'Conectar Fluxo')} className="p-3 bg-[#181a28] hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Conectar a Outro Fluxo</span>
                    <span className="text-[9px] text-slate-500">Transição de Funis</span>
                  </button>

                  <button onClick={() => addNode('finalizar', 'Finalizar Fluxo')} className="p-3 bg-[#181a28] hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded-2xl flex flex-col items-center gap-2 transition-all group text-left">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <StopCircle className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">Finalizar Fluxo</span>
                    <span className="text-[9px] text-slate-500">Encerra o funil</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Testar Funil */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#11131f] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scaleUp">
            {/* Header do Modal */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Testar Funil de Automação</h3>
                  <p className="text-[11px] text-slate-400">Envie o fluxo imediatamente para seu WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestResult(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso Explicativo */}
            <div className="bg-[#181a28] p-3.5 rounded-xl border border-slate-800/80 mb-4 text-xs text-slate-300 leading-relaxed">
              <p>
                O robô iniciará a execução deste funil <strong>({currentFlowName})</strong> para o número informado abaixo, disparando os textos, mídias e lógicas configuradas.
              </p>
            </div>

            {/* Formulário do Telefone */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1.5 flex items-center justify-between">
                  <span>Número de Telefone</span>
                  <span className="text-[10px] text-amber-400 font-normal">Obrigatório o + do país</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={testPhoneInput}
                    onChange={e => {
                      let val = e.target.value;
                      // Se o usuário apagar o +, reaplica o +
                      if (!val.startsWith('+')) {
                        val = '+' + val.replace(/\+/g, '');
                      }
                      setTestPhoneInput(val);
                      setTestResult(null);
                    }}
                    placeholder="+5511999999999"
                    className="w-full bg-[#181a28] border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Exemplos: <strong>+5511999999999</strong> (Brasil), <strong>+351912345678</strong> (Portugal).
                </p>
              </div>

              {/* Mensagem de Feedback (Sucesso / Erro) */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Ações do Rodapé */}
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestResult(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleSendTestFlow}
                disabled={isSendingTest || !testPhoneInput.trim() || testPhoneInput.trim() === '+'}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Disparando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Disparar Teste</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
