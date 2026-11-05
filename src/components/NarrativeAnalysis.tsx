import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import type { CandidateReview, NarrativeCandidate, NarrativeReference, NarrativeResult, NarrativeRun, OfficialNarrativeEntity } from '../types/narrative';
import { requestNarrativeGeneration, runIsActive, NARRATIVE_STATUS_LABELS } from '../services/narrativePresentation';
import { NarrativeResultView } from './NarrativeResultView';

type Props = { sessionId: string; campaignId?: string; onEvidence?: (reference: NarrativeReference) => void };

function runFromPayload(value: unknown): NarrativeRun | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const runId = typeof candidate.runId === 'string' ? candidate.runId : typeof candidate._id === 'string' ? candidate._id : '';
  return runId ? candidate as NarrativeRun : null;
}

function candidatesFromRun(run: NarrativeRun): NarrativeCandidate[] {
  if (Array.isArray(run.candidates)) return run.candidates;
  const reviews = Array.isArray(run.candidateReviews) ? run.candidateReviews : Array.isArray(run.reviewCandidates) ? run.reviewCandidates : [];
  return reviews.map((review: any) => ({ ...(review.value || {}), id: review.candidateId, category: review.category || 'uncertainty', status: review.status || review.action || 'pending' }));
}

function usageLabel(usage: NarrativeResult['usage']) {
  if (!usage || typeof usage !== 'object') return '';
  const value = usage as Record<string, unknown>;
  const tokens = typeof value.totalTokens === 'number' ? `${value.totalTokens.toLocaleString('pt-BR')} tokens` : '';
  const cost = typeof value.costUsd === 'number' ? `US$ ${value.costUsd.toFixed(6)} estimado` : '';
  const cache = typeof value.inputCacheHitTokens === 'number' ? `${value.inputCacheHitTokens.toLocaleString('pt-BR')} tokens em cache` : '';
  const source = value.costSource === 'provider' ? 'custo informado pela API' : value.costSource === 'estimated' ? 'custo calculado localmente' : '';
  return [tokens, cost, cache, source].filter(Boolean).join(' · ');
}

function runCost(run: NarrativeRun) {
  const value = run.result?.usage?.costUsd;
  return typeof value === 'number' ? value : 0;
}

