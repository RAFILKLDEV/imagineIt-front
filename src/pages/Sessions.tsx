import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';
import { TranscriptionAudioSettings } from '../components/TranscriptionAudioSettings';
import { sessionAudioFiles, sessionAudioParticipants, selectedParticipantIds, participantChoicesKey, transcriptionRequest, type AudioParticipantChoice } from '../services/sessionAudio';
import type { Session, TranscriptionJob } from '../types/transcription';

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function sessionIdOf(session: Session | null | undefined): string | null {
  const value = session?._id ?? session?.id;
  return value == null ? null : String(value);
}

function normalizeSessions(list: Session[]) {
  return [...(list || [])].filter(session => sessionIdOf(session)).sort((a, b) => {
    const aNumber = Number(a.numero); const bNumber = Number(b.numero);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
    return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
  });
}

function audioLabel(session: Session | null) {
  const audio = sessionAudioFiles(session)[0];
  return audio?.originalFilename || audio?.localPath?.split(/[\\/]/).pop() || audio?.relativePath?.split(/[\\/]/).pop() || audio?.key || audio?.filename || 'áudio do gravador';
}

export default function Sessions() {
  const { current } = useCampaign();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'transcribed'>('all');
  const [audioDraft, setAudioDraft] = useState<{ sessionId: string; participants: AudioParticipantChoice[] } | null>(null);
  const [activeJob, setActiveJob] = useState<TranscriptionJob | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestRef = useRef(false);

  const loadSessions = useCallback(async () => {
    if (!current) { setItems([]); setSelected(null); return []; }
    const { data } = await api.get<Session[]>('/sessions', { params: { campanhaId: current._id } });
    const normalized = normalizeSessions(data);
    setItems(normalized);
    setSelected(previous => previous ? normalized.find(item => sessionIdOf(item) === sessionIdOf(previous)) || normalized[0] || null : normalized[0] || null);
    return normalized;
  }, [current]);

  useEffect(() => { void loadSessions().catch(() => setError('Não foi possível carregar as sessões importadas pelo gravador.')); }, [loadSessions]);

  useEffect(() => {
    const id = sessionIdOf(selected);
    if (!id) { setActiveJob(null); setAudioDraft(null); return; }
    setAudioDraft(null); setActiveJob(null);
    let disposed = false;
    let timer: number | undefined;
    async function refresh() {
      try {
        const { data } = await api.get<TranscriptionJob[]>(`/sessions/${id}/transcription-jobs`);
        if (disposed) return;
        const job = data[0] || null;
        setActiveJob(job);
        setTranscribing(Boolean(job && !TERMINAL_JOB_STATUSES.has(job.status)));
        if (job && !TERMINAL_JOB_STATUSES.has(job.status)) timer = window.setTimeout(refresh, 2000);
        if (job?.status === 'failed') setError(job.errorMessage || 'A transcrição falhou.');
      } catch { /* uma sessão sem job ainda é um estado válido */ }
    }
    void refresh();
    return () => { disposed = true; if (timer) window.clearTimeout(timer); };
  }, [selected]);

  const savedChoices = useMemo(() => sessionAudioParticipants(selected), [selected]);
  const choices = audioDraft?.sessionId === sessionIdOf(selected) ? audioDraft.participants : savedChoices;
  const choicesReady = choices.length > 0 && choices.every(item => item.role !== 'unclassified');
  const choicesSaved = Boolean(selected?.transcriptionSettings) && participantChoicesKey(choices) === participantChoicesKey(savedChoices);
  const selectedIds = selectedParticipantIds(choices);
  const previousIds = activeJob?.selectedParticipantIds || selected?.transcription?.configuration?.selectedParticipantIds;
  const selectionChanged = JSON.stringify(selectedIds) !== JSON.stringify(Array.isArray(previousIds) ? [...previousIds].sort() : savedChoices.map(item => item.participantId).sort());
  const simulated = selected?.transcription?.engineVersion?.startsWith('simulated') || selected?.transcription?.warnings?.includes('simulated_development_response');
  const completed = selected?.transcription?.status === 'completed' && !simulated;
  const canTranscribe = Boolean(selected && sessionAudioFiles(selected).length && choicesReady && selectedIds.length && (!completed || selectionChanged));

  const visibleSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return items.filter(session => {
      const matchesQuery = !normalizedQuery || String(session.titulo || '').toLocaleLowerCase().includes(normalizedQuery) || String(session.numero || '').includes(normalizedQuery);
      const status = session.transcription?.status;
      const matchesFilter = filter === 'all' || (filter === 'transcribed' && status === 'completed') || (filter === 'pending' && status !== 'completed');
      return matchesQuery && matchesFilter;
    });
  }, [filter, items, query]);

  async function saveAudioSettings() {
    const id = sessionIdOf(selected);
    if (!id || !choicesReady || choicesSaved) return selected;
    const { data } = await api.put<Session>(`/sessions/${id}/transcription-settings`, { participants: choices.map(({ participantId, role, included }) => ({ participantId, role, included })) });
    setSelected(data); setItems(previous => previous.map(item => sessionIdOf(item) === id ? data : item)); setAudioDraft(null);
    return data;
  }

  async function startTranscription() {
    const id = sessionIdOf(selected);
    if (!id || requestRef.current || !canTranscribe) return;
    requestRef.current = true; setTranscribing(true); setError(''); setNotice('');
    try {
      const configured = await saveAudioSettings();
      const request = transcriptionRequest(configured || selected!);
      const retry = activeJob && !selectionChanged && (['failed', 'cancelled'].includes(activeJob.status) || (activeJob.status === 'completed' && simulated)) ? `/sessions/${id}/transcription-jobs/${activeJob.jobId}/retry` : `/sessions/${id}/transcription-jobs`;
      const { data: created } = await api.post<TranscriptionJob>(retry, request);
      let job = created; setActiveJob(job);
      while (!TERMINAL_JOB_STATUSES.has(job.status)) {
        await new Promise(resolve => window.setTimeout(resolve, 1800));
        const response = await api.get<TranscriptionJob>(`/sessions/${id}/transcription-jobs/${job.jobId}`);
        job = response.data; setActiveJob(job);
      }
      if (job.status !== 'completed') throw new Error(job.errorMessage || 'A transcrição falhou.');
      const refreshed = await api.get<Session>(`/sessions/${id}`);
      setSelected(refreshed.data); setItems(previous => previous.map(item => sessionIdOf(item) === id ? refreshed.data : item));
      setNotice('Transcrição concluída.');
    } catch (cause) {
      const message = axios.isAxiosError(cause) ? String(cause.response?.data?.error || cause.message) : cause instanceof Error ? cause.message : 'Não foi possível transcrever.';
      setError(message);
    } finally { requestRef.current = false; setTranscribing(false); }
  }

  async function saveSettings() {
    setSavingSettings(true); setError('');
    try { await saveAudioSettings(); notify('Seleção salva. Nenhum áudio foi enviado.', { type: 'success' }); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar a seleção.')); }
    finally { setSavingSettings(false); }
  }

  const audioFiles = sessionAudioFiles(selected);
  return <div className="imagine-page">
    <div className="mx-auto max-w-[1320px] space-y-6">
      <header className="it-panel it-glow it-grid-texture p-6 sm:p-8">
        <p className="it-eyebrow">Arquivo importado pelo gravador</p>
        <h1 className="it-heading mt-2 text-3xl font-semibold sm:text-4xl">Sessões</h1>
        <p className="it-muted mt-3 max-w-2xl text-sm leading-6">As sessões entram aqui pelo gravador. Escolha uma sessão para classificar os áudios, transcrever e abrir as etapas de leitura.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="it-status">{items.length} sessões</span><span className="it-status">{items.filter(item => item.transcription?.status === 'completed').length} transcritas</span>{current && <span className="it-status">Campanha: {current.nome}</span>}</div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <section className="it-panel p-4 sm:p-6" aria-label="Sessões do gravador">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="it-eyebrow">Arquivo</p><h2 className="mt-1 text-xl font-semibold">Escolha uma sessão</h2></div><span className="sessions-count">{visibleSessions.length}</span></div>
          <label className="sessions-search mt-4" aria-label="Buscar sessão"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título ou número" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca">×</button>}</label>
          <div className="sessions-filters mt-3" role="tablist" aria-label="Filtrar sessões">{([['all', 'Todas'], ['pending', 'Em preparo'], ['transcribed', 'Transcritas']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <div className="sessions-list mt-4" aria-live="polite">
            {!visibleSessions.length && <div className="sessions-empty"><p>Nenhuma sessão encontrada</p><span>As sessões aparecem aqui quando o gravador sincroniza a campanha.</span></div>}
            {visibleSessions.map((session, index) => { const id = sessionIdOf(session)!; const active = id === sessionIdOf(selected); const done = session.transcription?.status === 'completed'; return <button key={id} type="button" onClick={() => setSelected(session)} className={`session-row ${active ? 'is-active' : ''}`}><span className="session-row-number">{String(session.numero || index + 1).padStart(2, '0')}</span><span className="session-row-main"><strong>{session.titulo || `Sessão ${session.numero || index + 1}`}</strong><small>{audioLabel(session)} · {sessionAudioFiles(session).length} áudio(s)</small></span><span className={`session-row-status ${done ? 'is-done' : ''}`} title={done ? 'Transcrição concluída' : 'Aguardando transcrição'}>{done ? '✓' : '•'}</span></button>; })}
          </div>
        </section>

        <section className="it-panel p-5 sm:p-6" aria-label="Preparar transcrição">
          {!selected ? <div className="flex min-h-[360px] items-center justify-center text-center text-sm text-white/50">Selecione uma sessão para configurar os áudios.</div> : <>
            <div className="border-b border-white/10 pb-4"><p className="it-eyebrow">Sessão selecionada</p><h2 className="mt-1 text-2xl font-semibold">{selected.titulo || `Sessão ${selected.numero || ''}`}</h2><p className="mt-2 text-sm text-white/55">{audioFiles.length} áudio(s) recebido(s) do gravador · status {selected.transcription?.status || 'aguardando transcrição'}</p></div>
            <div className="mt-5 space-y-4"><TranscriptionAudioSettings participants={choices} onChange={participants => { const id = sessionIdOf(selected); if (id) setAudioDraft({ sessionId: id, participants }); }} disabled={transcribing || savingSettings} saved={choicesSaved} saving={savingSettings} onSave={saveSettings} /></div>
            {(error || selected.transcription?.errorMessage) && <p role="alert" className="mt-4 text-sm text-red-200">{error || selected.transcription?.errorMessage}</p>}{notice && <p role="status" className="mt-4 text-sm text-emerald-200">{notice}</p>}
            {activeJob && <div className="mt-4 space-y-2 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 text-xs text-cyan-100"><div className="flex justify-between"><span>{activeJob.currentStage || activeJob.status}</span><span>{activeJob.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${Math.max(0, Math.min(100, activeJob.progress))}%` }} /></div></div>}
            <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!canTranscribe || transcribing || savingSettings} onClick={() => void startTranscription()} className="it-primary !px-4 !py-2 !text-xs">{transcribing ? 'Transcrevendo…' : completed && !selectionChanged ? 'Transcrição concluída' : 'Enviar para transcrição'}</button><button type="button" onClick={() => navigate(`/sessions/${sessionIdOf(selected)}`)} className="it-secondary !px-4 !py-2 !text-xs">Visualizar sessão</button></div>
          </>}
        </section>
      </div>
    </div>
  </div>;
}
