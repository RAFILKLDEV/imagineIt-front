import { useMemo } from 'react';
import type { Session, TranscriptItem, TranscriptSegment } from '../types/transcription';

function formatTime(millis?: number) {
  if (millis == null || !Number.isFinite(millis)) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function itemsFromSession(session: Session | null): TranscriptItem[] {
  const items = session?.transcription?.items;
  if (Array.isArray(items) && items.length) return [...items].sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));
  const segments = session?.transcription?.segments || [];
  return segments.map((segment: TranscriptSegment, index) => ({ entryId: `segment-${index}`, speaker: segment.speaker, userId: segment.userId, text: segment.text, startMs: segment.start !== undefined ? Math.round(segment.start * 1000) : undefined, endMs: segment.end !== undefined ? Math.round(segment.end * 1000) : undefined, overlap: segment.overlap, overlapWith: segment.overlapWith, warnings: segment.warnings }));
}

export function SessionTranscript({ session, error = '' }: { session: Session | null; error?: string }) {
  const transcriptItems = useMemo(() => itemsFromSession(session), [session]);
  if (!session) return <p>{error || 'Carregando sessão...'}</p>;
  const isSimulated = session.transcription?.engineVersion?.startsWith('simulated') || session.transcription?.warnings?.includes('simulated_development_response');
  return <section aria-label="Cronologia da sessão" className="space-y-5 text-white">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4"><div><p className="it-eyebrow">Cronologia</p><h2 className="mt-1 text-2xl font-semibold">{session.titulo || 'Sessão sem nome'}</h2><p className="mt-2 text-sm text-white/55">{transcriptItems.length} falas · {session.transcription?.status || 'sem transcrição'}</p></div><span className="text-xs text-white/45">As falas estão ordenadas pelo tempo do áudio.</span></header>
    {isSimulated && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">Resultado de simulacao; o texto nao foi extraido do audio.</p>}
    {(error || session.transcription?.errorMessage) && <p role="alert" className="text-sm text-red-300">{error || session.transcription?.errorMessage}</p>}
    {!transcriptItems.length && <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">Esta sessão ainda não possui transcrição.</p>}
    <div className="relative ml-2 border-l border-cyan-400/25 pl-5">
      {transcriptItems.map((item, index) => <article id={item.entryId ? `transcript-${encodeURIComponent(item.entryId)}` : undefined} data-entry-id={item.entryId || undefined} key={`${item.entryId || index}-${item.startMs || 0}`} className="group relative scroll-mt-6 border-b border-white/5 py-4 first:pt-1 last:border-0">
        <span className="absolute -left-[25px] top-5 h-2.5 w-2.5 rounded-full border-2 border-[#0c1223] bg-cyan-300 group-hover:bg-violet-300" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-3 text-xs"><time className="font-mono text-cyan-200">{formatTime(item.startMs)}{item.endMs != null ? `–${formatTime(item.endMs)}` : ''}</time><span className="font-medium text-white">{item.speaker || item.discordNick || item.userId || 'Desconhecido'}</span>{item.overlap && <span className="text-amber-200">sobreposição</span>}{item.reviewRequired && <span className="text-red-200">revisão</span>}</div>
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/85">{item.text || item.rawText || '(sem texto)'}</p>
        {item.overlapWith?.length ? <p className="mt-1 text-xs text-amber-100/70">Sobrepõe: {item.overlapWith.join(', ')}</p> : null}
        {item.warnings?.length ? <p className="mt-1 text-xs text-red-100/70">Avisos: {item.warnings.join(', ')}</p> : null}
      </article>)}
    </div>
  </section>;
}
