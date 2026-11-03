import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Session } from '../types/transcription';
import { SessionTranscript } from '../components/SessionTranscript';
import { QualityPanel } from '../components/QualityPanel';
import { NarrativeAnalysis } from '../components/NarrativeAnalysis';
import type { NarrativeReference } from '../types/narrative';

type Stage = 'timeline' | 'analysis' | 'quality';

export default function SessionViewer() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Session | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [stage, setStage] = useState<Stage>('timeline');

  useEffect(() => {
    let disposed = false;
    async function load() {
      try { const { data } = await api.get<Session>(`/sessions/${id}`); if (!disposed) { setSession(data); setError(''); } }
      catch { if (!disposed) setError('Não foi possível carregar a sessão.'); }
    }
    void load(); const timer = window.setInterval(load, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [id]);

  useEffect(() => { setPreview(null); setShowPreview(false); setPreviewError(''); setStage('timeline'); }, [id]);

  async function openPreview() {
    setShowPreview(true);
    try {
      const { data } = await api.get(`/quality/sessions/${id}/preview`);
      setPreview({ ...session, titulo: `${session?.titulo || 'Sessão'} — prévia ao vivo`, transcription: { status: 'completed', sourceMode: 'discord_multitrack', items: data.messages.map((message: any) => ({ entryId: message.chunkId, userId: message.userId, speaker: message.speaker, text: message.text || '', rawText: message.rawText, startMs: message.startMs, endMs: message.startMs + message.durationMs, warnings: message.warnings, reviewRequired: message.qualityState === 'review_required' })) } });
      setPreviewError(data.messages.length ? '' : 'Esta sessão não possui prévia ao vivo preservada.');
    } catch { setPreviewError('Não foi possível carregar a prévia ao vivo.'); }
  }

  function focusEvidence(reference: NarrativeReference) {
    const target = document.getElementById(`transcript-${encodeURIComponent(reference.entryId)}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target) { target.classList.add('border-violet-300'); window.setTimeout(() => target.classList.remove('border-violet-300'), 1800); }
  }

  const tabs: [Stage, string][] = [['timeline', 'Cronologia'], ['analysis', 'Análise da sessão'], ['quality', 'Qualidade e desempenho']];
  return <div className="imagine-page space-y-6">
    <header className="it-panel it-glow p-6 sm:p-8"><p className="it-eyebrow">Sessão importada</p><h1 className="it-heading mt-2 text-3xl font-semibold">{session?.titulo || 'Sessão'}</h1><p className="mt-2 text-sm text-white/55">Escolha uma etapa para trabalhar sobre a mesma sessão.</p><nav className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4" aria-label="Etapas da sessão">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setStage(value)} className={`rounded-xl border px-4 py-2 text-sm ${stage === value ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-white/55 hover:text-white'}`}>{label}</button>)}</nav></header>
    {stage === 'timeline' && <section className="it-panel p-5 sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-sm"><button type="button" className={`rounded-lg border px-3 py-2 ${!showPreview ? 'border-cyan-300 text-cyan-100' : 'border-white/10 text-white/55'}`} onClick={() => setShowPreview(false)}>Versão final</button><button type="button" className={`rounded-lg border px-3 py-2 ${showPreview ? 'border-cyan-300 text-cyan-100' : 'border-white/10 text-white/55'}`} onClick={openPreview}>Prévia ao vivo</button></div><span className="text-xs text-white/45">A cronologia preserva as referências do áudio.</span></div>{showPreview && <p className="mb-4 text-xs text-white/50">Mostrando até 500 falas da prévia; a versão final é mantida separadamente.</p>}<SessionTranscript session={showPreview ? preview : session} error={showPreview ? previewError : error} /></section>}
    {stage === 'analysis' && id && <section className="it-panel p-5 sm:p-7"><NarrativeAnalysis sessionId={id} campaignId={session?.campanhaId} onEvidence={focusEvidence} /></section>}
    {stage === 'quality' && id && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/60">Métricas e diagnóstico ficam separados da leitura narrativa.</p><Link to={`/benchmarks/sessions/${id}`} className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm text-emerald-300">Abrir benchmark</Link></div><QualityPanel sessionId={id} /></section>}
  </div>;
}
