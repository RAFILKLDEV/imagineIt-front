import { useState } from 'react';
import type { CandidateReview, EntityResolutionSuggestion, NarrativeCandidate, NarrativeFact, NarrativeReference, NarrativeRun, OfficialNarrativeEntity } from '../types/narrative';
import { candidateLabel, evidenceLink, factReferences, factText, narrativeTime, NARRATIVE_STATUS_LABELS } from '../services/narrativePresentation';

export function NarrativeEvidence({ references, sessionId, onEvidence }: { references: NarrativeReference[]; sessionId: string; onEvidence?: (reference: NarrativeReference) => void }) {
  if (!references.length) return <p className="mt-3 text-xs text-amber-200">Sem referência verificada disponível.</p>;
  return <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
    <summary className="cursor-pointer text-cyan-200">Conferir {references.length} {references.length === 1 ? 'fala de origem' : 'falas de origem'}</summary>
    <div className="mt-3 space-y-3">{references.map((ref, index) => <div key={`${ref.sessionId}-${ref.entryId}-${index}`}>
      <a href={evidenceLink(ref, sessionId)} onClick={event => { if (onEvidence && ref.sessionId === sessionId) { event.preventDefault(); onEvidence(ref); } }} className="inline-block text-cyan-200 underline decoration-cyan-200/30 underline-offset-4">{narrativeTime(ref.startMs)} — {ref.entryId}</a>
      <blockquote className="mt-2 border-l border-cyan-200/30 pl-3 whitespace-pre-line leading-5 text-white/70">{ref.sourceText}</blockquote>
    </div>)}</div>
  </details>;
}

function FactBlock({ title, value, sessionId, onEvidence }: { title: string; value: unknown; sessionId: string; onEvidence?: (reference: NarrativeReference) => void }) {
  const values = Array.isArray(value) ? value : [value];
  const facts = values.filter(item => factText(item));
  if (!facts.length) return null;
  return <section className="space-y-3"><h3 className="font-semibold text-white">{title}</h3>{facts.map((fact, index) => <div key={index} className="rounded-xl bg-black/20 p-4"><p className="whitespace-pre-line text-sm leading-7 text-white/85">{factText(fact)}</p>{factReferences(fact).length > 0 && <NarrativeEvidence references={factReferences(fact)} sessionId={sessionId} onEvidence={onEvidence} />}</div>)}</section>;
}

function candidateFacts(candidate: NarrativeCandidate): Array<[string, unknown[]]> {
  const labels: Record<string, string> = { characteristics: 'Características', actions: 'Ações', relevantActions: 'Ações', goals: 'Objetivos', motivations: 'Motivações', changes: 'Mudanças', participants: 'Participantes', connections: 'Conexões', consequences: 'Consequências', causes: 'Causas', decisions: 'Decisões', permanentChanges: 'Alterações permanentes', relationships: 'Relações' };
  return Object.entries(labels).flatMap(([key, label]) => Array.isArray(candidate[key]) && (candidate[key] as unknown[]).length ? [[label, candidate[key] as unknown[]] as [string, unknown[]]] : []);
}

