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
  StopCircle
} from 'lucide-react';
import { FlowNode, FlowEdge } from '../types';

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

export const FlowBuilder: React.FC = () => {
  // Load saved state or default
  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    try {
      const saved = localStorage.getItem('nyxzap_flow_builder_nodes');
      return saved ? JSON.parse(saved) : INITIAL_NODES;
    } catch {
      return INITIAL_NODES;
    }
  });

  const [edges, setEdges] = useState<FlowEdge[]>(() => {
    try {
      const saved = localStorage.getItem('nyxzap_flow_builder_edges');
      return saved ? JSON.parse(saved) : INITIAL_EDGES;
    } catch {
      return INITIAL_EDGES;
    }
  });

  // Load flow from backend API
  useEffect(() => {
    fetch('/api/flow')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
          if (Array.isArray(data.edges)) {
            setEdges(data.edges);
          }
          if (data.active !== undefined) {
            setFlowActive(data.active);
          }
        }
      })
      .catch(err => console.error('[FlowBuilder] Erro ao carregar fluxo do servidor:', err));
  }, []);

  const [zoom, setZoom] = useState<number>(1.05);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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
      localStorage.setItem('nyxzap_flow_builder_nodes', JSON.stringify(nodes));
      localStorage.setItem('nyxzap_flow_builder_edges', JSON.stringify(edges));

      // Post to backend database so WhatsApp engine executes it instantly
      await fetch('/api/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
          active: flowActive
        })
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Reset to default
  const handleResetFlow = () => {
    if (confirm('Deseja restaurar o fluxo para a configuração inicial padrão?')) {
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
      alert('Erro: O vídeo excede o tamanho máximo de 50MB.');
      return;
    }

    setUploadingNodeId(nodeId);

    const formatBytes = (bytes: number) => {
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        updateNodeData(nodeId, {
          fileUrl: data.url,
          fileName: file.name,
          fileSize: formatBytes(file.size)
        });
      } else {
        const localUrl = URL.createObjectURL(file);
        updateNodeData(nodeId, {
          fileUrl: localUrl,
          fileName: file.name,
          fileSize: formatBytes(file.size)
        });
      }
    } catch {
      const localUrl = URL.createObjectURL(file);
      updateNodeData(nodeId, {
        fileUrl: localUrl,
        fileName: file.name,
        fileSize: formatBytes(file.size)
      });
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

  return (
    <div className="space-y-2 animate-fadeIn flex flex-col h-full w-full p-2 relative flex-1 overflow-hidden">
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white">Fluxo</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                Visual Builder
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gatilhos de WhatsApp, IA, Mídias diretas do PC e Conexões Inteligentes.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Button to open Full Cards Gallery */}
          <button
            onClick={() => setShowPaletteModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#1a1b29] hover:bg-slate-800 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Adicionar Card</span>
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
        className="flex-1 bg-[#090a0f] border border-slate-800/80 rounded-2xl relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
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
                  className={`pointer-events-auto rounded-2xl bg-[#13141c] border shadow-2xl relative select-none ${
                    draggingId === node.id ? '' : 'transition-colors'
                  } ${
                    isSelected 
                      ? 'ring-2 ring-purple-500 border-purple-500/80 shadow-purple-500/20' 
                      : 'border-[#262838] hover:border-slate-600'
                  } ${isConnectingSource ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-cyan-500/30' : ''} ${
                    isHoveredTarget ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-emerald-500/30' : ''
                  }`}
                >
                  {/* Top Bar Header */}
                  <div 
                    className={`px-3.5 py-2.5 rounded-t-2xl flex items-center justify-between text-xs font-bold text-white cursor-move ${
                      node.type === 'inicio' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' :
                      node.type === 'ia' || node.type === 'ia_audio' || node.type === 'ia_video' || node.type === 'ia_ligacao' ? 'bg-gradient-to-r from-purple-600 to-indigo-700' :
                      node.type === 'condicao' ? 'bg-gradient-to-r from-amber-600 to-orange-700' :
                      node.type === 'audio' ? 'bg-gradient-to-r from-violet-600 to-purple-700' :
                      node.type === 'imagem' ? 'bg-gradient-to-r from-pink-600 to-rose-700' :
                      node.type === 'video' ? 'bg-gradient-to-r from-rose-600 to-red-700' :
                      node.type === 'pdf' ? 'bg-gradient-to-r from-amber-600 to-yellow-700' :
                      node.type === 'timer' ? 'bg-gradient-to-r from-cyan-600 to-blue-700' :
                      node.type === 'cakto' || node.type === 'webhook' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' :
                      node.type === 'grupo_wa' ? 'bg-gradient-to-r from-emerald-800 to-teal-900 border-b border-emerald-700/40' :
                      node.type === 'finalizar' ? 'bg-gradient-to-r from-rose-900 to-red-950 border-b border-rose-800/40' :
                      node.type === 'conectar_fluxo' ? 'bg-gradient-to-r from-cyan-800 to-blue-900 border-b border-cyan-700/40' :
                      'bg-gradient-to-r from-blue-600 to-indigo-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {node.type === 'inicio' && <Smartphone className="w-3.5 h-3.5 text-white" />}
                      {(node.type === 'ia' || node.type === 'ia_audio') && <Sparkles className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'condicao' && <Scissors className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'audio' && <Mic className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'imagem' && <ImageIcon className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'video' && <Video className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'pdf' && <FileText className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'timer' && <Clock className="w-3.5 h-3.5 text-white" />}
                      {(node.type === 'cakto' || node.type === 'webhook') && <WebhookIcon className="w-3.5 h-3.5 text-white" />}
                      {(node.type === 'sms' || node.type === 'whatsapp') && <MessageSquare className="w-3.5 h-3.5 text-white" />}
                      {node.type === 'grupo_wa' && <Users className="w-3.5 h-3.5 text-emerald-300" />}
                      {node.type === 'finalizar' && <StopCircle className="w-3.5 h-3.5 text-rose-300" />}
                      {node.type === 'conectar_fluxo' && <LinkIcon className="w-3.5 h-3.5 text-cyan-300" />}
                      <span className="tracking-wide uppercase text-[11px] font-black">{node.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-90 hover:opacity-100">
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
                            <option value="adicionar">Adicionar lead a um grupo</option>
                            <option value="remover">Remover lead de um grupo</option>
                            <option value="criar">Criar novo grupo com o lead</option>
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
                                onClick={() => updateNodeData(node.id, { instance: inst })}
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
                            Escolha a instância para listar os grupos que você participa.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-300 block">
                            {node.data.action === 'remover' ? 'Remover do grupo' : node.data.action === 'criar' ? 'Nome do novo grupo' : 'Adicionar ao grupo'}
                          </label>
                          {node.data.action === 'criar' ? (
                            <input
                              type="text"
                              value={node.data.newGroupName || ''}
                              onChange={(e) => updateNodeData(node.id, { newGroupName: e.target.value })}
                              placeholder="Ex: VIP - Suporte {nome}"
                              className="w-full bg-[#1c1d29] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          ) : (
                            <div className="bg-[#10111a] border border-slate-800 rounded-xl p-2.5 text-center space-y-1">
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                Nenhum grupo encontrado. Abra o WhatsApp → aba <strong>WhatsApp Grupos</strong> para sincronizar seus grupos.
                              </p>
                            </div>
                          )}
                          <p className="text-[9px] text-slate-500">
                            {node.data.action === 'remover' 
                              ? 'O lead será removido do grupo selecionado.' 
                              : 'O lead será adicionado ao grupo selecionado. Ele pode precisar aceitar o convite.'}
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
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#12131c]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-2">
          <button 
            onClick={() => addNode('inicio', 'WhatsApp')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Gatilho WhatsApp"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">WhatsApp</span>
          </button>

          <button 
            onClick={() => addNode('sms', 'Texto')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Mensagem de Texto"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Texto</span>
          </button>

          <button 
            onClick={() => addNode('audio', 'Áudio')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Áudio do PC"
          >
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Áudio</span>
          </button>

          <button 
            onClick={() => addNode('imagem', 'Imagem')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Imagem do PC"
          >
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Imagem</span>
          </button>

          <button 
            onClick={() => addNode('video', 'Vídeo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Vídeo MP4 (Máx 50MB)"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Vídeo</span>
          </button>

          <button 
            onClick={() => addNode('pdf', 'PDF')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Documento PDF do PC"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">PDF</span>
          </button>

          <button 
            onClick={() => addNode('timer', 'Timer')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Temporizador"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Timer</span>
          </button>

          <button 
            onClick={() => addNode('ia', 'Agente IA')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Inteligência Artificial"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Agente IA</span>
          </button>

          <button 
            onClick={() => addNode('webhook', 'Webhook')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Webhook de Vendas / Checkout"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <WebhookIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Webhook</span>
          </button>

          <button 
            onClick={() => addNode('grupo_wa', 'Gerenciar Grupo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Gerenciar Grupos do WhatsApp"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Grupos</span>
          </button>

          <button 
            onClick={() => addNode('conectar_fluxo', 'Conectar Fluxo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Conectar a Outro Fluxo Cadastrado"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <LinkIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Conectar</span>
          </button>

          <button 
            onClick={() => addNode('finalizar', 'Finalizar Fluxo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Finalizar Funil / Fluxo"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <StopCircle className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Finalizar</span>
          </button>

          <div className="h-6 w-px bg-slate-700/60 mx-1"></div>

          <button 
            onClick={() => setShowPaletteModal(true)} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-purple-900/30 transition-all group"
            title="Abrir Galeria Completa de Cards"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold text-purple-300 group-hover:text-white">Todos</span>
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
    </div>
  );
};
