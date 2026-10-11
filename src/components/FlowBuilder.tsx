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
  Activity
} from 'lucide-react';
import { FlowNode, FlowEdge } from '../types';

// Standard dimensions for calculating port positions precisely
const getNodeDimensions = (type: FlowNode['type']) => {
  switch (type) {
    case 'inicio':
      return { width: 260, height: 260 };
    case 'ia':
      return { width: 260, height: 250 };
    case 'condicao':
      return { width: 250, height: 210 };
    case 'sms':
    case 'whatsapp':
      return { width: 260, height: 200 };
    case 'audio':
      return { width: 250, height: 180 };
    case 'imagem':
      return { width: 250, height: 200 };
    case 'video':
      return { width: 250, height: 200 };
    case 'timer':
      return { width: 250, height: 160 };
    case 'cakto':
      return { width: 230, height: 240 };
    default:
      return { width: 260, height: 200 };
  }
};

const getNodeOutputPos = (node: FlowNode) => {
  const { width, height } = getNodeDimensions(node.type);
  return { x: node.x + width, y: node.y + height / 2 };
};

const getNodeInputPos = (node: FlowNode) => {
  const { height } = getNodeDimensions(node.type);
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
    id: 'node-2',
    type: 'ia',
    title: 'Assistente IA',
    x: 520,
    y: 120,
    data: { 
      tone: 'Profissional', 
      model: 'Gemini 2.5 Flash', 
      active: true,
      prompt: 'Atenda o cliente tirando dúvidas sobre planos e preços' 
    }
  },
  {
    id: 'node-3',
    type: 'condicao',
    title: 'Condição',
    x: 940,
    y: 300,
    data: { 
      field: 'Score do Lead', 
      operator: '>=', 
      value: '70' 
    }
  },
  {
    id: 'node-4',
    type: 'sms',
    title: 'Mensagem',
    x: 940,
    y: 70,
    data: { 
      message: 'Olá {nome}, como posso te ajudar hoje?' 
    }
  },
  {
    id: 'node-5',
    type: 'cakto',
    title: 'Webhook Cakto',
    x: 60,
    y: 420,
    data: { 
      events: ['Aprovada', 'PIX Gerado', 'Boleto Gerado'],
      activeEvents: ['Aprovada', 'PIX Gerado']
    }
  }
];

