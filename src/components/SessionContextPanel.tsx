import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import type { ContextSuggestion, SessionContextAlias, SessionContextLocation, SessionContextNpc, SessionNarrativeContext } from '../types/transcription';

type Props = { sessionId: string };
export type ContextDraft = SessionNarrativeContext & { aliasesText: string; npcNotesText: string; locationsText: string };
type Draft = ContextDraft;

const emptyContext = (): SessionNarrativeContext => ({ previousEvents: '', currentSituation: '', conflicts: [], aliases: [], npcNotes: [], locations: [], objectives: [], gmSecrets: [], additionalNotes: '' });
const emptyDraft = (): Draft => ({ ...emptyContext(), aliasesText: '', npcNotesText: '', locationsText: '' });
const listText = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);

function appendLine(current: string, value: string) {
  const next = value.trim();
  if (!next || current.split(/\r?\n/).some(line => line.trim() === next)) return current;
  return current.trim() ? `${current.trim()}\n${next}` : next;
}

function suggestionValue(suggestion: ContextSuggestion) {
  return suggestion.editedValue?.trim() || suggestion.value.trim();
}

export function applySuggestion(draft: Draft, suggestion: ContextSuggestion): Draft {
  const value = suggestionValue(suggestion);
  if (!value) return draft;
  const next = { ...draft };
  if (suggestion.field === 'conflicts' || suggestion.field === 'objectives' || suggestion.field === 'gmSecrets') {
    const values = [...(next[suggestion.field] as string[])];
    if (!values.includes(value)) next[suggestion.field] = [...values, value] as never;
  } else if (suggestion.field === 'aliases') {
    const aliasValue = suggestion.entityName && !value.includes('->') && !value.includes('→') ? `${value} -> ${suggestion.entityName}` : value;
    next.aliasesText = appendLine(next.aliasesText, aliasValue);
  } else if (suggestion.field === 'playerCharacterBinding') {
    next.additionalNotes = appendLine(next.additionalNotes, `Vínculo sugerido (confirme em Identidade da sessão): ${value}`);
  } else if (suggestion.field === 'items') {
    next.additionalNotes = appendLine(next.additionalNotes, `Item: ${value}`);
  } else if (suggestion.field === 'npcNotes') {
    next.npcNotesText = appendLine(next.npcNotesText, value);
  } else if (suggestion.field === 'locations') {
    next.locationsText = appendLine(next.locationsText, value);
  } else if (suggestion.field === 'previousEvents' || suggestion.field === 'currentSituation' || suggestion.field === 'additionalNotes') {
    const current = next[suggestion.field] as string;
    if (!current.includes(value)) next[suggestion.field] = appendLine(current, value) as never;
  }
  return next;
}

const fieldLabels: Record<ContextSuggestion['field'], string> = {
  previousEvents: 'Acontecimentos anteriores', currentSituation: 'Situação atual', conflicts: 'Conflito', aliases: 'Apelido', npcNotes: 'NPC', locations: 'Local', items: 'Item', objectives: 'Objetivo', gmSecrets: 'Segredo do mestre', additionalNotes: 'Contexto adicional', playerCharacterBinding: 'Vínculo sugerido'
};

function toDraft(value: Partial<SessionNarrativeContext> | undefined): Draft {
  const context = { ...emptyContext(), ...(value || {}) };
  return {
    ...context,
    conflicts: context.conflicts || [],
    objectives: context.objectives || [],
    gmSecrets: context.gmSecrets || [],
    aliases: context.aliases || [],
    npcNotes: context.npcNotes || [],
    locations: context.locations || [],
    aliasesText: (context.aliases || []).map(item => `${item.mentionedName} → ${item.canonicalName || item.entityId || ''}`.trim()).join('\n'),
    npcNotesText: (context.npcNotes || []).map(item => `${item.name}${item.description ? ` — ${item.description}` : ''}`).join('\n'),
    locationsText: (context.locations || []).map(item => `${item.name}${item.note ? ` — ${item.note}` : ''}`).join('\n')
  };
}

export function parseAliases(value: string): SessionContextAlias[] {
  return listText(value).map(line => {
    const [mentionedName, canonicalName] = line.split(/\s*(?:→|->)\s*/, 2);
    return { mentionedName: mentionedName.trim(), canonicalName: canonicalName?.trim() || null, entityType: 'other' as const };
  }).filter(item => item.mentionedName);
}

export function parseNpcs(value: string): SessionContextNpc[] {
  return listText(value).map(line => { const [name, description] = line.split(/\s*(?:—|-)\s*/, 2); return { name: name.trim(), description: description?.trim() || null, temporary: true }; }).filter(item => item.name);
}

