import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Brain, 
  Globe, 
  FileText, 
  Eye, 
  Send, 
  AlertCircle, 
  Plus, 
  Save, 
  CheckCircle2, 
  Layers, 
  Cpu,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { AIAgentConfig } from '../types';

export const AIAgentManager: React.FC = () => {
  const [config, setConfig] = useState<AIAgentConfig>({
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
  });

  const [activeTab, setActiveTab] = useState<'config' | 'knowledge' | 'playground'>('config');
  const [newKeyword, setNewKeyword] = useState('');
  const [saveToast, setSaveToast] = useState(false);

  // Playground state
  const [testPrompt, setTestPrompt] = useState('Qual é a garantia do plano e como funciona o suporte?');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ reasoning?: string; response?: string; citations?: string[] } | null>(null);

  useEffect(() => {
    fetch('/api/ai-config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    await fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const kw = newKeyword.trim().toLowerCase();
    if (!config.escapeKeywords.includes(kw)) {
      setConfig({ ...config, escapeKeywords: [...config.escapeKeywords, kw] });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (index: number) => {
    const updated = config.escapeKeywords.filter((_, i) => i !== index);
    setConfig({ ...config, escapeKeywords: updated });
  };

  const handleTestPlayground = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testPrompt })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-indigo-400" />
            <span>Agente de IA Multimodal</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure inteligência avançada com raciocínio profundo, RAG, pesquisa web e transbordo humano.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary px-4 py-2 text-white rounded-xl text-xs font-semibold flex items-center gap-2 self-start"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saveToast ? 'Configurações Salvas!' : 'Salvar Alterações'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] text-xs font-medium pb-px">
        <button
          onClick={() => setActiveTab('config')}
          className={`py-2.5 px-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'config'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span>Modelos & Comportamento</span>
        </button>

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`py-2.5 px-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'knowledge'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <FileText className="w-4 h-4 text-zinc-400" />
          <span>Base de Conhecimento ({config.knowledgeDocs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('playground')}
          className={`py-2.5 px-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'playground'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Playground de Teste em Tempo Real</span>
        </button>
      </div>

      {/* TAB 1: CONFIG */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Provider Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setConfig({ ...config, provider: 'gemini', model: 'gemini-3.8-flash' })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                config.provider === 'gemini'
                  ? 'bg-surface-card border-indigo-500/80 shadow-subtle'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Google Gemini
                </span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-medium">
                  Recomendado
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Suporte nativo a raciocínio interno, pesquisa Google Grounding e alta resolução visual.
              </p>
            </div>

            <div
              onClick={() => setConfig({ ...config, provider: 'openai', model: 'gpt-4o' })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                config.provider === 'openai'
                  ? 'bg-surface-card border-indigo-500/80 shadow-subtle'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2 text-xs">
                  <Brain className="w-4 h-4 text-emerald-400" /> OpenAI GPT
                </span>
                <span className="text-[10px] bg-white/[0.05] text-zinc-300 border border-white/10 px-2 py-0.5 rounded font-mono">
                  GPT-4o
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Atendimento rápido para WhatsApp com grande repertório de respostas.
              </p>
            </div>

            <div
              onClick={() => setConfig({ ...config, provider: 'claude', model: 'claude-3-7-sonnet' })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                config.provider === 'claude'
                  ? 'bg-surface-card border-indigo-500/80 shadow-subtle'
                  : 'bg-surface-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2 text-xs">
                  <Layers className="w-4 h-4 text-cyan-400" /> Anthropic Claude
                </span>
                <span className="text-[10px] bg-white/[0.05] text-zinc-300 border border-white/10 px-2 py-0.5 rounded font-mono">
                  Claude 3.7
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Alta capacidade de negociação e nuance para fechar vendas complexas.
              </p>
            </div>
          </div>

          {/* API Key Input */}
          <div className="p-5 rounded-2xl bg-surface-card border border-white/[0.08] space-y-2">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Chave da API ({config.provider.toUpperCase()})
            </label>
            <input
              type="password"
              placeholder={`Cole sua API Key do ${config.provider.toUpperCase()} aqui...`}
              value={config.apiKey || ''}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full bg-[#141622] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-600"
            />
            <span className="text-[11px] text-slate-500 block">
              Sua chave fica protegida localmente no seu servidor VPS.
            </span>
          </div>

          {/* Controls */}
          <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.08] space-y-5">
            <h3 className="text-xs font-semibold text-white flex items-center gap-2 border-b border-white/[0.06] pb-3 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Controles Especiais da IA</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nível de Raciocínio */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Nível de Raciocínio da IA</span>
                  <span className="text-indigo-400 font-mono text-[10px]">{config.reasoningLevel.toUpperCase()}</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Controla a profundidade do raciocínio interno do modelo antes de formular a resposta.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(['low', 'medium', 'high'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfig({ ...config, reasoningLevel: lvl })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                        config.reasoningLevel === lvl
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-subtle'
                          : 'bg-[#141622] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      {lvl.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolução de Mídia */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Resolução de Mídia (Imagens & Comprovantes)</span>
                  <span className="text-cyan-400 font-mono text-[10px]">{config.mediaResolution.toUpperCase()}</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Controla a qualidade do processamento visual de imagens e comprovantes recebidos pelo WhatsApp.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(['baixo', 'medio', 'maximo'] as const).map(res => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setConfig({ ...config, mediaResolution: res })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                        config.mediaResolution === res
                          ? 'bg-cyan-600/80 border-cyan-500 text-white shadow-subtle'
                          : 'bg-[#141622] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Search Grounding */}
            <div className="p-4 rounded-xl bg-nyx-850 border border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Pesquisa na Web (Google Search Grounding)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Ativa a habilidade do Gemini de buscar na web. Ele só pesquisa quando detecta necessidade de informações atualizadas (eventos recentes, preços, dados em tempo real).
                </p>
              </div>

              <input
                type="checkbox"
                checked={config.webSearchEnabled}
                onChange={(e) => setConfig({ ...config, webSearchEnabled: e.target.checked })}
                className="w-5 h-5 accent-purple-600 cursor-pointer"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div className="p-6 rounded-2xl bg-nyx-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              System Prompt / Comportamento do Agente
            </h3>
            <p className="text-xs text-slate-400">
              Defina como o agente vai se comportar, tom de voz, regras de negociação e critérios de qualificação.
            </p>
            <textarea
              rows={6}
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              className="w-full bg-nyx-850 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed"
            />
          </div>

          {/* Transbordo Humano */}
          <div className="p-6 rounded-2xl bg-nyx-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Transbordo Humano Automático (Palavras-chave de escape)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Se o cliente digitar qualquer uma destas palavras, o agente pausa automaticamente e notifica um atendente humano no CRM.
                </p>
              </div>
            </div>

            {/* Keyword Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Adicionar palavra (ex: cancelar, processo, atendente)..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                className="flex-1 bg-nyx-850 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleAddKeyword}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            {/* Keywords Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {config.escapeKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-nyx-850 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-2 group hover:border-amber-500/40"
                >
                  <span>{kw}</span>
                  <button
                    onClick={() => handleRemoveKeyword(i)}
                    className="text-slate-500 hover:text-rose-400 text-xs font-bold transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <div className="p-6 rounded-2xl bg-nyx-900 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Base de Conhecimento (PDF, DOCX, TXT)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Suba manuais de produtos, FAQs, tabelas de preços e playbooks para o Agente de IA consultar instantaneamente.
            </p>
          </div>

          <div className="p-8 border-2 border-dashed border-slate-700 rounded-2xl text-center space-y-3 bg-nyx-850/50">
            <FileText className="w-10 h-10 text-cyan-400 mx-auto" />
            <div>
              <p className="text-xs font-bold text-white">Clique para selecionar arquivos ou arraste aqui</p>
              <p className="text-[11px] text-slate-400">Suporta PDF, DOCX, TXT (até 25MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              id="file-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const newDoc = {
                    id: String(Date.now()),
                    name: file.name,
                    size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
                    uploadedAt: new Date().toLocaleDateString('pt-BR'),
                    type: file.name.split('.').pop() || 'pdf'
                  };
                  setConfig({ ...config, knowledgeDocs: [...config.knowledgeDocs, newDoc] });
                }
              }}
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-cyan-600/20"
            >
              Fazer Upload de Documento
            </label>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase">Documentos Ativos na Memória da IA</h4>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
              {config.knowledgeDocs.map(doc => (
                <div key={doc.id} className="p-3.5 bg-nyx-850 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-bold text-white">{doc.name}</div>
                      <div className="text-[10px] text-slate-500">{doc.size} • Adicionado em {doc.uploadedAt}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, knowledgeDocs: config.knowledgeDocs.filter(d => d.id !== doc.id) })}
                    className="text-slate-500 hover:text-rose-400 text-xs transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="p-6 rounded-2xl bg-nyx-900 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Playground de Teste em Tempo Real</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Faça perguntas ao seu agente e inspecione o raciocínio interno do Gemini 3 e as citações da base de conhecimento.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase">Pergunta do Cliente (Simulação)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="flex-1 bg-nyx-850 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
              <button
                onClick={handleTestPlayground}
                disabled={testLoading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{testLoading ? 'Processando Raciocínio...' : 'Testar Agente'}</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div className="space-y-4 pt-2">
              {/* Reasoning Inspector */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 uppercase font-mono">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Inspeção do Raciocínio Interno (Gemini 3 Deep Reasoning)
                </span>
                <p className="text-xs text-purple-100/90 whitespace-pre-line font-mono bg-nyx-950/60 p-3 rounded-lg leading-relaxed">
                  {testResult.reasoning}
                </p>
              </div>

              {/* Citations */}
              {testResult.citations && testResult.citations.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="font-bold text-cyan-400">Fontes consultadas:</span>
                  {testResult.citations.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Final Output */}
              <div className="p-4 rounded-xl bg-nyx-850 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                  <Bot className="w-4 h-4" />
                  Resposta Final Enviada ao WhatsApp
                </span>
                <p className="text-xs text-slate-100 bg-nyx-900 p-4 rounded-lg leading-relaxed">
                  {testResult.response}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
