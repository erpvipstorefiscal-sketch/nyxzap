import React, { useState } from 'react';
import { 
  Zap, 
  Sparkles, 
  Scissors, 
  MessageSquare, 
  Clock, 
  Power, 
  Check, 
  X, 
  Plus, 
  Play, 
  Smartphone,
  Mic,
  Image,
  Video,
  Send
} from 'lucide-react';
import { FlowNode, FlowEdge } from '../types';

export const FlowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<FlowNode[]>([
    {
      id: 'node-1',
      type: 'inicio',
      title: 'INÍCIO',
      x: 40,
      y: 50,
      data: { trigger: 'palavra_chave', keyword: 'preço, comprar', instance: 'Todas' }
    },
    {
      id: 'node-2',
      type: 'ia',
      title: 'Assistente IA',
      x: 540,
      y: 180,
      data: { tone: 'Profissional', model: 'Gemini Flash', active: true }
    },
    {
      id: 'node-3',
      type: 'condicao',
      title: 'Condição',
      x: 880,
      y: 340,
      data: { field: 'Score do Lead', condition: '>=', value: '70' }
    },
    {
      id: 'node-4',
      type: 'sms',
      title: 'SMS',
      x: 880,
      y: 80,
      data: { message: 'Olá {nome}, seu atendimento foi iniciado no WhatsApp!' }
    },
    {
      id: 'node-5',
      type: 'cakto',
      title: 'Cakto',
      x: 360,
      y: 380,
      data: { events: ['Aprovada', 'PIX Gerado', 'Boleto Gerado', 'Cartão Pago', 'Reembolsado'] }
    }
  ]);

  const [edges, setEdges] = useState<FlowEdge[]>([
    { id: 'e1-2', from: 'node-1', to: 'node-2', label: 'Disparo' },
    { id: 'e5-2', from: 'node-5', to: 'node-2', label: 'Status' },
    { id: 'e2-4', from: 'node-2', to: 'node-4', label: 'Fallback' },
    { id: 'e2-3', from: 'node-2', to: 'node-3', label: 'Qualificação' }
  ]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setDraggingId(id);
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
    setSelectedId(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    setNodes(nodes.map(n => 
      n.id === draggingId 
        ? { ...n, x: Math.max(10, e.clientX - dragOffset.x), y: Math.max(10, e.clientY - dragOffset.y) } 
        : n
    ));
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const addNode = (type: FlowNode['type'], title: string) => {
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type,
      title,
      x: 200 + nodes.length * 30,
      y: 150 + (nodes.length % 3) * 40,
      data: {}
    };
    setNodes([...nodes, newNode]);
    setSelectedId(newNode.id);
  };

  return (
    <div className="space-y-4 animate-fadeIn flex flex-col h-[calc(100vh-140px)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Construtor de Fluxos Drag-and-Drop</span>
          </h2>
          <p className="text-xs text-slate-400">
            Arraste os cards, configure gatilhos do WhatsApp e ligue o fluxo ao Assistente de IA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Fluxo Ativo no WhatsApp
          </span>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        className="flex-1 bg-[#090a0f] border border-slate-800 rounded-2xl relative overflow-hidden select-none cursor-default"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: 'radial-gradient(circle, #1a1e2e 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      >
        {/* SVG Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {edges.map(edge => {
            const src = nodes.find(n => n.id === edge.from);
            const tgt = nodes.find(n => n.id === edge.to);
            if (!src || !tgt) return null;

            const isCakto = src.type === 'cakto';
            const x1 = isCakto ? src.x + 90 : src.x + 240;
            const y1 = isCakto ? src.y + 40 : src.y + 50;
            const x2 = tgt.x;
            const y2 = tgt.y + 50;
            const dx = (x2 - x1) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isCakto ? '#f97316' : 'url(#flowGrad)'}
                  strokeWidth="2.5"
                  strokeDasharray={isCakto ? '5 5' : 'none'}
                />
                {edge.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 8}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="bg-nyx-950 px-1"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        <div className="relative z-10 w-full h-full">
          {nodes.map(node => {
            const isSelected = selectedId === node.id;

            // 1. INÍCIO
            if (node.type === 'inicio') {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px` }}
                  className={`w-64 rounded-2xl bg-[#131316] border border-[#26262b] shadow-2xl transition-all cursor-move relative ${
                    isSelected ? 'ring-2 ring-amber-500' : 'hover:border-amber-500/50'
                  }`}
                >
                  <div className="bg-[#b45309] text-white px-3.5 py-2 rounded-t-2xl flex items-center gap-2 font-bold text-xs">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>INÍCIO</span>
                  </div>
                  <div className="p-3.5 space-y-3">
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#1c1c22]">
                      <button className="py-1 px-2 text-[10px] font-bold rounded-lg bg-[#b45309] text-white">
                        Palavra-chave
                      </button>
                      <button className="py-1 px-2 text-[10px] font-medium rounded-lg text-slate-400">
                        Boas-vindas
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#1c1c22] border border-[#2a2a32] rounded-xl px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-400 flex-1">Adicionar palavra...</span>
                      <div className="w-4 h-4 rounded bg-[#b45309]/30 text-[#f59e0b] flex items-center justify-center text-xs font-bold">+</div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        DISPARAR EM QUAL INSTÂNCIA?
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {['Todas', 'Inst. 1', 'Inst. 2', 'Inst. 3', 'Inst. 4'].map((inst, i) => (
                          <span
                            key={inst}
                            className={`text-[9px] px-2 py-0.5 rounded-md font-semibold ${
                              i === 0 ? 'bg-[#7c3aed] text-white' : 'bg-[#1c1c22] text-slate-400'
                            }`}
                          >
                            {inst}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1.5 w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-[#131316]"></div>
                </div>
              );
            }

            // 2. ASSISTENTE IA
            if (node.type === 'ia') {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px` }}
                  className={`w-64 rounded-2xl bg-[#131316] border border-[#26262b] shadow-2xl transition-all cursor-move relative ${
                    isSelected ? 'ring-2 ring-purple-500' : 'hover:border-purple-500/50'
                  }`}
                >
                  <div className="bg-[#7e22ce] text-white px-3.5 py-2 rounded-t-2xl flex items-center justify-between font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span>Assistente IA</span>
                    </div>
                    <Power className="w-3.5 h-3.5 text-purple-200" />
                  </div>
                  <div className="p-3.5 space-y-2">
                    <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      <span className="text-slate-400">Tom:</span>
                      <span className="font-semibold text-white">💼 Profissional</span>
                    </div>
                    <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      <span className="text-slate-400">Modelo:</span>
                      <span className="font-semibold text-purple-300">Gemini Flash</span>
                    </div>
                    <div className="pt-2 text-center text-[10px] text-slate-400">
                      Conectado ao WhatsApp & RAG
                    </div>
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 rounded-full bg-purple-500 border-2 border-[#131316]"></div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1.5 w-3 h-3 rounded-full bg-purple-500 border-2 border-[#131316]"></div>
                </div>
              );
            }

            // 3. CONDIÇÃO
            if (node.type === 'condicao') {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px` }}
                  className={`w-56 rounded-2xl bg-[#131316] border border-[#26262b] shadow-2xl transition-all cursor-move relative ${
                    isSelected ? 'ring-2 ring-amber-500' : 'hover:border-amber-500/50'
                  }`}
                >
                  <div className="bg-[#b45309] text-white px-3.5 py-2 rounded-t-2xl flex items-center gap-2 font-bold text-xs">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Condição</span>
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div className="bg-[#1c1c22] border border-[#2a2a32] rounded-xl px-2.5 py-1.5 text-[11px] text-slate-300">
                      Score do Lead
                    </div>
                    <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-[11px] text-emerald-400 font-bold">
                      <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Sim</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                    </div>
                    <div className="flex items-center justify-between bg-rose-950/40 border border-rose-500/40 rounded-xl px-2.5 py-1.5 text-[11px] text-rose-400 font-bold">
                      <span className="flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Não</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                    </div>
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-[#131316]"></div>
                </div>
              );
            }

            // 4. SMS
            if (node.type === 'sms') {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px` }}
                  className={`w-64 rounded-2xl bg-[#131316] border border-[#26262b] shadow-2xl transition-all cursor-move relative ${
                    isSelected ? 'ring-2 ring-blue-500' : 'hover:border-blue-500/50'
                  }`}
                >
                  <div className="bg-[#1d4ed8] text-white px-3.5 py-2 rounded-t-2xl flex items-center gap-2 font-bold text-xs">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>SMS</span>
                  </div>
                  <div className="p-3.5 space-y-2">
                    <span className="text-[10px] text-slate-400 font-medium">Mensagem</span>
                    <div className="bg-[#1c1c22] border border-[#2a2a32] rounded-xl p-2.5 h-16 text-[11px] text-slate-400 font-mono">
                      Digite a mensagem...
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">{`{nome} {telefone} {empresa}`}</div>
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-[#131316]"></div>
                </div>
              );
            }

            // 5. CAKTO
            if (node.type === 'cakto') {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px` }}
                  className="flex flex-col items-center gap-2 cursor-move relative"
                >
                  <div className="w-16 h-16 rounded-full bg-[#1b4332] border-2 border-emerald-400 shadow-lg shadow-emerald-500/20 flex flex-col items-center justify-center p-2 text-white">
                    <span className="text-xl">🌵</span>
                    <span className="text-[8px] font-extrabold uppercase text-emerald-200">Cakto</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-[#271f1b] border border-[#78350f] text-[#f59e0b] text-[9px] font-semibold">
                      • Aprovada
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#271f1b] border border-[#78350f] text-[#f59e0b] text-[9px] font-semibold">
                      • PIX Gerado
                    </span>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-3 h-3 rounded-full bg-[#f97316] border-2 border-[#131316]"></div>
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* Bottom Floating Tools Dock */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#121215]/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-3">
          <button onClick={() => addNode('inicio', 'WhatsApp')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">WhatsApp</span>
          </button>

          <button onClick={() => addNode('sms', 'Áudio')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">Áudio</span>
          </button>

          <button onClick={() => addNode('sms', 'Imagem')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <Image className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">Imagem</span>
          </button>

          <button onClick={() => addNode('sms', 'Vídeo')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">Vídeo</span>
          </button>

          <button onClick={() => addNode('condicao', 'Timer')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">Timer</span>
          </button>

          <button onClick={() => addNode('ia', 'IA')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">IA</span>
          </button>

          <button onClick={() => addNode('condicao', 'Condição')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">Condição</span>
          </button>

          <button onClick={() => addNode('cakto', 'Cakto')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-medium">Mais</span>
          </button>
        </div>
      </div>
    </div>
  );
};
