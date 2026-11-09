import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Wallet = { availableCredits: number; reservedCredits: number; consumedCredits: number; availableBrl: number; reservedBrl: number; consumedBrl: number };
type Ledger = { _id: string; type: string; direction: string; amountMinorUnits: number; description: string; operationId?: string; createdAt: string };
type Usage = { operationId: string; kind: string; provider?: string; model?: string; status: string; consumedMinorUnits?: number; estimatedMinorUnits?: number; finalCostUsd?: number; createdAt: string };

const credits = (minor: number) => Math.round((minor || 0) / 100);
const brl = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Credits() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [mode, setMode] = useState('observation');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([api.get('/credits'), api.get('/credits/ledger?limit=20'), api.get('/credits/usage?limit=20')])
      .then(([walletResponse, ledgerResponse, usageResponse]) => {
        if (!active) return;
        setWallet(walletResponse.data.wallet); setMode(walletResponse.data.mode || 'observation');
        setLedger(ledgerResponse.data.items || []); setUsage(usageResponse.data.items || []);
      })
      .catch((cause) => { if (active) setError(cause?.response?.data?.error || 'Não foi possível carregar a carteira.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <section className="space-y-6"><div className="animate-pulse text-[#9da3b8]">Carregando carteira…</div></section>;
  if (error) return <section className="rounded-3xl border border-red-400/20 bg-red-400/10 p-6 text-red-200">{error}</section>;
  return <section className="space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a99aff]">Conta</p><h1 className="mt-2 text-3xl font-semibold text-white">Meus créditos</h1><p className="mt-2 text-sm text-[#9da3b8]">Modo atual: <span className="font-medium text-[#d8d5ff]">{mode === 'active' ? 'ativo' : mode === 'observation' ? 'observação' : 'desativado'}</span></p></div><div className="rounded-2xl border border-[#8f86ff]/30 bg-[#8f86ff]/10 px-4 py-3 text-right"><div className="text-xs uppercase tracking-[.16em] text-[#b5afea]">1 crédito</div><div className="text-lg font-semibold text-white">R$ 0,01</div></div></header>
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-3xl border border-[#8f86ff]/30 bg-gradient-to-br from-[#30296b]/70 to-[#171727] p-6"><div className="text-xs uppercase tracking-[.18em] text-[#bdb8f3]">Saldo disponível</div><div className="mt-3 text-4xl font-semibold text-white">{wallet?.availableCredits.toLocaleString('pt-BR')} <span className="text-base font-normal text-[#bdb8f3]">créditos</span></div><div className="mt-2 text-sm text-[#d0cdf2]">{brl(wallet?.availableBrl || 0)}</div></div>
      <div className="rounded-3xl border border-white/10 bg-[#191927] p-6"><div className="text-xs uppercase tracking-[.18em] text-[#858aa0]">Reservado</div><div className="mt-3 text-3xl font-semibold text-white">{wallet?.reservedCredits.toLocaleString('pt-BR')}</div><div className="mt-2 text-sm text-[#858aa0]">{brl(wallet?.reservedBrl || 0)} em operações</div></div>
      <div className="rounded-3xl border border-white/10 bg-[#191927] p-6"><div className="text-xs uppercase tracking-[.18em] text-[#858aa0]">Total consumido</div><div className="mt-3 text-3xl font-semibold text-white">{wallet?.consumedCredits.toLocaleString('pt-BR')}</div><div className="mt-2 text-sm text-[#858aa0]">{brl(wallet?.consumedBrl || 0)}</div></div>
    </div>
    <div className="grid gap-6 xl:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-[#141420] p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Consumo por operação</h2><span className="text-xs text-[#858aa0]">últimas 20</span></div><div className="space-y-3">{usage.length ? usage.map(item => <div key={item.operationId} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3"><div><div className="text-sm font-medium text-[#e9e8f5]">{item.kind === 'transcription' ? 'Transcrição' : item.kind === 'narrative' ? 'Análise narrativa' : item.kind}</div><div className="text-xs text-[#858aa0]">{item.provider || 'local'} · {item.model || '—'} · {item.status}</div></div><div className="text-right text-sm text-[#d8d5ff]">{credits(item.consumedMinorUnits || item.estimatedMinorUnits || 0).toLocaleString('pt-BR')} cr.</div></div>) : <div className="text-sm text-[#858aa0]">Nenhuma operação registrada.</div>}</div></div>
      <div className="rounded-3xl border border-white/10 bg-[#141420] p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Histórico da carteira</h2><span className="text-xs text-[#858aa0]">últimas 20</span></div><div className="space-y-3">{ledger.length ? ledger.map(item => <div key={item._id} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3"><div><div className="text-sm font-medium text-[#e9e8f5]">{item.description}</div><div className="text-xs text-[#858aa0]">{new Date(item.createdAt).toLocaleString('pt-BR')}</div></div><div className={'text-sm font-semibold ' + (item.direction === 'credit' || item.direction === 'release' ? 'text-emerald-300' : 'text-amber-200')}>{item.direction === 'debit' ? '-' : '+'}{credits(item.amountMinorUnits).toLocaleString('pt-BR')} cr.</div></div>) : <div className="text-sm text-[#858aa0]">Nenhuma movimentação registrada.</div>}</div></div></div>
  </section>;
}
