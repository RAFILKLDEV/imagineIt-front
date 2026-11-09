import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Session } from '../types/transcription';
import { SessionTranscript } from '../components/SessionTranscript';
import { QualityPanel } from '../components/QualityPanel';
import { NarrativeAnalysis } from '../components/NarrativeAnalysis';
import { SpeakerBindingsPanel } from '../components/SpeakerBindingsPanel';
import type { NarrativeReference } from '../types/narrative';

type Stage = 'timeline' | 'analysis' | 'quality' | 'consumption';

function contextRows(context: NonNullable<Session['narrativeContext']>) {
  return [
    ['Acontecimentos anteriores', context.previousEvents],
    ['Situação atual', context.currentSituation],
    ['Objetivos e conflitos', [...context.objectives, ...context.conflicts].join('\n')],
    ['NPCs e relacionamentos', context.npcNotes.map(item => `${item.name}${item.description ? ` — ${item.description}` : ''}`).join('\n')],
    ['Locais e aliases', [...context.locations.map(item => item.name), ...context.aliases.map(item => `${item.mentionedName} → ${item.canonicalName || 'pendente'}`)].join('\n')],
    ['Anotações adicionais', context.additionalNotes],
    ['Segredos do mestre', context.gmSecrets.length ? '[privado do mestre]' : '']
  ].filter(([, value]) => String(value || '').trim());
}

