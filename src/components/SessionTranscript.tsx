import React, { useMemo } from 'react';
import type { Session, TranscriptItem, TranscriptSegment } from '../types/transcription';

function formatTime(seconds?: number, millis?: number) {
  const totalSeconds = seconds ?? (millis !== undefined ? millis / 1000 : undefined);
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds)) return '-';
  const minutes = Math.floor(totalSeconds / 60);
  const rest = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function itemsFromSession(session: Session | null): TranscriptItem[] {
  const items = session?.transcription?.items;
  if (Array.isArray(items) && items.length) return items;

  const segments = session?.transcription?.segments || [];
  return segments.map((segment: TranscriptSegment, index) => ({
    entryId: `segment-${index}`,
    speaker: segment.speaker,
    userId: segment.userId,
    text: segment.text,
    startMs: segment.start !== undefined ? Math.round(segment.start * 1000) : undefined,
    endMs: segment.end !== undefined ? Math.round(segment.end * 1000) : undefined,
    overlap: segment.overlap,
    overlapWith: segment.overlapWith,
    warnings: segment.warnings
  }));
}

export function SessionTranscript({session,error=''}: {session:Session|null;error?:string}) {
  const transcriptItems = useMemo(() => itemsFromSession(session), [session]);

  if (!session) return <p>{error || 'Carregando sessao...'}</p>;
  const isSimulated = session.transcription?.engineVersion?.startsWith('simulated') ||
    session.transcription?.warnings?.includes('simulated_development_response');

  return (
    <div className="min-h-screen bg-[#07101f] p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Sessao</p>
          <h1 className="text-2xl font-semibold">{session.titulo || 'Sessao sem nome'}</h1>
          <p className="text-sm text-white/60">
            Status: {session.transcription?.status || 'sem transcricao'} - Itens: {transcriptItems.length}
          </p>
        </header>
        {isSimulated && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">Resultado de simulacao. Este texto nao foi extraido do audio.</p>}
        {(error || session.transcription?.errorMessage) && <p role="alert" className="text-red-300">{error || session.transcription?.errorMessage}</p>}

        {transcriptItems.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-white/60">
            Esta sessao ainda nao possui transcricao.
          </p>
        )}

        <div className="space-y-3">
          {transcriptItems.map((item, index) => (
            <article key={`${item.entryId || index}-${item.startMs || 0}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/50">
                <span className="text-cyan-200">{item.speaker || item.discordNick || item.userId || 'Desconhecido'}</span>
                <span>{formatTime(undefined, item.startMs)} - {formatTime(undefined, item.endMs)}</span>
                {item.overlap && <span className="text-amber-200">overlap</span>}
                {item.reviewRequired && <span className="text-red-200">revisao</span>}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/90">{item.text}</p>
              {item.overlapWith && item.overlapWith.length > 0 && (
                <p className="mt-2 text-xs text-amber-100/80">Sobrepoe: {item.overlapWith.join(', ')}</p>
              )}
              {item.warnings && item.warnings.length > 0 && (
                <p className="mt-2 text-xs text-red-100/80">Avisos: {item.warnings.join(', ')}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
