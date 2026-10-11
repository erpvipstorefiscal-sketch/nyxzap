import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CreditCard, 
  Check, 
  ExternalLink, 
  ShieldAlert, 
  Sparkles, 
  LogOut, 
  Clock, 
  Zap, 
  Lock,
  Headphones,
  CheckCircle2
} from 'lucide-react';
import { UserAuth } from '../types';

interface RenewSubscriptionScreenProps {
  user: UserAuth;
  daysRemaining: number;
  onLogout: () => void;
  onSimulateRenewal?: (newValidUntil: string) => void;
}

export const RenewSubscriptionScreen: React.FC<RenewSubscriptionScreenProps> = ({
  user,
  daysRemaining,
  onLogout,
  onSimulateRenewal
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [simulating, setSimulating] = useState(false);

  const plans = [
    {
      id: 'p1',
      name: 'Start',
      monthlyPrice: '97,00',
      annualPrice: '79,00',
      periodDesc: billingCycle === 'annual' ? 'R$ 948/ano (economia de R$ 216)' : 'cobrado mensalmente',
      features: [
        '1 Conexão de WhatsApp',
        'Atendimento ao Vivo Multiatendentes',
        'Fluxo de Automação Visual (Drag & Drop)',
        'Classificação de Leads & Tags',
        'Suporte por Ticket'
      ],
      checkoutUrl: 'https://pay.cakto.com.br/nyxzap-start',
      badge: 'Iniciante',
      popular: false
    },
    {
      id: 'p2',
      name: 'Pro (Recomendado)',
      monthlyPrice: '197,00',
      annualPrice: '147,00',
      periodDesc: billingCycle === 'annual' ? 'R$ 1.764/ano (economia de R$ 600)' : 'cobrado mensalmente',
      features: [
        '3 Conexões de WhatsApp Simultâneas',
        'Agente de Inteligência Artificial (Gemini Pro)',
        'Fluxo Drag & Drop Ilimitado',
        'Mensagens em Massa & Follow-up Automático',
        'Transcrições de Áudio com IA',
        'Suporte Prioritário VIP via WhatsApp'
      ],
      checkoutUrl: 'https://pay.cakto.com.br/nyxzap-pro',
      badge: 'Mais Escolhido',
      popular: true
    },
    {
      id: 'p3',
      name: 'Enterprise',
      monthlyPrice: '397,00',
      annualPrice: '297,00',
      periodDesc: billingCycle === 'annual' ? 'R$ 3.564/ano (economia de R$ 1.200)' : 'cobrado mensalmente',
      features: [
        '10 Conexões de WhatsApp Simultâneas',
        'Agentes de IA Treinados Personalizados',
        'API Oficial / Webhooks Avançados',
        'Treinamento e Onboarding com Especialista',
        'Gerente de Contas Dedicado'
      ],
      checkoutUrl: 'https://pay.cakto.com.br/nyxzap-enterprise',
      badge: 'Empresarial',
      popular: false
    }
  ];

  const handleSimulatePayment = () => {
    setSimulating(true);
    setTimeout(() => {
      // Add 30 days or 365 days
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + (billingCycle === 'annual' ? 365 : 30));
      const formatted = targetDate.toISOString().split('T')[0];
      if (onSimulateRenewal) {
        onSimulateRenewal(formatted);
      }
      setSimulating(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-rose-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-purple-600/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Header bar */}
      <header className="border-b border-slate-800/80 bg-[#0f111a]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-purple-600/30">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">NyxZap</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                ASSINATURA EXPIRADA
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Central de Renovação & Desbloqueio de Acesso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block">{user.name}</span>
            <span className="text-[11px] text-slate-400 font-mono block">{user.email}</span>
          </div>
          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </header>

      {/* Main Renewal Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 flex flex-col items-center">
        {/* Lockout Notice Banner */}
        <div className="w-full max-w-3xl mb-10 p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-red-900/20 to-purple-950/40 border border-rose-500/30 text-center shadow-2xl backdrop-blur-md space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20 animate-pulse">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Seu período de acesso ao NyxZap encerrou
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Sua assinatura do <strong className="text-white">{user.planName || 'Plano Pro'}</strong> venceu em{' '}
            <span className="font-mono text-rose-300 font-bold">{user.validUntil || 'Ontem'}</span> ({daysRemaining < 0 ? Math.abs(daysRemaining) + ' dia(s) atrás' : 'Hoje'}). 
            Suas automações e mensagens foram temporariamente pausadas. Renove agora para reativar seu painel imediatamente!
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Seus dados, leads e fluxos estão 100% seguros
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Liberação automática imediata via PIX ou Cartão
            </span>
          </div>
        </div>

        {/* Billing cycle selector */}
        <div className="flex items-center gap-2 bg-[#12141f] p-1.5 rounded-2xl border border-slate-800 mb-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              billingCycle === 'annual'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Anual</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-extrabold uppercase">
              Economize até 30%
            </span>
          </button>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-10">
          {plans.map((plan) => {
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 relative ${
                  plan.popular
                    ? 'bg-[#151828] border-2 border-purple-500 shadow-2xl shadow-purple-600/20 -translate-y-1'
                    : 'bg-[#10121d] border border-slate-800 hover:border-slate-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-black rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-black text-white">{plan.name}</h3>
                    {!plan.popular && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-400 font-semibold">R$</span>
                      <span className="text-4xl font-extrabold text-white tracking-tight">{price}</span>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{plan.periodDesc}</p>
                  </div>

                  <div className="border-t border-slate-800/80 my-4" />

                  <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <a
                    href={plan.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-3.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg ${
                      plan.popular
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Renovar Agora via Cakto</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Dev Simulation Button */}
                  {onSimulateRenewal && (
                    <button
                      onClick={handleSimulatePayment}
                      disabled={simulating}
                      className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      title="Ativar e revalidar o acesso imediatamente"
                    >
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>{simulating ? 'Processando renovação...' : 'Já fiz o pagamento (Validar Acesso)'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Support Help Footer */}
        <div className="p-4 rounded-2xl bg-[#12141f] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-3xl w-full text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <Headphones className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>Precisa de ajuda com seu pagamento ou nota fiscal?</span>
          </div>
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20renovar%20minha%20assinatura%20do%20NyxZap"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 hover:underline"
          >
            <span>Falar com o Suporte Humano</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#090a0f] py-4 text-center text-xs text-slate-500">
        NyxZap Automation Platform • Todos os direitos reservados.
      </footer>
    </div>
  );
};