const INITIAL_EDGES: FlowEdge[] = [
  { id: 'e1-2', from: 'node-1', to: 'node-2', label: 'Disparo' },
  { id: 'e5-2', from: 'node-5', to: 'node-2', label: 'Status' },
  { id: 'e2-4', from: 'node-2', to: 'node-4', label: 'Sucesso' },
  { id: 'e2-3', from: 'node-2', to: 'node-3', label: 'Qualificação' }
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

  const [zoom, setZoom] = useState<number>(1.16);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dynamic connection line state
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredTargetPortId, setHoveredTargetPortId] = useState<string | null>(null);

  // Input states for cards
  const [newKeywordInput, setNewKeywordInput] = useState<{ [nodeId: string]: string }>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flowActive, setFlowActive] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Cancel connection on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectingFrom) {
        setConnectingFrom(null);
        setHoveredTargetPortId(null);
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
    
    const node = nodes.find(n => n.id === id);
    if (!node || !containerRef.current) return;

    setSelectedId(id);
    setDraggingId(id);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

    setDragOffset({
      x: mouseCanvasX - node.x,
      y: mouseCanvasY - node.y
    });
  };

  // Canvas Pan & Mouse handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !draggingId) {
      if (connectingFrom) {
        // Clicking on canvas while connecting cancels connection
        setConnectingFrom(null);
        setHoveredTargetPortId(null);
        return;
      }
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

    if (connectingFrom) {
      setCursorPos({ x: mouseCanvasX, y: mouseCanvasY });
    }

    if (draggingId) {
      setNodes(prev => prev.map(n => 
        n.id === draggingId 
          ? { 
              ...n, 
              x: Math.round(mouseCanvasX - dragOffset.x), 
              y: Math.round(mouseCanvasY - dragOffset.y) 
            } 
          : n
      ));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setIsPanning(false);
  };

  // Start Connection from Output Port
  const handleOutputPortMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!containerRef.current) return;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const startPos = getNodeOutputPos(node);
    setConnectingFrom({ nodeId, x: startPos.x, y: startPos.y });

    const rect = containerRef.current.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;
    setCursorPos({ x: mouseCanvasX, y: mouseCanvasY });
  };

  // Complete Connection at Input Port
  const handleInputPortMouseUp = (targetNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (connectingFrom && connectingFrom.nodeId !== targetNodeId) {
      // Avoid duplicate edges
      const exists = edges.some(ed => ed.from === connectingFrom.nodeId && ed.to === targetNodeId);
      if (!exists) {
        const newEdge: FlowEdge = {
          id: `e-${connectingFrom.nodeId}-${targetNodeId}-${Date.now()}`,
          from: connectingFrom.nodeId,
          to: targetNodeId,
          label: 'Disparo'
        };
        setEdges(prev => [...prev, newEdge]);
      }
    }
    setConnectingFrom(null);
    setHoveredTargetPortId(null);
  };

  // Save Flow
  const handleSaveFlow = () => {
    try {
      localStorage.setItem('nyxzap_flow_builder_nodes', JSON.stringify(nodes));
      localStorage.setItem('nyxzap_flow_builder_edges', JSON.stringify(edges));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset to default
  const handleResetFlow = () => {
    if (confirm('Deseja restaurar o fluxo para a configuração inicial padrão?')) {
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
      setZoom(1.16);
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

  // Add new node from dock
  const addNode = (type: FlowNode['type'], title: string) => {
    const defaultData: Record<string, any> = {};
    if (type === 'inicio') {
      defaultData.trigger = 'palavra_chave';
      defaultData.keywords = ['atendimento'];
      defaultData.instance = 'Todas';
    } else if (type === 'ia') {
      defaultData.tone = 'Profissional';
      defaultData.model = 'Gemini 2.5 Flash';
      defaultData.active = true;
      defaultData.prompt = 'Atenda o cliente tirando dúvidas';
    } else if (type === 'condicao') {
      defaultData.field = 'Score do Lead';
      defaultData.operator = '>=';
      defaultData.value = '50';
    } else if (type === 'sms' || type === 'whatsapp') {
      defaultData.message = 'Olá {nome}, como posso te ajudar hoje?';
    } else if (type === 'audio') {
      defaultData.audioUrl = '';
      defaultData.delaySeconds = 3;
      defaultData.title = 'Áudio Gravado na Hora';
    } else if (type === 'imagem') {
      defaultData.imageUrl = 'https://placehold.co/600x400/png';
      defaultData.caption = 'Veja nossos produtos e opções!';
    } else if (type === 'video') {
      defaultData.videoUrl = '';
      defaultData.caption = 'Assista ao vídeo explicativo!';
    } else if (type === 'timer') {
      defaultData.delay = 5;
      defaultData.unit = 'minutos';
    } else if (type === 'cakto') {
      defaultData.events = ['Aprovada', 'PIX Gerado', 'Boleto Gerado', 'Reembolsado'];
      defaultData.activeEvents = ['Aprovada'];
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

  // Cakto event toggle helper
  const toggleCaktoEvent = (nodeId: string, eventName: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const currentActives: string[] = node?.data?.activeEvents || [];
    const newActives = currentActives.includes(eventName)
      ? currentActives.filter(e => e !== eventName)
      : [...currentActives, eventName];
    updateNodeData(nodeId, { activeEvents: newActives });
  };

  // Insert variable into message helper
  const insertVariable = (nodeId: string, varName: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const currentMsg = node?.data?.message || '';
    updateNodeData(nodeId, { message: `${currentMsg} ${varName}` });
  };

  return (
    <div className="space-y-3 animate-fadeIn flex flex-col h-[calc(100vh-125px)]">
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
              Gatilhos de WhatsApp, IA, Condições e Funis. Use o <strong className="text-slate-200">scroll do mouse</strong> para dar zoom.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
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
            {flowActive ? 'Fluxo Ativo no WhatsApp' : 'Fluxo Pausado'}
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
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title="Resetar Zoom (100%)"
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
              <strong>Conectando linha:</strong> Solte ou clique no <strong>ponto circular à esquerda</strong> do card desejado para conectar.
            </span>
          </div>
          <button 
            onClick={() => setConnectingFrom(null)}
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
          <span>Arraste o ponto direito de um card para ligar a outro • Roda do mouse = Zoom ({Math.round(zoom * 100)}%)</span>
        </div>

        {/* Zoom & Pan Transform Container */}
        <div 
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '4000px',
            height: '4000px',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {/* SVG Connections Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-auto z-0 overflow-visible">
            <defs>
              {/* CSS Animation Keyframes for glowing flowing edges */}
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

              {/* Gradients */}
              <linearGradient id="flowGradActive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#38bdf8" />
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

              const p1 = getNodeOutputPos(src);
              const p2 = getNodeInputPos(tgt);

              const x1 = p1.x;
              const y1 = p1.y;
              const x2 = p2.x;
              const y2 = p2.y;
              const dx = Math.max(50, Math.abs(x2 - x1) / 2);

              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={edge.id} className="group cursor-pointer">
                  {/* Outer Background Glow */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="7"
                    strokeOpacity="0.25"
                    strokeLinecap="round"
                    filter="url(#glowEffect)"
                  />

                  {/* Base Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeOpacity="0.7"
                  />

                  {/* Animated Flowing Particles / Dashes */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="url(#flowGradActive)"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    className="flowing-edge"
                  />

                  {/* Moving Particle Dot traversing the path */}
                  <circle r="3.5" fill="#38bdf8" filter="url(#glowEffect)">
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
                      x="-36" 
                      y="-11" 
                      width="72" 
                      height="22" 
                      rx="11" 
                      fill="#13141f" 
                      stroke="#475569" 
                      strokeWidth="1.5"
                      className="group-hover:stroke-rose-500 group-hover:fill-rose-950/80 transition-colors shadow-lg"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#e2e8f0"
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
              
              // If hovering over a target port, snap line to it!
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
                  {/* Thick Glow Behind Connecting Line */}
                  <path
                    d={connectPathD}
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="8"
                    strokeOpacity="0.3"
                    filter="url(#glowEffect)"
                  />

                  {/* Animated High-tech Glowing Connecting Line */}
                  <path
                    d={connectPathD}
                    fill="none"
                    stroke="url(#connectingGrad)"
                    strokeWidth="3.5"
                    strokeDasharray="8 6"
                    strokeLinecap="round"
                    className="connecting-line-anim"
                  />

                  {/* Origin Pulse Ring */}
                  <circle cx={x1} cy={y1} r="6" fill="#38bdf8" />
                  <circle cx={x1} cy={y1} r="12" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.6">
                    <animate attributeName="r" values="6;16;6" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" />
                  </circle>

                  {/* Target Endpoint Cursor Pulse */}
                  <circle cx={x2} cy={y2} r="5" fill="#ec4899" filter="url(#glowEffect)" />
                  <circle cx={x2} cy={y2} r="14" fill="none" stroke="#ec4899" strokeWidth="2" opacity="0.7">
                    <animate attributeName="r" values="5;18;5" dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="1s" repeatCount="indefinite" />
                  </circle>

                  {/* Helper Floating Tooltip on Cursor */}
                  <g transform={`translate(${x2 + 14}, ${y2 - 12})`}>
                    <rect x="0" y="0" width="108" height="24" rx="8" fill="#181824" stroke="#8b5cf6" strokeWidth="1.5" />
                    <text x="54" y="15" fill="#f1f5f9" fontSize="10" fontWeight="bold" textAnchor="middle">
                      {hoveredTargetPortId ? 'Solte para Ligar ⚡' : 'Ligue ao card →'}
                    </text>
                  </g>
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
              const { width } = getNodeDimensions(node.type);

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${width}px`
                  }}
                  className={`pointer-events-auto rounded-2xl bg-[#13141c] border transition-all shadow-2xl relative select-none ${
                    isSelected 
                      ? 'ring-2 ring-purple-500 border-purple-500/80 shadow-purple-500/20' 
                      : 'border-[#262838] hover:border-slate-600'
                  } ${isConnectingSource ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-cyan-500/30' : ''} ${
                    isHoveredTarget ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-emerald-500/30' : ''
                  }`}
                >
                  {/* Top Bar Header of each Card */}
                  <div 
                    className={`px-3.5 py-2.5 rounded-t-2xl flex items-center justify-between text-xs font-bold text-white cursor-move ${
                      node.type === 'inicio' ? 'bg-gradient-to-r from-amber-600 to-amber-700' :
                      node.type === 'ia' ? 'bg-gradient-to-r from-purple-600 to-indigo-700' :
                      node.type === 'condicao' ? 'bg-gradient-to-r from-orange-600 to-amber-700' :
                      node.type === 'cakto' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' :
                      node.type === 'timer' ? 'bg-gradient-to-r from-cyan-600 to-blue-700' :
                      node.type === 'audio' ? 'bg-gradient-to-r from-violet-600 to-purple-700' :
                      node.type === 'imagem' ? 'bg-gradient-to-r from-pink-600 to-rose-700' :
                      node.type === 'video' ? 'bg-gradient-to-r from-rose-600 to-red-700' :
                      'bg-gradient-to-r from-blue-600 to-indigo-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {node.type === 'inicio' && <Zap className="w-3.5 h-3.5 fill-current text-white" />}
                      {node.type === 'ia' && <Sparkles className="w-3.5 h-3.5 fill-current text-white" />}
                      {node.type === 'condicao' && <Scissors className="w-3.5 h-3.5" />}
                      {node.type === 'cakto' && <span className="text-xs">🌵</span>}
                      {node.type === 'timer' && <Clock className="w-3.5 h-3.5" />}
                      {node.type === 'audio' && <Mic className="w-3.5 h-3.5" />}
                      {node.type === 'imagem' && <ImageIcon className="w-3.5 h-3.5" />}
                      {node.type === 'video' && <Video className="w-3.5 h-3.5" />}
                      {(node.type === 'sms' || node.type === 'whatsapp') && <MessageSquare className="w-3.5 h-3.5" />}
                      <span className="tracking-wide uppercase text-[11px] font-black">{node.title}</span>
                    </div>

                    {/* Card Actions (Duplicate / Delete) */}
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
                        {/* Trigger Type Toggle */}
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#1c1d29] border border-slate-800">
                          <button
                            onClick={() => updateNodeData(node.id, { trigger: 'palavra_chave' })}
                            className={`py-1 px-2 text-[10px] font-bold rounded-lg transition-all ${
                              node.data.trigger === 'palavra_chave'
                                ? 'bg-amber-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Palavra-chave
                          </button>
                          <button
                            onClick={() => updateNodeData(node.id, { trigger: 'boas_vindas' })}
                            className={`py-1 px-2 text-[10px] font-bold rounded-lg transition-all ${
                              node.data.trigger === 'boas_vindas'
                                ? 'bg-amber-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Boas-vindas
                          </button>
                        </div>

                        {/* Keyword list & input */}
                        {node.data.trigger === 'palavra_chave' && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Palavras que ativam:
                            </span>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {(node.data.keywords || []).map((kw: string) => (
                                <span
                                  key={kw}
                                  className="text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"
                                >
                                  {kw}
                                  <button
                                    onClick={() => removeKeywordFromNode(node.id, kw)}
                                    className="hover:text-rose-400"
                                  >
                                    ×
                                  </button>
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
                                className="w-5 h-5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Instances selector */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Disparar na Instância:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {['Todas', 'Inst. 1', 'Inst. 2', 'Inst. 3', 'Inst. 4'].map((inst) => {
                              const isActive = (node.data.instance || 'Todas') === inst;
                              return (
                                <button
                                  key={inst}
                                  onClick={() => updateNodeData(node.id, { instance: inst })}
                                  className={`text-[9px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                                    isActive 
                                      ? 'bg-purple-600 text-white shadow-sm' 
                                      : 'bg-[#1c1d29] hover:bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {inst}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. ASSISTENTE IA CARD */}
                    {node.type === 'ia' && (
                      <div className="space-y-2.5">
                        {/* Power toggle */}
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

                        {/* Tone Selector */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Tom de Resposta:
                          </label>
                          <select
                            value={node.data.tone || 'Profissional'}
                            onChange={(e) => updateNodeData(node.id, { tone: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="Profissional">💼 Profissional & Direto</option>
                            <option value="Amigável">😊 Amigável & Acolhedor</option>
                            <option value="Vendas">🚀 Persuasivo (Focado em Vendas)</option>
                            <option value="Técnico">🔬 Técnico & Detalhado</option>
                          </select>
                        </div>

                        {/* Model Selector */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Modelo de IA:
                          </label>
                          <select
                            value={node.data.model || 'Gemini 2.5 Flash'}
                            onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-purple-300 font-semibold focus:outline-none focus:border-purple-500"
                          >
                            <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Ultra-rápido)</option>
                            <option value="Gemini 3.8 Flash">Gemini 3.8 Flash (Recomendado)</option>
                            <option value="Gemini Pro">Gemini Pro (Raciocínio complexo)</option>
                            <option value="GPT-4o">OpenAI GPT-4o</option>
                            <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                          </select>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Instrução / Prompt Curto:
                          </label>
                          <input
                            type="text"
                            value={node.data.prompt || ''}
                            onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
                            placeholder="Ex: Tirar dúvidas e enviar link de pagamento"
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* 3. CONDIÇÃO CARD */}
                    {node.type === 'condicao' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Regra / Variável:
                          </label>
                          <input
                            type="text"
                            value={node.data.field || 'Score do Lead'}
                            onChange={(e) => updateNodeData(node.id, { field: e.target.value })}
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Operador:
                            </label>
                            <select
                              value={node.data.operator || '>='}
                              onChange={(e) => updateNodeData(node.id, { operator: e.target.value })}
                              className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                            >
                              <option value=">=">&gt;= (Maior ou igual)</option>
                              <option value="<=">&lt;= (Menor ou igual)</option>
                              <option value="==">== (Igual a)</option>
                              <option value="!=">!= (Diferente de)</option>
                              <option value="contem">Contém texto</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Valor:
                            </label>
                            <input
                              type="text"
                              value={node.data.value || '70'}
                              onChange={(e) => updateNodeData(node.id, { value: e.target.value })}
                              className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Outcomes labels */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                            <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Sim</span>
                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          </div>
                          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] text-rose-400 font-bold">
                            <span className="flex items-center gap-1"><X className="w-3 h-3" /> Não</span>
                            <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. MENSAGEM / WHATSAPP CARD */}
                    {(node.type === 'sms' || node.type === 'whatsapp') && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Texto da Mensagem:
                        </label>
                        <textarea
                          rows={3}
                          value={node.data.message || ''}
                          onChange={(e) => updateNodeData(node.id, { message: e.target.value })}
                          placeholder="Digite o texto enviado..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-sans"
                        />
                        {/* Variables helpers */}
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

                    {/* 5. ÁUDIO CARD */}
                    {node.type === 'audio' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Simular Gravação (Delay):
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={node.data.delaySeconds || 3}
                              onChange={(e) => updateNodeData(node.id, { delaySeconds: Number(e.target.value) })}
                              className="w-20 bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            />
                            <span className="text-xs text-slate-400">segundos gravando...</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            URL do Arquivo de Áudio:
                          </label>
                          <input
                            type="text"
                            value={node.data.audioUrl || ''}
                            onChange={(e) => updateNodeData(node.id, { audioUrl: e.target.value })}
                            placeholder="https://.../audio.mp3"
                            className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 6. IMAGEM CARD */}
                    {node.type === 'imagem' && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          URL da Imagem:
                        </label>
                        <input
                          type="text"
                          value={node.data.imageUrl || ''}
                          onChange={(e) => updateNodeData(node.id, { imageUrl: e.target.value })}
                          placeholder="https://.../imagem.png"
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Legenda da Imagem:
                        </label>
                        <input
                          type="text"
                          value={node.data.caption || ''}
                          onChange={(e) => updateNodeData(node.id, { caption: e.target.value })}
                          placeholder="Confira nossos produtos!"
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}

                    {/* 7. VÍDEO CARD */}
                    {node.type === 'video' && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          URL do Vídeo (.mp4):
                        </label>
                        <input
                          type="text"
                          value={node.data.videoUrl || ''}
                          onChange={(e) => updateNodeData(node.id, { videoUrl: e.target.value })}
                          placeholder="https://.../video.mp4"
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                        <input
                          type="text"
                          value={node.data.caption || ''}
                          onChange={(e) => updateNodeData(node.id, { caption: e.target.value })}
                          placeholder="Legenda do vídeo..."
                          className="w-full bg-[#1c1d29] border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}

                    {/* 8. TIMER CARD */}
                    {node.type === 'timer' && (
                      <div className="space-y-2.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Aguardar antes do próximo passo:
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

                    {/* 9. CAKTO CARD */}
                    {node.type === 'cakto' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                          <span className="text-xl">🌵</span>
                          <div>
                            <span className="text-[11px] font-black text-emerald-400 uppercase block">Webhook Cakto</span>
                            <span className="text-[9px] text-slate-400">Ativa em eventos:</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {['Aprovada', 'PIX Gerado', 'Boleto Gerado', 'Cartão Pago', 'Reembolsado'].map((ev) => {
                            const isEventActive = (node.data.activeEvents || []).includes(ev);
                            return (
                              <button
                                key={ev}
                                onClick={() => toggleCaktoEvent(node.id, ev)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between border transition-all ${
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
                    )}
                  </div>

                  {/* Ports / Handles */}
                  {/* Left Port (Input) - Except for Início and Cakto */}
                  {node.type !== 'inicio' && (
                    <div
                      onMouseEnter={() => canBeTarget && setHoveredTargetPortId(node.id)}
                      onMouseLeave={() => setHoveredTargetPortId(null)}
                      onMouseUp={(e) => handleInputPortMouseUp(node.id, e)}
                      title="Entrada (Solte ou clique aqui para conectar)"
                      className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-6 h-6 rounded-full bg-slate-900 border-2 transition-all flex items-center justify-center cursor-pointer z-20 group ${
                        isHoveredTarget 
                          ? 'scale-150 border-emerald-400 bg-emerald-500 shadow-lg shadow-emerald-500/50' 
                          : canBeTarget 
                          ? 'scale-125 border-cyan-400 bg-cyan-950 animate-pulse' 
                          : 'border-purple-500 hover:scale-125 hover:bg-purple-600'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isHoveredTarget ? 'bg-white' : 'bg-purple-300 group-hover:bg-white'}`}></div>
                    </div>
                  )}

                  {/* Right Port (Output) - Starts Connection */}
                  <div
                    onMouseDown={(e) => handleOutputPortMouseDown(node.id, e)}
                    title="Saída (Clique e arraste para ligar a outro card)"
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-6 h-6 rounded-full bg-slate-900 border-2 transition-all flex items-center justify-center cursor-crosshair z-20 group hover:scale-135 ${
                      isConnectingSource 
                        ? 'border-cyan-400 bg-cyan-500 shadow-lg shadow-cyan-500/50 scale-125' 
                        : 'border-blue-400 hover:border-cyan-400 hover:bg-blue-600'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-white group-hover:scale-110"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Floating Tools Dock */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#12131c]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-2">
          <button 
            onClick={() => addNode('inicio', 'WhatsApp')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Gatilho WhatsApp"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">WhatsApp</span>
          </button>

          <button 
            onClick={() => addNode('sms', 'Mensagem')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Texto"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Texto</span>
          </button>

          <button 
            onClick={() => addNode('audio', 'Áudio Gravado')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Áudio"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Áudio</span>
          </button>

          <button 
            onClick={() => addNode('imagem', 'Imagem')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Imagem"
          >
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Imagem</span>
          </button>

          <button 
            onClick={() => addNode('video', 'Vídeo')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Vídeo"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Vídeo</span>
          </button>

          <button 
            onClick={() => addNode('timer', 'Timer')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Temporizador"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Timer</span>
          </button>

          <button 
            onClick={() => addNode('ia', 'Assistente IA')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar IA"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">IA</span>
          </button>

          <button 
            onClick={() => addNode('condicao', 'Condição')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Condição / Branching"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold">Condição</span>
          </button>

          <button 
            onClick={() => addNode('cakto', 'Webhook Cakto')} 
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title="Adicionar Webhook Cakto"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-sm">
              🌵
            </div>
            <span className="text-[9px] font-bold">Cakto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
