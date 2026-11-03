import type { NarrativeCandidate, NarrativeFact, NarrativeReference, NarrativeRun } from '../types/narrative';

export function transcriptAnchor(entryId: string): string {
  return `transcript-${encodeURIComponent(entryId)}`;
}

export function evidenceLink(reference: NarrativeReference, currentSessionId: string): string {
  const anchor = `#${transcriptAnchor(reference.entryId)}`;
  return reference.sessionId === currentSessionId ? anchor : `/sessions/${encodeURIComponent(reference.sessionId)}${anchor}`;
}

export function narrativeTime(startMs: number | null | undefined): string {
  if (startMs == null || !Number.isFinite(startMs)) return 'Tempo indisponível';
  const seconds = Math.max(0, Math.floor(startMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function factText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const fact = value as Record<string, unknown>;
    return typeof fact.text === 'string' ? fact.text : typeof fact.description === 'string' ? fact.description : '';
  }
  return '';
}

export function factReferences(value: unknown): NarrativeReference[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Array.isArray((value as NarrativeFact).references) ? (value as NarrativeFact).references : [];
}

export function runIsActive(run: NarrativeRun | null): boolean {
  return !!run && ['queued', 'processing', 'running', 'mapping', 'reducing', 'validating'].includes(run.status);
}

export function requestNarrativeGeneration(consent: boolean) {
  if (!consent) throw new Error('Confirme o envio dos trechos da transcrição ao OpenRouter.');
  return { consent: true };
}

export function candidateLabel(candidate: NarrativeCandidate): string {
  return candidate.name || candidate.description || candidate.text || 'Informação extraída';
}

export const NARRATIVE_STATUS_LABELS: Record<string, string> = {
  queued: 'Na fila', processing: 'Processando', running: 'Processando', completed: 'Pronta para revisão',
  awaiting_review: 'Pronta para revisão', approved: 'Aprovada', paused: 'Pausada — progresso salvo',
  failed: 'Interrompida', quota_exhausted: 'Cota gratuita atingida — progresso salvo', pending: 'Pendente',
  rejected: 'Rejeitada', linked: 'Vinculada', edited: 'Editada',
};