export function parseLocations(value: string): SessionContextLocation[] {
  return listText(value).map(line => { const [name, note] = line.split(/\s*(?:—|-)\s*/, 2); return { name: name.trim(), note: note?.trim() || null, aliases: [] }; }).filter(item => item.name);
}

function contextPayload(draft: Draft): SessionNarrativeContext {
  return {
    previousEvents: draft.previousEvents,
    currentSituation: draft.currentSituation,
    conflicts: draft.conflicts,
    aliases: parseAliases(draft.aliasesText),
    npcNotes: parseNpcs(draft.npcNotesText),
    locations: parseLocations(draft.locationsText),
    objectives: draft.objectives,
    gmSecrets: draft.gmSecrets,
    additionalNotes: draft.additionalNotes
  };
}

const questions: Array<{ key: keyof Draft; title: string; prompt: string; hint: string; private?: boolean; list?: boolean }> = [
  { key: 'previousEvents', title: 'O que aconteceu antes desta sessão?', prompt: 'Existe algo importante da história que a IA deveria saber antes de ler a transcrição?', hint: 'Resumo de acontecimentos anteriores, situação da campanha ou conflitos em andamento.' },
  { key: 'currentSituation', title: 'Qual é a situação atual?', prompt: 'Em que ponto a campanha começa nesta sessão?', hint: 'Uma resposta curta já ajuda; você pode editar depois.' },
  { key: 'conflicts', title: 'Quais são os objetivos ou conflitos?', prompt: 'O grupo está tentando realizar uma missão ou resolver algum conflito?', hint: 'Escreva um item por linha.', list: true },
  { key: 'aliasesText', title: 'Existem apelidos ou nomes alternativos?', prompt: 'Algum personagem, lugar ou NPC costuma ser chamado por outro nome?', hint: 'Use uma linha por associação, por exemplo: Ed → Edward Elric.' },
  { key: 'npcNotesText', title: 'Quais NPCs são importantes?', prompt: 'Quais personagens controlados pelo mestre podem aparecer nesta sessão?', hint: 'Use uma linha por NPC: Nome — descrição.' },
  { key: 'locationsText', title: 'Onde a sessão acontece?', prompt: 'Existem locais importantes que devemos reconhecer?', hint: 'Use uma linha por local: Nome — contexto.' },
  { key: 'objectives', title: 'Há alguma prioridade para a leitura?', prompt: 'Existe alguma consequência, decisão ou detalhe que merece atenção especial?', hint: 'Escreva um item por linha.', list: true },
  { key: 'gmSecrets', title: 'Existe algum segredo do mestre?', prompt: 'Há informações que ajudam a interpretar os acontecimentos, mas os jogadores ainda não descobriram?', hint: 'Estas notas são privadas e não serão tratadas como fatos ocorridos.', private: true, list: true },
  { key: 'additionalNotes', title: 'Algo mais que a IA precisa saber?', prompt: 'Adicione correções, nomes difíceis de transcrever ou convenções de interpretação.', hint: 'Tudo é opcional.' }
];