function CandidateCard({ candidate, sectionKind, sessionId, locked, busy, officialEntities, onReview, onEvidence }: {
  candidate: NarrativeCandidate; sectionKind: string; sessionId: string; locked: boolean; busy: boolean; officialEntities: OfficialNarrativeEntity[];
  onReview?: (candidateId: string, review: CandidateReview) => Promise<void>; onEvidence?: (reference: NarrativeReference) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(candidate.name || '');
  const [description, setDescription] = useState(candidate.description || candidate.text || '');
  const [aliases, setAliases] = useState((candidate.aliases || []).join(', '));
  const [linkId, setLinkId] = useState('');
  const recordKind = sectionKind === 'characters' ? 'character' : sectionKind === 'scenarios' ? 'scenario' : '';
  const eligibleEntities = officialEntities.filter(entity => entity.entityType === recordKind);
  const certainty = typeof candidate.certainty === 'string' ? candidate.certainty : typeof candidate.epistemicStatus === 'string' ? candidate.epistemicStatus : '';
  const status = candidate.reviewStatus || candidate.status || 'pending';
  async function review(action: CandidateReview) {
    if (!candidate.id || !onReview) return;
    await onReview(candidate.id, action);
    setEditing(false);
  }
  return <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="font-medium text-white">{candidateLabel(candidate)}</h4>{candidate.aliases?.length ? <p className="mt-1 text-xs text-white/50">Também chamado: {candidate.aliases.join(', ')}</p> : null}</div>
      <span className="it-status">{NARRATIVE_STATUS_LABELS[status] || status}</span>
    </div>
    {candidate.name && candidate.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/75">{candidate.description}</p>}
    {typeof candidate.characterType === 'string' && <p className="mt-2 text-xs text-white/50">Papel na história: {candidate.characterType}</p>}
    {typeof candidate.player === 'string' && <p className="mt-2 text-xs text-white/50">Jogador associado: {candidate.player}</p>}
    {typeof candidate.location === 'string' && <p className="mt-2 text-xs text-white/50">Local: {candidate.location}</p>}
    {typeof candidate.from === 'string' && typeof candidate.to === 'string' && <p className="mt-2 text-sm text-violet-200">{candidate.from} → {candidate.to}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/45">{typeof candidate.confidence === 'number' && <span>Confiança do modelo: {Math.round(candidate.confidence * 100)}%</span>}{certainty && <span>{certainty}</span>}</div>
    {candidateFacts(candidate).map(([label, facts]) => <div key={label} className="mt-3 text-sm"><p className="text-xs font-medium text-white/50">{label}</p><ul className="mt-1 space-y-1 text-white/75">{facts.map((fact, i) => <li key={i}>• {typeof fact === 'string' ? fact : factText(fact)}{factReferences(fact).length > 0 && <NarrativeEvidence references={factReferences(fact)} sessionId={sessionId} onEvidence={onEvidence} />}</li>)}</ul></div>)}
    {Array.isArray(candidate.facts) && candidate.facts.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-medium text-white/50">Afirmações verificáveis</p>{candidate.facts.map((fact: any, index: number) => <div key={index} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-sm text-white/80">{factText(fact)}</p><p className="mt-1 text-xs text-white/40">{fact.status || fact.certainty || 'status não informado'}{typeof fact.confidence === 'number' ? ` · confiança ${Math.round(fact.confidence * 100)}%` : ''}</p><NarrativeEvidence references={factReferences(fact)} sessionId={sessionId} onEvidence={onEvidence} /></div>)}</div>}
    <NarrativeEvidence references={candidate.references || []} sessionId={sessionId} onEvidence={onEvidence} />
    {!locked && onReview && candidate.id && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="it-secondary !px-3 !py-2 !text-xs text-emerald-200" onClick={() => void review({ action: 'approve' })}>Aprovar candidato</button><button type="button" disabled={busy} className="it-secondary !px-3 !py-2 !text-xs text-red-200" onClick={() => void review({ action: 'reject' })}>Rejeitar</button><button type="button" disabled={busy} className="it-secondary !px-3 !py-2 !text-xs" onClick={() => setEditing(value => !value)}>Editar</button></div>
      {editing && <form className="space-y-3 rounded-xl border border-violet-400/20 p-3" onSubmit={event => { event.preventDefault(); void review({ action: 'edit', value: { ...(candidate.name !== undefined ? { name, aliases: aliases.split(',').map(value => value.trim()).filter(Boolean) } : {}), ...(candidate.text !== undefined && candidate.description === undefined ? { text: description } : { description }) } }); }}>
        {candidate.name !== undefined && <><label className="block text-xs text-white/60">Nome<input value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full p-2 text-sm" required /></label><label className="block text-xs text-white/60">Aliases separados por vírgula<input value={aliases} onChange={event => setAliases(event.target.value)} className="mt-1 block w-full p-2 text-sm" /></label></>}
        <label className="block text-xs text-white/60">Descrição ou afirmação<textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} className="mt-1 block w-full p-2 text-sm" /></label><p className="text-xs text-white/45">A correção fica registrada nesta análise e preserva as falas de origem.</p><button type="submit" disabled={busy} className="it-primary !px-3 !py-2 !text-xs">Salvar correção</button>
      </form>}
      {!!recordKind && eligibleEntities.length > 0 && <div className="flex flex-wrap gap-2"><select aria-label={`Vincular ${candidateLabel(candidate)} a um cadastro oficial`} value={linkId} onChange={event => setLinkId(event.target.value)} className="min-w-0 flex-1 p-2 text-xs"><option value="">Vincular a um cadastro existente…</option>{eligibleEntities.map(entity => <option key={entity._id} value={entity._id}>{entity.nome}</option>)}</select><button type="button" disabled={busy || !linkId} className="it-secondary !px-3 !py-2 !text-xs" onClick={() => void review({ action: 'link', entityId: linkId })}>Vincular alias</button></div>}
    </div>}
  </article>;
}

function ResolutionSuggestions({ suggestions, candidates, locked, busy, onReview }: {
  suggestions: EntityResolutionSuggestion[]; candidates: NarrativeCandidate[]; locked: boolean; busy: boolean;
  onReview?: (candidateId: string, review: CandidateReview) => Promise<void>;
}) {
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const visible = suggestions.filter(suggestion => byId.has(suggestion.leftCandidateId) && byId.has(suggestion.rightCandidateId));
  if (!visible.length) return null;
  return <section className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4">
    <div><h3 className="font-semibold text-amber-100">Possiveis duplicatas</h3><p className="mt-1 text-xs text-amber-100/70">Sugestoes conservadoras; nada sera fundido sem sua confirmacao.</p></div>
    {visible.map(suggestion => <div key={suggestion.suggestionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
      <div><span className="font-medium text-white">{suggestion.leftName}</span><span className="mx-2 text-white/40">≈</span><span className="font-medium text-white">{suggestion.rightName}</span><p className="mt-1 text-xs text-white/45">{suggestion.reason} · confianca {Math.round(suggestion.confidence * 100)}%</p></div>
      {!locked && onReview && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="it-secondary !px-3 !py-2 !text-xs text-emerald-200" onClick={() => void onReview(suggestion.leftCandidateId, suggestion.status === 'accepted' ? { action: 'unmerge', value: { targetCandidateId: suggestion.rightCandidateId } } : { action: 'merge', value: { targetCandidateId: suggestion.rightCandidateId } })}>{suggestion.status === 'accepted' ? 'Desfazer' : 'E a mesma pessoa'}</button><button type="button" disabled={busy} className="it-secondary !px-3 !py-2 !text-xs text-amber-100" onClick={() => void onReview(suggestion.leftCandidateId, { action: 'dismiss_resolution', value: { targetCandidateId: suggestion.rightCandidateId } })}>Sao diferentes</button></div>}
    </div>)}
  </section>;
}

export function NarrativeResultView({ run, sessionId, busy = false, officialEntities = [], onReview, onEvidence }: {
  run: NarrativeRun; sessionId: string; busy?: boolean; officialEntities?: OfficialNarrativeEntity[];
  onReview?: (candidateId: string, review: CandidateReview) => Promise<void>; onEvidence?: (reference: NarrativeReference) => void;
}) {
  const result = run.result;
  if (!result) return <p className="text-sm text-white/50">As informações aparecerão aqui conforme a análise for concluída.</p>;
  const narrative = result.narrative || {};
  const locked = run.status === 'approved' || run.reviewState === 'approved';
  const sections = [['characters', 'Personagens'], ['scenarios', 'Cenários'], ['events', 'Linha do tempo'], ['relationships', 'Relacionamentos'], ['uncertainties', 'Informações incertas']] as const;
  const projectedCandidates = sections.flatMap(([kind]) => ((result[kind] || []) as NarrativeCandidate[]));
  const reviewCandidates = Array.isArray(run.reviewCandidates) ? run.reviewCandidates.map((item: any) => ({ ...(item.value || {}), id: item.candidateId, category: item.category, status: item.status })) as NarrativeCandidate[] : [];
  const allCandidates = [...new Map([...projectedCandidates, ...reviewCandidates].map(candidate => [candidate.id, candidate])).values()];
  return <div className="space-y-7">
    <FactBlock title="Resumo curto" value={result.shortSummary || narrative.shortSummary} sessionId={sessionId} onEvidence={onEvidence} />
    <FactBlock title="Resumo detalhado" value={result.detailedSummary || narrative.detailedSummary} sessionId={sessionId} onEvidence={onEvidence} />
    <FactBlock title="Crônica cronológica" value={result.chronicle || result.narrativeChronicle || narrative.chronicle} sessionId={sessionId} onEvidence={onEvidence} />
    {Object.entries({ conflicts: 'Principais conflitos', discoveries: 'Descobertas', combats: 'Combates', openQuestions: 'Questões em aberto', hooks: 'Ganchos para próximas sessões' }).map(([key, title]) => <FactBlock key={key} title={title} value={result[key] || narrative[key]} sessionId={sessionId} onEvidence={onEvidence} />)}
    <ResolutionSuggestions suggestions={run.resolutionSuggestions || (result.entityResolutions as EntityResolutionSuggestion[] | undefined) || []} candidates={allCandidates} locked={locked} busy={busy} onReview={onReview} />
    {sections.map(([kind, label]) => {
      const candidates = (result[kind] || []) as NarrativeCandidate[];
      return <section key={kind} className="space-y-3"><h3 className="font-semibold">{label} <span className="ml-1 text-xs font-normal text-white/40">{candidates.length}</span></h3>{candidates.length ? <div className={kind === 'events' ? 'space-y-3 border-l border-violet-400/20 pl-4' : 'grid items-start gap-3 lg:grid-cols-2'}>{candidates.map((candidate, index) => <CandidateCard key={candidate.id || index} candidate={candidate} sectionKind={kind} sessionId={sessionId} locked={locked} busy={busy} officialEntities={officialEntities} onReview={onReview} onEvidence={onEvidence} />)}</div> : <p className="text-sm text-white/40">Nenhuma informação sustentada encontrada nesta categoria.</p>}</section>;
    })}
  </div>;
}
