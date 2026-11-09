import { useEffect, useMemo, useState } from 'react';
import type { Session, TranscriptItem, TranscriptSegment } from '../types/transcription';

const PAGE_SIZE = 100;

export type ChronologyEntry = {
  entryId: string | null;
  startMs: number | null;
  endMs: number | null;
  discordUserId: string | null;
  speakerName: string | null;
  playerName: string | null;
  characterId: string | null;
  characterName: string | null;
  text: string;
};

type ChronologyRow = { entry: ChronologyEntry; metadata: TranscriptItem | TranscriptSegment };

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return value === undefined || value === null || String(value).trim() === '' ? null : String(value);
}

function sourceItems(session: Session | null): Array<{ item: TranscriptItem | TranscriptSegment; originalIndex: number; fallbackEntryId?: string }> {
  const transcription = session?.transcription;
  const items = transcription?.mergedTimeline?.items?.length
    ? transcription.mergedTimeline.items
    : transcription?.items;
  if (Array.isArray(items) && items.length) return items.map((item, originalIndex) => ({ item, originalIndex }));
  return (transcription?.segments || []).map((item, originalIndex) => ({ item, originalIndex }));
}

function buildChronologyRows(session: Session | null): ChronologyRow[] {
  const campaign = session?.campaignKnowledge;
  const characters = campaign?.characters || [];
  const campaignBindings = campaign?.knowledge.discordBindings || [];
  const sessionBindings = session?.speakerBindings || [];
  return sourceItems(session).map(({ item, originalIndex }) => {
    const transcript = item as TranscriptItem;
    const segment = item as TranscriptSegment;
    const userId = stringOrNull(transcript.userId || segment.userId);
    const userBindings = sessionBindings.filter(binding => binding.userId === userId);
    const explicitBinding = userBindings.filter(binding => binding.status === 'confirmed');
    const campaignBinding = campaignBindings.find(binding => binding.userId === userId && binding.status === 'confirmed');
    const bindingCharacterIds = userBindings.some(binding => binding.status === 'rejected')
      ? []
      : explicitBinding.length
        ? [...new Set(explicitBinding.map(binding => binding.characterId).filter((value): value is string => Boolean(value)))]
        : campaignBinding?.characterIds || [];
    const characterId = stringOrNull(transcript.characterId || segment.characterId)
      || (bindingCharacterIds.length === 1 ? bindingCharacterIds[0] : null);
    const character = characterId ? characters.find(item => item._id === characterId) : undefined;
    const playerName = campaignBinding?.playerName || character?.jogador || null;
    const startMs = numberOrNull(transcript.startMs) ?? (numberOrNull(segment.start) === null ? null : Math.round(segment.start! * 1000));
    const endMs = numberOrNull(transcript.endMs) ?? (numberOrNull(segment.end) === null ? null : Math.round(segment.end! * 1000));
    return {
      metadata: item,
      originalIndex,
      entry: {
        entryId: stringOrNull(transcript.entryId),
        startMs,
        endMs,
        discordUserId: userId,
        speakerName: stringOrNull(transcript.speakerName || segment.speakerName || transcript.speaker || segment.speaker || transcript.discordNick),
        playerName: stringOrNull(playerName),
        characterId,
        characterName: stringOrNull(transcript.characterName || segment.characterName || character?.nome),
        text: typeof transcript.rawText === 'string' ? transcript.rawText : typeof transcript.text === 'string' ? transcript.text : ''
      }
    };
  }).sort((left, right) => (left.entry.startMs ?? Number.POSITIVE_INFINITY) - (right.entry.startMs ?? Number.POSITIVE_INFINITY) || left.originalIndex - right.originalIndex);
}

export function buildChronologyEntries(session: Session | null): ChronologyEntry[] {
  return buildChronologyRows(session).map(row => row.entry);
}