export function SessionContextPanel({ sessionId }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [suggestions, setSuggestions] = useState<ContextSuggestion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get(`/sessions/${encodeURIComponent(sessionId)}/narrative-context`); setDraft(toDraft(data?.context)); setSaved(Boolean(data?.context?.updatedAt)); setError(''); }
    catch { setError('Não foi possível carregar o contexto desta sessão.'); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);

  async function analyzeWithAI() {
    if (!aiText.trim()) { setAiError('Cole algum texto antes de solicitar o preenchimento inteligente.'); return; }
    setAiBusy(true); setAiError('');
    try {
      const { data } = await api.post(`/sessions/${encodeURIComponent(sessionId)}/narrative-context/suggestions`, { text: aiText });
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions.map((suggestion: ContextSuggestion) => ({ ...suggestion, status: 'pending' as const })) : []);
    } catch (err) { setAiError(getApiErrorMessage(err, 'Não foi possível organizar este texto com a IA. O preenchimento manual continua disponível.')); }
    finally { setAiBusy(false); }
  }

  function acceptSuggestion(id: string) {
    const suggestion = suggestions.find(item => item.id === id);
    if (!suggestion || suggestion.status === 'rejected') return;
    setDraft(previous => applySuggestion(previous, suggestion));
    setSuggestions(previous => previous.map(item => item.id === id ? { ...item, status: 'accepted' as const } : item));
    setSaved(false);
  }

  function acceptAllSuggestions() {
    const pending = suggestions.filter(item => item.status === 'pending');
    setDraft(previous => pending.reduce(applySuggestion, previous));
    setSuggestions(previous => previous.map(item => item.status === 'pending' ? { ...item, status: 'accepted' as const } : item));
    setSaved(false);
  }

  function rejectSuggestion(id: string) {
    setSuggestions(previous => previous.map(item => item.id === id ? { ...item, status: 'rejected' as const } : item));
  }

  function editSuggestion(id: string) {
    const suggestion = suggestions.find(item => item.id === id);
    if (!suggestion) return;
    const value = window.prompt('Edite a sugestão antes de aceitá-la.', suggestionValue(suggestion));
    if (value === null || !value.trim()) return;
    setSuggestions(previous => previous.map(item => item.id === id ? { ...item, editedValue: value.trim(), status: 'pending' as const } : item));
  }

  const current = step >= 0 ? questions[step] : null;
  const summary = useMemo(() => {
    const context = contextPayload(draft);
    return [context.previousEvents, context.currentSituation, ...context.conflicts, ...context.objectives, ...context.aliases.map(item => item.mentionedName), ...context.npcNotes.map(item => item.name), ...context.locations.map(item => item.name), ...context.gmSecrets, context.additionalNotes].filter(Boolean).length;
  }, [draft]);

  function updateField(key: keyof Draft, value: string) {
    setDraft(previous => ({ ...previous, [key]: ['conflicts', 'objectives', 'gmSecrets'].includes(key) ? listText(value) : value } as Draft));
    setSaved(false);
  }

  async function persist(value = draft) {
    setBusy(true); setError('');
    try { const { data } = await api.put(`/sessions/${encodeURIComponent(sessionId)}/narrative-context`, { context: contextPayload(value) }); setDraft(toDraft(data?.context)); setSaved(true); }
    catch { setError('Não foi possível salvar o contexto.'); }
    finally { setBusy(false); }
  }

  async function continueWithoutContext() {
    if (saved && summary) {
      setStep(questions.length);
      return;
    }
    const value = toDraft(emptyContext());
    setDraft(value);
    setStep(-1);
    await persist(value);
  }

  async function next() {
    await persist();
    setStep(value => Math.min(questions.length, value + 1));
  }

  if (loading) return <section className="it-panel p-6"><p className="text-sm text-white/55">Carregando contexto da sessão…</p></section>;
  return <section className="it-panel space-y-5 p-6 sm:p-7" aria-label="Contexto da Sessão">
    <div><p className="it-eyebrow">Preparação opcional</p><h2 className="it-heading mt-2 text-2xl font-semibold">Ajude a IA a entender sua história</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Algumas informações sobre a campanha ajudam a reconhecer personagens, compreender acontecimentos e produzir um relato mais fiel. Tudo aqui é opcional: você pode continuar sem responder e voltar depois.</p></div>
    <section className="rounded-2xl border border-violet-300/25 bg-violet-400/[.06] p-4" aria-label="Preenchimento inteligente">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-violet-100">✨ Preencher com IA</h3><p className="mt-1 max-w-2xl text-sm text-white/60">Cole suas anotações, a história da campanha ou qualquer informação relevante. A IA tentará organizar o conteúdo e preencher as perguntas para você.</p></div><button type="button" className="it-secondary !px-3 !py-2 !text-xs" onClick={() => { setAiText(''); setSuggestions([]); setAiError(''); }}>Limpar texto</button></div>
      <textarea aria-label="Texto livre para preencher com IA" value={aiText} onChange={event => setAiText(event.target.value)} rows={6} className="mt-3 min-h-[130px] w-full rounded-xl border border-white/15 bg-[#0a0e18] p-3 text-sm text-white outline-none focus:border-violet-300" placeholder="Cole aqui anotações do mestre, resumos, histórias, NPCs, lugares ou missões…" />
      <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" className="it-primary" disabled={aiBusy || !aiText.trim()} onClick={() => void analyzeWithAI()}>{aiBusy ? 'Analisando…' : 'Analisar com IA'}</button><span className="text-xs text-white/45">A análise só acontece quando você solicitar.</span></div>
      {aiError && <p role="alert" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{aiError}</p>}
      {suggestions.length > 0 && <div className="mt-4 space-y-3 border-t border-white/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-white">Sugestões para revisar</h4><p className="mt-1 text-xs text-white/50">Nada será aplicado ou vinculado oficialmente sem sua confirmação.</p></div><div className="flex gap-2"><button type="button" className="it-secondary !px-3 !py-2 !text-xs" onClick={acceptAllSuggestions}>Aceitar pendentes</button><button type="button" className="it-secondary !px-3 !py-2 !text-xs" onClick={() => setSuggestions([])}>Descartar sugestões</button></div></div><div className="space-y-2">{suggestions.map(suggestion => <article key={suggestion.id} className={`rounded-xl border p-3 ${suggestion.status === 'accepted' ? 'border-emerald-300/30 bg-emerald-400/[.05]' : suggestion.status === 'rejected' ? 'border-white/10 bg-black/10 opacity-60' : 'border-white/10 bg-black/20'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.12em] text-violet-200/70">{fieldLabels[suggestion.field]} · {Math.round(suggestion.confidence * 100)}%</p><p className="mt-1 text-sm text-white">{suggestionValue(suggestion)}</p>{suggestion.entityName && <p className="mt-1 text-xs text-cyan-200">Entidade sugerida: {suggestion.entityName}{suggestion.entityId ? ` (${suggestion.entityId})` : ''}</p>}<p className="mt-1 text-xs text-white/45">Origem: “{suggestion.sourceText}”</p>{suggestion.conflict && <p className="mt-1 text-xs text-amber-200">Ambiguidade: {suggestion.conflict}</p>}{suggestion.candidates?.length > 0 && <p className="mt-1 text-xs text-amber-200">Candidatos: {suggestion.candidates.map(candidate => candidate.name).join(', ')}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" className="it-secondary !px-2 !py-1 !text-xs" disabled={suggestion.status === 'accepted'} onClick={() => editSuggestion(suggestion.id)}>Editar</button>{suggestion.status !== 'accepted' && <button type="button" className="it-secondary !px-2 !py-1 !text-xs text-emerald-200" onClick={() => acceptSuggestion(suggestion.id)}>Aceitar</button>}{suggestion.status !== 'rejected' && <button type="button" className="it-secondary !px-2 !py-1 !text-xs text-red-200" onClick={() => rejectSuggestion(suggestion.id)}>Rejeitar</button>}</div></div></article>)}</div></div>}
    </section>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    {step === -1 && <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><p className="text-sm text-white/75">{saved && summary ? `Há ${summary} informação(ões) de contexto salvas para esta sessão.` : 'O processamento narrativo funciona normalmente mesmo sem contexto adicional.'}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" className="it-primary" onClick={() => setStep(0)}>Começar a contextualizar</button><button type="button" className="it-secondary" disabled={busy} onClick={() => void continueWithoutContext()}>Continuar sem contexto</button></div></div>}
    {step >= 0 && step < questions.length && current && <div className="space-y-5 rounded-2xl border border-violet-300/20 bg-violet-400/[.04] p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs uppercase tracking-[.18em] text-violet-200/70">Pergunta {step + 1} de {questions.length}</span><button type="button" className="text-xs text-white/50 underline" onClick={() => setStep(questions.length)}>Ver resumo</button></div><div><h3 className="text-xl font-semibold">{current.title}</h3><p className="mt-2 text-sm text-white/70">{current.prompt}</p><p className="mt-2 text-xs text-white/45">{current.hint}</p>{current.private && <p className="mt-2 text-xs text-amber-200">Privado do mestre: a IA usa este contexto para interpretar, mas não deve apresentá-lo como fato revelado.</p>}</div><textarea aria-label={current.title} rows={current.list ? 5 : 7} value={Array.isArray(draft[current.key]) ? (draft[current.key] as string[]).join('\n') : String(draft[current.key] || '')} onChange={event => updateField(current.key, event.target.value)} className="min-h-[140px] w-full rounded-xl border border-white/15 bg-[#0a0e18] p-3 text-sm text-white outline-none focus:border-violet-300" placeholder="Você pode pular esta pergunta…" /><div className="flex flex-wrap justify-between gap-3"><button type="button" className="it-secondary" onClick={() => setStep(value => Math.max(0, value - 1))}>Voltar</button><div className="flex gap-2"><button type="button" className="it-secondary" disabled={busy} onClick={() => void next()}>{busy ? 'Salvando…' : 'Pular'}</button><button type="button" className="it-primary" disabled={busy} onClick={() => void next()}>{step === questions.length - 1 ? 'Concluir' : 'Salvar e continuar'}</button></div></div></div>}
    {step === questions.length && <div className="space-y-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[.04] p-5"><h3 className="text-xl font-semibold">Contexto pronto para esta sessão</h3><p className="text-sm text-white/65">{summary ? `${summary} informação(ões) serão usadas como orientação, separadas das evidências da transcrição.` : 'Nenhuma resposta foi preenchida. Isso também é válido.'}</p><div className="flex flex-wrap gap-3"><button type="button" className="it-secondary" onClick={() => setStep(Math.max(0, questions.length - 1))}>Editar respostas</button><button type="button" className="it-primary" disabled={busy} onClick={() => void persist()}>{busy ? 'Salvando…' : 'Salvar contexto'}</button></div></div>}
  </section>;
}