export function NarrativeAnalysis({ sessionId, campaignId, onEvidence }: Props) {
  const [runs, setRuns] = useState<NarrativeRun[]>([]);
  const [selected, setSelected] = useState<NarrativeRun | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [officialEntities, setOfficialEntities] = useState<OfficialNarrativeEntity[]>([]);

  const loadRuns = useCallback(async (selectLatest = false) => {
    try {
      const { data } = await api.get(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs`);
      const list = Array.isArray(data) ? data : Array.isArray(data?.runs) ? data.runs : [];
      const normalized = (list as unknown[]).map((item: unknown) => runFromPayload(item)).filter((run): run is NarrativeRun => !!run);
      setRuns(normalized);
      if (selectLatest && normalized[0]) setSelected(normalized[0]);
      setError('');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível carregar as análises narrativas.')); }
    finally { setLoading(false); }
  }, [sessionId]);

  const loadRun = useCallback(async (runId: string) => {
    try {
      const { data } = await api.get(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs/${encodeURIComponent(runId)}`);
      const run = runFromPayload(data);
      if (run) setSelected(run);
      setError('');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível carregar esta análise.')); }
  }, [sessionId]);

  useEffect(() => { setRuns([]); setSelected(null); setConsent(false); setError(''); setNotice(''); setLoading(true); void loadRuns(true); }, [loadRuns]);
  useEffect(() => {
    let disposed = false;
    async function loadOfficialEntities() {
      if (!campaignId) { setOfficialEntities([]); return; }
      try {
        const [characters, scenarios] = await Promise.all([api.get('/characters', { params: { campanhaId: campaignId } }), api.get('/scenarios', { params: { campanhaId: campaignId } })]);
        if (disposed) return;
        const characterItems = Array.isArray(characters.data) ? characters.data : characters.data?.items || [];
        const scenarioItems = Array.isArray(scenarios.data) ? scenarios.data : scenarios.data?.items || [];
        setOfficialEntities([...characterItems.map((item: any) => ({ _id: String(item._id), nome: item.nome, entityType: 'character' as const })), ...scenarioItems.map((item: any) => ({ _id: String(item._id), nome: item.nome, entityType: 'scenario' as const }))]);
      } catch { if (!disposed) setOfficialEntities([]); }
    }
    void loadOfficialEntities();
    return () => { disposed = true; };
  }, [campaignId]);
  useEffect(() => { if (selected && runIsActive(selected)) { const timer = window.setInterval(() => { void loadRun(selected.runId); }, 3000); return () => window.clearInterval(timer); } return undefined; }, [selected, loadRun]);

  const reviewCandidates = useMemo(() => candidatesFromRun(selected || { runId: '', status: '', candidateReviews: [] }), [selected]);
  const reviewedCount = useMemo(() => reviewCandidates.filter(candidate => ['approved', 'rejected', 'linked', 'edited'].includes(String(candidate.status))).length, [reviewCandidates]);
  const accumulatedCost = useMemo(() => runs.reduce((sum, run) => sum + runCost(run), 0), [runs]);

  async function createRun() {
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.post(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs`, requestNarrativeGeneration(consent, true));
      const run = runFromPayload(data);
      if (run) { setSelected(run); setRuns(previous => [run, ...previous.filter(item => item.runId !== run.runId)]); }
      setNotice('Análise iniciada. O progresso será atualizado automaticamente.');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível iniciar a análise.')); }
    finally { setBusy(false); }
  }
  async function resumeRun() {
    if (!selected) return;
    setBusy(true); setError('');
    try { const { data } = await api.post(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs/${encodeURIComponent(selected.runId)}/resume`, requestNarrativeGeneration(consent)); const run = runFromPayload(data); if (run) setSelected(run); setNotice('Retomada solicitada; o checkpoint será reutilizado.'); }
    catch (err) { setError(getApiErrorMessage(err, 'Não foi possível retomar a análise.')); }
    finally { setBusy(false); }
  }
  async function reviewCandidate(candidateId: string, review: CandidateReview) {
    if (!selected) return;
    setBusy(true); setError('');
    try { const { data } = await api.patch(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs/${encodeURIComponent(selected.runId)}/candidates/${encodeURIComponent(candidateId)}`, review); const run = runFromPayload(data); if (run) setSelected(run); setNotice('Revisão salva.'); }
    catch (err) { setError(getApiErrorMessage(err, 'Não foi possível salvar esta revisão.')); }
    finally { setBusy(false); }
  }
  async function reconcileRun() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs/${encodeURIComponent(selected.runId)}/reconcile`);
      const run = runFromPayload(data); if (run) setSelected(run); setNotice('Sugestões de duplicatas recalculadas.');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível recalcular os aliases.')); }
    finally { setBusy(false); }
  }
  async function approveRun() {
    if (!selected || selected.status === 'approved' || selected.reviewState === 'approved') return;
    if (reviewCandidates.length > 0 && reviewedCount < reviewCandidates.length) { setError('Revise ou rejeite todos os candidatos antes de aprovar a análise.'); return; }
    if (!window.confirm('Aprovar esta análise e adicioná-la à memória narrativa da campanha? Cadastros oficiais não serão alterados automaticamente.')) return;
    setBusy(true); setError('');
    try { const { data } = await api.post(`/sessions/${encodeURIComponent(sessionId)}/narrative/runs/${encodeURIComponent(selected.runId)}/approve`, { confirm: true }); const run = runFromPayload(data); if (run) setSelected(run); setNotice('Análise aprovada e registrada na memória da campanha.'); }
    catch (err) { setError(getApiErrorMessage(err, 'Não foi possível aprovar a análise.')); }
    finally { setBusy(false); }
  }

  return <section className="space-y-6 rounded-[28px] border border-violet-400/20 bg-[#0c1223] p-6 text-white" aria-label="Análise Narrativa">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="it-eyebrow">Inteligência narrativa</p><h2 className="it-heading mt-2 text-2xl font-semibold">Análise Narrativa</h2><p className="mt-2 max-w-2xl text-sm text-white/55">Interpretação por IA com evidências verificáveis. A análise só começa depois da sua confirmação e nunca altera automaticamente personagens, cenários ou campanha.</p></div>{selected && <span className="it-status">{NARRATIVE_STATUS_LABELS[selected.reviewState || selected.status] || NARRATIVE_STATUS_LABELS[selected.status] || selected.reviewState || selected.status}</span>}</div>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{notice}</p>}
    <div className="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4 text-sm text-amber-100"><label className="flex items-start gap-3"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" /><span>Confirmo que trechos da transcrição desta sessão serão enviados ao provedor de IA configurado no backend para interpretação narrativa. A transcrição original permanecerá preservada no ImagineIt e a chave não será exibida.</span></label>{!campaignId && <p className="mt-3 text-xs text-amber-200/80">Esta sessão não possui campanha identificada. Vincule-a explicitamente antes de enviar qualquer trecho ao provedor.</p>}</div>
    <div className="flex flex-wrap gap-3"><button type="button" className="it-primary" disabled={!consent || !campaignId || busy} onClick={() => void createRun()}>{busy ? 'Enviando…' : 'Gerar análise com IA'}</button>{selected && (selected.status === 'paused' || selected.status === 'quota_exhausted' || selected.status === 'failed') && <button type="button" className="it-secondary" disabled={!consent || busy} onClick={() => void resumeRun()}>Retomar do checkpoint</button>}{selected && selected.status === 'completed' && selected.reviewState !== 'approved' && <><button type="button" className="it-secondary" disabled={busy} onClick={() => void reconcileRun()}>Reagrupar nomes</button><button type="button" className="it-secondary text-emerald-200" disabled={busy} onClick={() => void approveRun()}>Aprovar análise revisada</button></>}</div>
    {selected && <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><span>Execução <code className="text-xs text-white/55">{selected.runId}</code></span><span>{selected.currentStage || selected.stage || selected.status}</span></div>{runIsActive(selected) && <><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${Math.max(2, Math.min(100, Number(selected.progress || 0) <= 1 ? Number(selected.progress || 0) * 100 : Number(selected.progress || 0)))}%` }} /></div><p className="text-xs text-white/50">{(Number(selected.progress || 0) <= 1 ? Number(selected.progress || 0) * 100 : Number(selected.progress || 0)).toFixed(0)}% — os blocos são enviados em etapas para preservar contexto e retomar após limites configurados.</p></>}{selected.errorMessage && <p className="text-red-200">{selected.errorMessage}</p>}{selected.result && <p className="text-xs text-white/45">Provedor: {typeof selected.result.provider === 'string' ? selected.result.provider : 'configurado'} · modelo efetivo: {typeof selected.result.model === 'string' ? selected.result.model : 'informado nas chamadas'}</p>}{selected.result?.usage && <p className="text-xs text-white/45">Consumo: {usageLabel(selected.result.usage)}{selected.models?.length ? ` · modelos: ${selected.models.join(', ')}` : ''}</p>}{Array.isArray(selected.result?.calls) && <p className="text-xs text-white/45">Chamadas: {selected.result.calls.length} (map/reduce/consolidação registrados no resultado)</p>}</div>}
    {loading && !runs.length ? <p className="text-sm text-white/50">Carregando execuções…</p> : runs.length > 0 && <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-white/65">Execuções desta sessão</h3><span className="text-xs text-white/45">Custo acumulado: US$ {accumulatedCost.toFixed(6)}</span></div><div className="flex flex-wrap gap-2">{runs.map(run => <button type="button" key={run.runId} onClick={() => { setSelected(run); void loadRun(run.runId); }} className={`rounded-xl border px-3 py-2 text-xs ${selected?.runId === run.runId ? 'border-violet-300 text-violet-100' : 'border-white/10 text-white/55'}`}>{new Date(run.createdAt || Date.now()).toLocaleString('pt-BR')} · {NARRATIVE_STATUS_LABELS[run.status] || run.status}{run.result?.usage?.costUsd != null ? ` · US$ ${run.result.usage.costUsd.toFixed(6)}` : ''}</button>)}</div></div>}
    {selected?.result && <NarrativeResultView run={selected} sessionId={sessionId} busy={busy} officialEntities={officialEntities} onReview={reviewCandidate} onEvidence={onEvidence} />}
    {!selected?.result && selected && !runIsActive(selected) && <p className="text-sm text-white/50">Esta execução não possui um resultado revisável.</p>}
    {!runs.length && !loading && <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">Nenhuma análise foi gerada. A sessão e a transcrição permanecem intactas até você iniciar uma execução.</p>}
  </section>;
}