export default function SessionViewer() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Session | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [stage, setStage] = useState<Stage>('timeline');
  const [pendingEvidenceId, setPendingEvidenceId] = useState<string | null>(null);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [consumptionError, setConsumptionError] = useState('');

  useEffect(() => {
    let disposed = false;
    async function load() {
      try { const { data } = await api.get<Session>(`/sessions/${id}`); if (!disposed) { setSession(data); setError(''); } }
      catch { if (!disposed) setError('Não foi possível carregar a sessão.'); }
    }
    void load(); const timer = window.setInterval(load, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get(`/credits/usage?sessionId=${encodeURIComponent(id)}&limit=100`).then(({ data }) => { setConsumption(data.items || []); setConsumptionError(''); }).catch(() => setConsumptionError('O consumo desta sessão ainda não está disponível.'));
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
    setPendingEvidenceId(reference.entryId);
    setShowPreview(false);
    setStage('timeline');
  }
  const clearPendingEvidence = useCallback(() => setPendingEvidenceId(null), []);

  const tabs: [Stage, string][] = [['timeline', 'Cronologia'], ['analysis', 'Análise da sessão'], ['consumption', 'Consumo'], ['quality', 'Qualidade e desempenho']];
  const campaignContext = session?.campaignKnowledge?.knowledge.context;
  const inheritedRows = campaignContext ? contextRows(campaignContext) : [];
  const legacyRows = session?.narrativeContext ? contextRows(session.narrativeContext) : [];
  const campaignCharacters = session?.campaignKnowledge?.characters || [];
  const campaignScenarios = session?.campaignKnowledge?.scenarios || [];
  return <div className="imagine-page space-y-6">
    <header className="it-panel it-glow p-6 sm:p-8"><p className="it-eyebrow">Campanha → Conhecimento → Sessões → Cronologia → Análise</p><h1 className="it-heading mt-2 text-3xl font-semibold">{session?.titulo || 'Sessão'}</h1><p className="mt-2 text-sm text-white/55">O conhecimento da campanha e o contexto original desta sessão permanecem separados da transcrição.</p>{session?.campanhaId && <Link to={`/campaigns/${session.campanhaId}`} className="mt-3 inline-block text-sm text-cyan-200 hover:underline">Abrir conhecimento da campanha →</Link>}<nav className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4" aria-label="Etapas da sessão">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setStage(value)} className={`rounded-xl border px-4 py-2 text-sm ${stage === value ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-white/55 hover:text-white'}`}>{label}</button>)}</nav></header>
    {stage === 'timeline' && <section className="it-panel p-5 sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-sm"><button type="button" className={`rounded-lg border px-3 py-2 ${!showPreview ? 'border-cyan-300 text-cyan-100' : 'border-white/10 text-white/55'}`} onClick={() => setShowPreview(false)}>Versão final</button><button type="button" className={`rounded-lg border px-3 py-2 ${showPreview ? 'border-cyan-300 text-cyan-100' : 'border-white/10 text-white/55'}`} onClick={openPreview}>Prévia ao vivo</button></div><span className="text-xs text-white/45">A cronologia preserva as referências do áudio.</span></div>{showPreview && <p className="mb-4 text-xs text-white/50">Mostrando até 500 falas da prévia; a versão final é mantida separadamente.</p>}<SessionTranscript session={showPreview ? preview : session} error={showPreview ? previewError : error} focusEntryId={pendingEvidenceId} onFocusComplete={clearPendingEvidence} /></section>}
    {stage === 'analysis' && id && <section className="space-y-5">
      <section className="it-panel space-y-4 p-5 sm:p-7" aria-label="Conhecimento herdado da campanha">
        <div><p className="it-eyebrow">Conhecimento herdado</p><h2 className="mt-1 text-xl font-semibold text-white">Contexto para esta análise</h2><p className="mt-1 text-sm text-white/55">A campanha fornece o contexto estruturado; notas antigas desta sessão foram preservadas sem sobrescrita.</p></div>
        {inheritedRows.length ? <div className="grid gap-3 sm:grid-cols-2">{inheritedRows.map(([title, value]) => <article key={String(title)} className="rounded-xl border border-white/10 bg-black/15 p-3"><h3 className="text-xs font-semibold text-cyan-100">{title}</h3><p className="mt-2 whitespace-pre-line text-sm text-white/70">{value}</p></article>)}</div> : <p className="text-sm text-white/45">Ainda não há conhecimento narrativo aprovado para esta sessão.</p>}
        {campaignCharacters.length > 0 && <p className="text-sm text-white/70"><strong className="text-cyan-100">Personagens e jogadores:</strong> {campaignCharacters.filter(item => !['npc', 'antagonista', 'secundario'].includes(item.tipo || '')).map(item => `${item.nome}${item.jogador ? ` (${item.jogador})` : ''}`).join(', ')}</p>}
        {campaignCharacters.some(item => ['npc', 'antagonista', 'secundario'].includes(item.tipo || '')) && <p className="text-sm text-white/70"><strong className="text-cyan-100">NPCs e relações:</strong> {campaignCharacters.filter(item => ['npc', 'antagonista', 'secundario'].includes(item.tipo || '')).map(item => `${item.nome}${item.relacionamentos?.length ? ` — ${item.relacionamentos.map(link => link.descricao || link.tipo).filter(Boolean).join('; ')}` : ''}`).join(', ')}</p>}
        {campaignScenarios.length > 0 && <p className="text-sm text-white/70"><strong className="text-cyan-100">Cenários:</strong> {campaignScenarios.map(item => item.nome).join(', ')}</p>}
        {session?.campaignKnowledge?.knowledge.items.length ? <p className="text-sm text-white/70"><strong className="text-cyan-100">Itens:</strong> {session.campaignKnowledge.knowledge.items.join(', ')}</p> : null}
        {session?.campaignKnowledge?.knowledge.discordBindings.length ? <p className="text-xs text-white/50"><strong className="text-cyan-100">Vínculos Discord:</strong> {session.campaignKnowledge.knowledge.discordBindings.filter(item => item.status === 'confirmed').map(item => `${item.playerName || item.userId} → ${item.characterIds.map(characterId => campaignCharacters.find(character => character._id === characterId)?.nome || characterId).join(', ')}`).join('; ') || 'Nenhum vínculo confirmado.'}</p> : null}
        {legacyRows.length > 0 && <details className="rounded-xl border border-amber-300/15 bg-amber-400/[.03] p-3"><summary className="cursor-pointer text-sm text-amber-100">Contexto legado desta sessão — preservado para revisão</summary><p className="mt-2 text-xs text-white/45">Este contexto não foi movido nem substituído. Ajustes futuros devem ser feitos em Conhecimento da Campanha.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{legacyRows.map(([title, value]) => <article key={String(title)}><h3 className="text-xs text-white/55">{title}</h3><p className="mt-1 whitespace-pre-line text-sm text-white/70">{value}</p></article>)}</div></details>}
      </section>
      <SpeakerBindingsPanel sessionId={id} campaignId={session?.campanhaId} />
      <div className="it-panel p-5 sm:p-7"><NarrativeAnalysis sessionId={id} campaignId={session?.campanhaId} onEvidence={focusEvidence} /></div>
    </section>}
    {stage === 'consumption' && <section className="it-panel space-y-5 p-5 sm:p-7"><div><p className="it-eyebrow">Rastreamento financeiro</p><h2 className="mt-1 text-xl font-semibold text-white">Consumo desta sessão</h2><p className="mt-1 text-sm text-white/55">Cada execução permanece no histórico, inclusive reprocessamentos e revisões.</p></div>{consumptionError && <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">{consumptionError}</p>}{consumption.length ? <div className="grid gap-3 sm:grid-cols-2">{consumption.map(item => <article key={item.operationId} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-white">{item.kind === 'transcription' ? 'Transcrição' : item.kind === 'narrative' ? 'Análise narrativa' : item.kind}</h3><span className="text-xs text-cyan-100">{item.status}</span></div><p className="mt-2 text-xs text-white/50">{item.provider || 'local'} · {item.model || '—'}</p><p className="mt-3 text-sm text-white/70">Estimado: {Math.round((item.estimatedMinorUnits || 0) / 100).toLocaleString('pt-BR')} créditos</p><p className="text-sm text-white/70">Consumido: {Math.round((item.consumedMinorUnits || 0) / 100).toLocaleString('pt-BR')} créditos</p></article>)}</div> : !consumptionError && <p className="text-sm text-white/45">Nenhuma operação financeira registrada para esta sessão.</p>}</section>}
    {stage === 'quality' && id && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/60">Métricas e diagnóstico ficam separados da leitura narrativa.</p><Link to={`/benchmarks/sessions/${id}`} className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm text-emerald-300">Abrir benchmark</Link></div><QualityPanel sessionId={id} /></section>}
  </div>;
}