function formatTime(millis: number | null) {
  if (millis == null) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function SessionTranscript({ session, error = '', focusEntryId, onFocusComplete }: { session: Session | null; error?: string; focusEntryId?: string | null; onFocusComplete?: () => void }) {
  const [view, setView] = useState<'readable' | 'json'>('readable');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const rows = useMemo(() => buildChronologyRows(session), [session]);
  const entries = useMemo(() => rows.map(row => row.entry), [rows]);
  const matchingEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return entries.flatMap((entry, index) => {
      if (!normalized || JSON.stringify(entry).toLocaleLowerCase().includes(normalized)) return [{ entry, index, metadata: rows[index].metadata }];
      return [];
    });
  }, [entries, query, rows]);
  const pageCount = Math.max(1, Math.ceil(matchingEntries.length / PAGE_SIZE));
  const pageItems = matchingEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const json = useMemo(() => JSON.stringify(matchingEntries.map(item => item.entry), null, 2), [matchingEntries]);
  const fullJson = useMemo(() => JSON.stringify(entries, null, 2), [entries]);

  useEffect(() => {
    if (!focusEntryId) return;
    const index = entries.findIndex(entry => entry.entryId === focusEntryId);
    if (index < 0) {
      onFocusComplete?.();
      return;
    }
    setQuery('');
    setView('readable');
    setPage(Math.floor(index / PAGE_SIZE));
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`transcript-${encodeURIComponent(focusEntryId)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target) {
        target.classList.add('border-violet-300');
        window.setTimeout(() => target.classList.remove('border-violet-300'), 1800);
      }
      onFocusComplete?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entries, focusEntryId, onFocusComplete]);

  if (!session) return <p>{error || 'Carregando sessão...'}</p>;
  const currentSession = session;
  const isSimulated = currentSession.transcription?.engineVersion?.startsWith('simulated') || currentSession.transcription?.warnings?.includes('simulated_development_response');

  async function copyJson() {
    try { await navigator.clipboard.writeText(fullJson); setNotice(`JSON completo copiado (${entries.length} falas).`); }
    catch { setNotice('Não foi possível copiar automaticamente. Selecione o JSON para copiá-lo.'); }
  }

  function exportJson() {
    const file = new Blob([fullJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(currentSession.titulo || 'cronologia').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice(`JSON completo exportado (${entries.length} falas).`);
  }

  return <section aria-label="Cronologia da sessão" className="space-y-5 text-white">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4"><div><p className="it-eyebrow">Cronologia</p><h2 className="mt-1 text-2xl font-semibold">{currentSession.titulo || 'Sessão sem nome'}</h2><p className="mt-2 text-sm text-white/55">{entries.length} falas · {currentSession.transcription?.status || 'sem transcrição'}</p></div><span className="text-xs text-white/45">Falas simultâneas mantêm a ordem original quando os horários coincidem.</span></header>
    {isSimulated && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">Resultado de simulacao; o texto nao foi extraido do audio.</p>}
    {(error || currentSession.transcription?.errorMessage) && <p role="alert" className="text-sm text-red-300">{error || currentSession.transcription?.errorMessage}</p>}
    {!entries.length && <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">Esta sessão ainda não possui transcrição.</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label className="min-w-[220px] flex-1 text-xs text-white/55">Pesquisar nas falas
        <input aria-label="Pesquisar falas" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a0e18] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" placeholder="Texto, personagem, jogador ou ID Discord" />
      </label>
      <button type="button" className={`rounded-lg border px-3 py-2 text-sm ${view === 'readable' ? 'border-cyan-300 text-cyan-100' : 'border-white/10 text-white/60'}`} onClick={() => setView('readable')}>Falas</button>
      <button type="button" className={`rounded-lg border px-3 py-2 text-sm ${view === 'json' ? 'border-cyan-300 text-cyan-100' : 'border-white/10 text-white/60'}`} onClick={() => setView('json')}>JSON</button>
      <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75" onClick={() => void copyJson()}>Copiar JSON completo</button>
      <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75" onClick={exportJson}>Exportar JSON completo</button>
    </div>
    <p className="text-xs text-white/45">Exibindo {matchingEntries.length} de {entries.length} falas; copiar e exportar sempre incluem o JSON completo.</p>
    {notice && <p role="status" className="text-xs text-cyan-100">{notice}</p>}
    {view === 'json' ? <textarea aria-label="JSON completo da cronologia" readOnly value={json} spellCheck={false} className="min-h-[65vh] w-full rounded-xl border border-white/10 bg-[#080c15] p-4 font-mono text-xs leading-5 text-emerald-100" /> : <>
      <div className="relative ml-2 border-l border-cyan-400/25 pl-5">
        {pageItems.map(({ entry, index, metadata: item }) => {
          return <article id={entry.entryId ? `transcript-${encodeURIComponent(entry.entryId)}` : undefined} data-entry-id={entry.entryId || undefined} key={`${entry.entryId || 'entry'}-${index}`} className="group relative scroll-mt-6 border-b border-white/5 py-4 first:pt-1 last:border-0">
            <span className="absolute -left-[25px] top-5 h-2.5 w-2.5 rounded-full border-2 border-[#0c1223] bg-cyan-300 group-hover:bg-violet-300" aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-3 text-xs"><time className="font-mono text-cyan-200">{formatTime(entry.startMs)}{entry.endMs != null ? `–${formatTime(entry.endMs)}` : ''}</time><span className="font-medium text-white">{entry.speakerName || entry.discordUserId || 'Locutor não identificado'}</span>{entry.playerName && <span className="text-white/60">Jogador: {entry.playerName}</span>}{entry.characterName && <span className="text-violet-200">{entry.characterName}</span>}{item?.overlap && <span className="text-amber-200">sobreposição</span>}{'reviewRequired' in item && item.reviewRequired && <span className="text-red-200">revisão</span>}</div>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/85">{entry.text || '(sem texto)'}</p>
            {item?.overlapWith?.length ? <p className="mt-1 text-xs text-amber-100/70">Sobrepõe: {item.overlapWith.join(', ')}</p> : null}
            {item?.warnings?.length ? <p className="mt-1 text-xs text-red-100/70">Avisos: {item.warnings.join(', ')}</p> : null}
          </article>;
        })}
      </div>
      {pageCount > 1 && <nav className="flex items-center justify-between border-t border-white/10 pt-3" aria-label="Paginação da cronologia"><button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Anterior</button><span className="text-xs text-white/50">Página {page + 1} de {pageCount}</span><button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40" disabled={page + 1 >= pageCount} onClick={() => setPage(current => current + 1)}>Próxima</button></nav>}
    </>}
  </section>;
}
