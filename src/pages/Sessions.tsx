import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import { sessionAudioFiles, sessionAudioParticipants, selectedParticipantIds, participantChoicesKey, transcriptionRequest, type AudioParticipantChoice } from '../services/sessionAudio';
import { TranscriptionAudioSettings } from '../components/TranscriptionAudioSettings';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';
import type { Session, SessionAudio, SessionTranscription, TranscriptionJob } from '../types/transcription';
import { QualityPanel } from '../components/QualityPanel';

const EMPTY_FORM = {
  titulo: '',
  numero: '',
  cenariosVisitados: [] as string[],
  personagensPresentes: [] as string[],
  acontecimentosImportantes: '',
  versionType: '',
  versionContent: ''
};

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'cancelled']);

type OptionItem = {
  _id: string;
  nome: string;
};

type MultipartCreateResponse = {
  uploadId: string;
  bucket: string;
  key: string;
  contentType?: string;
};

type MultipartCompleteResponse = {
  bucket: string;
  key: string;
  checksum?: string;
};

function getSessionId(session: Session | null | undefined): string | null {
  const id = session?._id ?? session?.id;
  return id === null || id === undefined ? null : String(id);
}

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function putPart(url: string, blob: Blob, onLoaded: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onLoaded(event.loaded);
    };
    xhr.onerror = () => reject(new Error('Upload falhou'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload falhou: HTTP ${xhr.status}`));
        return;
      }
      const etag = xhr.getResponseHeader('ETag');
      if (!etag) {
        reject(new Error('ETag ausente'));
        return;
      }
      resolve(etag.replace(/"/g, ''));
    };
    xhr.send(blob);
  });
}

function toNumero(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSessions(list: Session[]) {
  const byId = new Map<string, Session>();
  const withoutId: Session[] = [];

  for (const session of list ?? []) {
    const id = getSessionId(session);
    if (!id) {
      withoutId.push(session);
      continue;
    }
    byId.set(id, session);
  }

  return [...byId.values(), ...withoutId].sort((a, b) => {
    const aNum = toNumero(a.numero);
    const bNum = toNumero(b.numero);
    return (aNum ?? Number.MAX_SAFE_INTEGER) - (bNum ?? Number.MAX_SAFE_INTEGER);
  });
}

function getNextSessionNumero(list: Session[]) {
  const maxNumero = (list ?? []).reduce((acc, session) => {
    const numero = toNumero(session.numero);
    return numero && numero > acc ? numero : acc;
  }, 0);
  return String(maxNumero + 1);
}

export default function Sessions() {
  const { current } = useCampaign();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [scenarios, setScenarios] = useState<OptionItem[]>([]);
  const [characters, setCharacters] = useState<OptionItem[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStage, setSaveStage] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [audioChoicesDraft, setAudioChoicesDraft] = useState<{ sessionId: string; participants: AudioParticipantChoice[] } | null>(null);
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'transcribed' | 'pending'>('all');
  const [activeJob, setActiveJob] = useState<TranscriptionJob | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<SessionTranscription | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const saveProgressResetRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const transcriptionInFlightRef = useRef(false);

  const loadOptions = useCallback(async () => {
    if (!current) return;
    const [scenariosRes, charactersRes] = await Promise.all([
      api.get<OptionItem[]>('/scenarios', { params: { campanhaId: current._id } }),
      api.get<OptionItem[]>('/characters', { params: { campanhaId: current._id } })
    ]);
    setScenarios(scenariosRes.data);
    setCharacters(charactersRes.data);
  }, [current]);

  const loadSessions = useCallback(async () => {
    if (!current) {
      setItems([]);
      return [];
    }

    const response = await api.get<Session[]>('/sessions', { params: { campanhaId: current._id } });
    const normalized = normalizeSessions(response.data);
    setItems(normalized);
    return normalized;
  }, [current]);

  useEffect(() => {
    loadOptions();
    loadSessions();
  }, [current, loadOptions, loadSessions]);

  useEffect(() => {
    if (!selected) {
      setForm({ ...EMPTY_FORM, numero: getNextSessionNumero(items) });
      setTranscriptionResult(null);
      setTranscriptionError(null);
      setActiveJob(null);
      setAudioFile(null);
      return;
    }

    setForm({
      titulo: selected.titulo ?? '',
      numero: selected.numero?.toString() ?? '',
      cenariosVisitados: selected.cenariosVisitados?.map(String) ?? [],
      personagensPresentes: selected.personagensPresentes?.map(String) ?? [],
      acontecimentosImportantes: (selected.acontecimentosImportantes || []).join(', '),
      versionType: selected.versions?.[0]?.type ?? '',
      versionContent: selected.versions?.[0]?.content ?? ''
    });
    setTranscriptionResult(selected.transcription ?? null);
    setTranscriptionError(selected.transcription?.errorMessage || null);
    setAudioFile(null);
  }, [selected, items]);

  // Recover a persisted job after reload/navigation. No browser-held job state is required.
  useEffect(() => {
    const sessionId = getSessionId(selected);
    if (!sessionId) return;
    setActiveJob(null);
    setIsTranscribing(false);
    let disposed = false;
    let timer: number | undefined;
    const refresh = async () => {
      try {
        const { data } = await api.get<TranscriptionJob[]>(`/sessions/${sessionId}/transcription-jobs`);
        if (disposed || !data.length) return;
        const job = data[0];
        setActiveJob(job);
        setIsTranscribing(!TERMINAL_JOB_STATUSES.has(job.status));
        if (job.status === 'failed') setTranscriptionError(job.errorMessage || 'A transcricao falhou');
        if (!TERMINAL_JOB_STATUSES.has(job.status)) timer = window.setTimeout(refresh, 2000);
        else {
          const { data: session } = await api.get<Session>(`/sessions/${sessionId}`);
          if (!disposed) { setSelected(session); setTranscriptionResult(session.transcription || null); }
        }
      } catch (error) { if (!disposed) setTranscriptionError(axios.isAxiosError(error) ? String(error.response?.data?.error || error.message) : 'Falha ao consultar job'); }
    };
    refresh();
    return () => { disposed = true; if (timer) window.clearTimeout(timer); };
  }, [selected?._id, selected?.id]);

  const toggleSelection = (field: 'cenariosVisitados' | 'personagensPresentes', id: string) => {
    setForm(prev => {
      const set = new Set(prev[field]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const persistReorder = useCallback(
    async (sourceId: string, targetId: string) => {
      const currentList = [...items];
      const fromIndex = currentList.findIndex(session => getSessionId(session) === sourceId);
      const toIndex = currentList.findIndex(session => getSessionId(session) === targetId);
      if (fromIndex === -1 || toIndex === -1 || sourceId === targetId) return;

      const reordered = [...currentList];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const normalized = reordered.map((session, index) => ({
        ...session,
        numero: index + 1
      }));
      setItems(normalized);

      try {
        await Promise.all(
          normalized.map(session => {
            const id = getSessionId(session);
            return id ? api.patch(`/sessions/${id}`, { numero: session.numero }) : Promise.resolve();
          })
        );
        const refreshed = await loadSessions();
        const selectedId = getSessionId(selected);
        const match = refreshed.find(item => getSessionId(item) === selectedId);
        if (match) setSelected(match);
        notify('Sessoes reordenadas', { type: 'success' });
      } catch (error) {
        console.error('sessions.reorder error', axios.isAxiosError(error) ? error.response?.data ?? error.message : error);
        notify('Nao foi possivel reordenar as sessoes', { type: 'error' });
        await loadSessions();
      }
    },
    [items, loadSessions, notify, selected]
  );

  const uploadAudioToS3 = async (
    file: File,
    campanhaId: string,
    onProgress?: (percent: number) => void,
    onStage?: (text: string) => void
  ): Promise<SessionAudio> => {
    const chunkSize = 10 * 1024 * 1024;
    const maxParallel = 5;
    const totalParts = Math.ceil(file.size / chunkSize);
    let uploadId = '';
    let key = '';

    try {
      const createRes = await api.post<MultipartCreateResponse>('/upload/multipart/create', {
        campanhaId,
        tipo: 'sessions',
        contentType: file.type,
        fileSize: file.size,
        filename: file.name
      });

      uploadId = createRes.data.uploadId;
      key = createRes.data.key;

      const uploadedParts: { ETag: string; PartNumber: number }[] = [];
      const loadedByPart = new Map<number, number>();
      let startedParts = 0;

      const uploadPart = async (partNumber: number) => {
        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);

        const presignRes = await api.post<{ url: string }>('/upload/multipart/presign-part', {
          key,
          uploadId,
          partNumber
        });

        startedParts += 1;
        onStage?.(`Enviando audio (${startedParts}/${totalParts})`);

        const etag = await putPart(presignRes.data.url, blob, loaded => {
          loadedByPart.set(partNumber, loaded);
          const uploadedBytes = Array.from(loadedByPart.values()).reduce((sum, value) => sum + value, 0);
          onProgress?.(Math.round((uploadedBytes / file.size) * 100));
        });

        loadedByPart.set(partNumber, blob.size);
        uploadedParts.push({ ETag: etag, PartNumber: partNumber });
      };

      const queue = Array.from({ length: totalParts }, (_, index) => index + 1);
      while (queue.length) {
        const batch = queue.splice(0, maxParallel);
        await Promise.all(batch.map(uploadPart));
      }

      const completeRes = await api.post<MultipartCompleteResponse>('/upload/multipart/complete', {
        key,
        uploadId,
        parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber)
      });

      return {
        bucket: completeRes.data.bucket || createRes.data.bucket,
        key: completeRes.data.key || key,
        originalFilename: file.name,
        mimetype: createRes.data.contentType || file.type || 'application/octet-stream',
        size: file.size,
        checksum: completeRes.data.checksum,
        sourceMode: 'mixed_upload'
      };
    } catch (error) {
      if (uploadId && key) {
        await api.post('/upload/multipart/abort', { key, uploadId }).catch(() => undefined);
      }
      throw error;
    }
  };

  async function handleSave() {
    if (!current) {
      notify('Selecione uma campanha', { type: 'error' });
      return;
    }
    if (saveInFlightRef.current) return;
    if (!form.titulo.trim()) {
      notify('Titulo obrigatorio', { type: 'error' });
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    if (saveProgressResetRef.current !== null) {
      window.clearTimeout(saveProgressResetRef.current);
      saveProgressResetRef.current = null;
    }
    setSaveProgress(0);
    setSaveStage('Preparando');
    setUploadError(null);

    const importantEvents = form.acontecimentosImportantes
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const versionPayload =
      form.versionType.trim() || form.versionContent.trim()
        ? [{ type: form.versionType, content: form.versionContent }]
        : [];

    let audioMetadata: SessionAudio | undefined;

    if (audioFile) {
      if (selected) {
        notify('Trocar o audio de uma sessao existente ainda nao e suportado aqui.', { type: 'error' });
        saveInFlightRef.current = false;
        setIsSaving(false);
        setSaveStage(null);
        setSaveProgress(0);
        return;
      }

      try {
        setSaveStage('Enviando audio');
        setSaveProgress(5);
        audioMetadata = await uploadAudioToS3(
          audioFile,
          current._id,
          percent => setSaveProgress(prev => Math.max(prev, 5 + Math.round(percent * 0.75))),
          stage => setSaveStage(stage)
        );
        setSaveProgress(85);
        setSaveStage('Audio enviado');
      } catch (error) {
        const message = getApiErrorMessage(error, 'Nao foi possivel enviar o audio.');
        console.error('sessions.upload error', axios.isAxiosError(error) ? error.response?.data || error.message : error);
        setUploadError(message);
        notify(message, { type: 'error' });
        saveInFlightRef.current = false;
        setIsSaving(false);
        setSaveStage(null);
        setSaveProgress(0);
        return;
      }
    }

    try {
      setSaveStage('Salvando sessao');
      setSaveProgress(prev => Math.max(prev, audioFile ? 90 : 30));

      const payload: Partial<Session> = {
        campanhaId: current._id,
        titulo: form.titulo,
        cenariosVisitados: form.cenariosVisitados,
        personagensPresentes: form.personagensPresentes,
        acontecimentosImportantes: importantEvents,
        versions: versionPayload
      };
      if (form.numero.trim()) payload.numero = Number(form.numero);
      if (audioMetadata) payload.audio = audioMetadata;

      const sessionId = getSessionId(selected);
      const response = sessionId
        ? await api.patch<Session>(`/sessions/${sessionId}`, payload)
        : await api.post<Session>('/sessions', payload);

      const refreshed = await loadSessions();
      const match = refreshed.find(item => getSessionId(item) === getSessionId(response.data));
      setSelected(match || response.data);
      setAudioFile(null);
      setForm({ ...EMPTY_FORM });
      notify(sessionId ? 'Sessao atualizada' : 'Sessao criada', { type: 'success' });
      setSaveStage('Concluido');
      setSaveProgress(100);
    } catch (error) {
      console.error('sessions.save error', axios.isAxiosError(error) ? error.response?.data ?? error.message : error);
      notify('Nao foi possivel salvar a sessao', { type: 'error' });
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
      if (saveProgressResetRef.current !== null) window.clearTimeout(saveProgressResetRef.current);
      saveProgressResetRef.current = window.setTimeout(() => {
        setSaveProgress(0);
        setSaveStage(null);
        saveProgressResetRef.current = null;
      }, 600);
    }
  }

  async function pollTranscriptionJob(sessionId: string, initialJob: TranscriptionJob) {
    let job = initialJob;
    setActiveJob(job);

    while (!TERMINAL_JOB_STATUSES.has(job.status)) {
      await delay(5000);
      const response = await api.get<TranscriptionJob>(`/sessions/${sessionId}/transcription-jobs/${job.jobId}`);
      job = response.data;
      setActiveJob(job);
    }

    return job;
  }

  async function handleGenerateTranscription() {
    if (isTranscribing || transcriptionInFlightRef.current) return;

    const sessionId = getSessionId(selected);
    if (!sessionId) {
      notify('Salve a sessao antes de transcrever', { type: 'error' });
      return;
    }
    if (!selected || !sessionAudioFiles(selected).length) {
      notify('Esta sessao precisa de um audio salvo antes do envio.', { type: 'error' });
      return;
    }
    if (!choicesReady || !chosenParticipantIds.length) {
      notify('Classifique os áudios e selecione pelo menos um para transcrever.', { type: 'error' });
      return;
    }

    transcriptionInFlightRef.current = true;
    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const configuredSession = await persistAudioSettings();
      const retry = activeJob && !selectionChanged && (['failed', 'cancelled'].includes(activeJob.status) ||
        (activeJob.status === 'completed' && hasSimulatedResult));
      const createResponse = await api.post<TranscriptionJob>(retry
        ? `/sessions/${sessionId}/transcription-jobs/${activeJob.jobId}/retry`
        : `/sessions/${sessionId}/transcription-jobs`, transcriptionRequest(configuredSession));

      const finalJob = await pollTranscriptionJob(sessionId, createResponse.data);
      if (finalJob.status !== 'completed') {
        throw new Error(finalJob.errorMessage || finalJob.errorCode || `Job ${finalJob.status}`);
      }

      const refreshed = await loadSessions();
      const match = refreshed.find(session => getSessionId(session) === sessionId);
      if (match) {
        setSelected(match);
        setTranscriptionResult(match.transcription ?? null);
      }
      notify(match?.transcription?.engineVersion?.startsWith('simulated') ? 'Simulacao concluida' : 'Transcricao concluida', { type: 'success' });
    } catch (error) {
      console.error(error);
      const message = axios.isAxiosError(error) ? String(error.response?.data?.error || error.message) : error instanceof Error ? error.message : 'Falha ao gerar transcricao';
      setTranscriptionError(message);
      notify('Falha ao gerar transcricao', { type: 'error' });
    } finally {
      transcriptionInFlightRef.current = false;
      setIsTranscribing(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm('Deseja excluir esta sessao?')) return;

    const sessionId = getSessionId(selected);
    if (!sessionId) return;
    await api.delete(`/sessions/${sessionId}`);
    await loadSessions();
    setSelected(null);
    setForm({ ...EMPTY_FORM });
    setAudioFile(null);
    notify('Sessao excluida', { type: 'success' });
  }

  const selectedAudioLabel = useMemo(() => {
    const audio = sessionAudioFiles(selected)[0];
    return audio?.originalFilename || audio?.localPath?.split(/[\\/]/).pop() || audio?.relativePath?.split(/[\\/]/).pop() || audio?.key || audio?.filename || '';
  }, [selected]);

  const hasSimulatedResult = selected?.transcription?.engineVersion?.startsWith('simulated') ||
    selected?.transcription?.warnings?.includes('simulated_development_response');
  const transcriptionCompleted = (activeJob?.status === 'completed' || selected?.transcription?.status === 'completed') && !hasSimulatedResult;
  const savedAudioChoices = sessionAudioParticipants(selected);
  const audioChoices = audioChoicesDraft?.sessionId === getSessionId(selected) ? audioChoicesDraft.participants : savedAudioChoices;
  const choicesReady = audioChoices.length > 0 && audioChoices.every(item => item.role !== 'unclassified');
  const choicesSaved = Boolean(selected?.transcriptionSettings) && participantChoicesKey(audioChoices) === participantChoicesKey(savedAudioChoices);
  const chosenParticipantIds = selectedParticipantIds(audioChoices);
  // Jobs created before participant settings included all captured tracks.
  const projectionParticipantIds = selected?.transcription?.configuration?.selectedParticipantIds;
  const jobParticipantIds = activeJob?.selectedParticipantIds ?? (Array.isArray(projectionParticipantIds)
    ? projectionParticipantIds.filter((id): id is string => typeof id === 'string').sort()
    : savedAudioChoices.map(item => item.participantId).sort());
  const selectionChanged = JSON.stringify(chosenParticipantIds) !== JSON.stringify(jobParticipantIds);
  const canTranscribe = Boolean(getSessionId(selected)) && choicesReady && chosenParticipantIds.length > 0 && (!transcriptionCompleted || selectionChanged);

  async function persistAudioSettings(): Promise<Session> {
    if (!selected || !choicesReady) throw new Error('Classifique todos os áudios antes de salvar a seleção.');
    if (choicesSaved) return selected;
    const { data } = await api.put<Session>(`/sessions/${getSessionId(selected)}/transcription-settings`, {
      participants: audioChoices.map(({ participantId, role, included }) => ({ participantId, role, included }))
    });
    setSelected(data);
    setItems(previous => previous.map(item => getSessionId(item) === getSessionId(data) ? data : item));
    setAudioChoicesDraft(null);
    return data;
  }

  async function handleSaveAudioSettings() {
    if (isSavingSettings || isTranscribing) return;
    setIsSavingSettings(true);
    try {
      await persistAudioSettings();
      notify('Seleção de áudios salva. Nenhum áudio foi enviado.', { type: 'success' });
    } catch (error) {
      notify(getApiErrorMessage(error, 'Não foi possível salvar a seleção.'), { type: 'error' });
    } finally {
      setIsSavingSettings(false);
    }
  }
  const environmentSummary = `${form.cenariosVisitados.length} cenarios - ${form.personagensPresentes.length} personagens`;

  const filteredItems = useMemo(() => {
    const query = sessionQuery.trim().toLocaleLowerCase();
    return items.filter(session => {
      const title = String(session.titulo || '').toLocaleLowerCase();
      const number = String(session.numero || '').toLocaleLowerCase();
      const matchesQuery = !query || title.includes(query) || number.includes(query);
      const status = session.transcription?.status;
      const matchesFilter = sessionFilter === 'all'
        || (sessionFilter === 'transcribed' && status === 'completed')
        || (sessionFilter === 'pending' && status !== 'completed');
      return matchesQuery && matchesFilter;
    });
  }, [items, sessionFilter, sessionQuery]);

  const handleDragStart = (sessionId: string) => setDraggedSessionId(sessionId);
  const handleDragOver = (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    event.preventDefault();
    setDragOverSessionId(sessionId);
  };
  const handleDrop = async (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    event.preventDefault();
    if (draggedSessionId) await persistReorder(draggedSessionId, sessionId);
    setDraggedSessionId(null);
    setDragOverSessionId(null);
  };

  return (
    <div className="imagine-page">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <header className="sessions-hero it-panel it-glow it-grid-texture relative overflow-hidden p-6 sm:p-8">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="it-eyebrow">Arquivo de campanha / Sessões</p>
              <h1 className="it-heading mt-2 text-3xl font-semibold sm:text-4xl">Organize cada capítulo</h1>
              <p className="it-muted mt-3 max-w-2xl text-sm leading-6">Registre a sessão, prepare os áudios e acompanhe o estado da transcrição em um único espaço de trabalho.</p>
            </div>
            <button type="button" className="it-primary" onClick={() => setSelected(null)}>
              <span aria-hidden="true">＋</span> Nova sessão
            </button>
          </div>
          <div className="relative z-10 mt-7 flex flex-wrap gap-2 text-xs">
            <span className="it-status"><span className="it-status-dot" /> {items.length} sessões no arquivo</span>
            <span className="it-status"><span className="it-status-dot" /> {items.filter(item => item.transcription?.status === 'completed').length} transcritas</span>
            {current && <span className="it-status">Campanha: {current.nome}</span>}
          </div>
        </header>

        <section className="sessions-workspace it-panel p-4 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_380px]">
            <div className="sessions-editor it-panel-raised space-y-6 p-5 sm:p-7">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Titulo
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Titulo da sessao"
                    value={form.titulo}
                    onChange={event => setForm({ ...form, titulo: event.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Numero
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="1"
                    value={form.numero}
                    readOnly
                  />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Cenarios visitados</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {scenarios.map(scenario => (
                    <label key={scenario._id} className={`rounded-2xl border px-3 py-2 text-sm transition ${form.cenariosVisitados.includes(scenario._id) ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 hover:border-white/30'}`}>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={form.cenariosVisitados.includes(scenario._id)}
                        onChange={() => toggleSelection('cenariosVisitados', scenario._id)}
                      />
                      {scenario.nome}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Personagens presentes</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {characters.map(character => (
                    <label key={character._id} className={`rounded-2xl border px-3 py-2 text-sm transition ${form.personagensPresentes.includes(character._id) ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 hover:border-white/30'}`}>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={form.personagensPresentes.includes(character._id)}
                        onChange={() => toggleSelection('personagensPresentes', character._id)}
                      />
                      {character.nome}
                    </label>
                  ))}
                </div>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Acontecimentos importantes
                <input
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                  placeholder="virgula separa itens"
                  value={form.acontecimentosImportantes}
                  onChange={event => setForm({ ...form, acontecimentosImportantes: event.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Versao
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="narrativa, resumo..."
                    value={form.versionType}
                    onChange={event => setForm({ ...form, versionType: event.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Conteudo
                  <textarea
                    className="mt-2 h-20 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Descreva a versao"
                    value={form.versionContent}
                    onChange={event => setForm({ ...form, versionContent: event.target.value })}
                  />
                </label>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Upload do audio
                <input
                  type="file"
                  accept="audio/*"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                  onChange={event => { setAudioFile(event.target.files?.[0] || null); setUploadError(null); }}
                />
              </label>
              {audioFile && <p className="text-xs text-cyan-300">Arquivo pronto: {audioFile.name}</p>}
              {uploadError && <p role="alert" className="text-sm text-red-300">{uploadError}</p>}
              {!audioFile && selectedAudioLabel && <p className="text-xs text-white/50">Audio atual: {selectedAudioLabel}</p>}

              <TranscriptionAudioSettings participants={audioChoices}
                onChange={participants => {
                  const sessionId = getSessionId(selected);
                  if (sessionId) setAudioChoicesDraft({ sessionId, participants });
                }}
                disabled={isTranscribing || isSavingSettings || isSaving}
                saved={choicesSaved} saving={isSavingSettings} onSave={handleSaveAudioSettings} />
              {transcriptionCompleted && selectionChanged && <p className="text-sm text-amber-200">
                Esta sessão já foi transcrita. Enviar a nova seleção fará outro processamento no Groq e substituirá a transcrição exibida.
              </p>}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold uppercase text-white shadow-lg shadow-cyan-900/40 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {selected ? 'Salvar sessao' : 'Registrar sessao'}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateTranscription}
                  disabled={!canTranscribe || isTranscribing || isSaving || isSavingSettings}
                  className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-sm font-semibold uppercase text-cyan-200 transition hover:text-white disabled:opacity-60"
                >
                  {isTranscribing ? 'Preparando e transcrevendo...' : transcriptionCompleted && !selectionChanged ? 'Transcrição enviada' : transcriptionCompleted ? 'Transcrever nova seleção' : 'Enviar transcrição'}
                </button>

                {selected && (
                  <button
                    type="button"
                    onClick={() => {
                      const sessionId = getSessionId(selected);
                      if (sessionId) navigate(`/sessions/${sessionId}`);
                    }}
                    className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-sm font-semibold uppercase text-cyan-200 transition hover:text-white disabled:opacity-60"
                  >
                    Visualizar sessao
                  </button>
                )}

                {selected && (
                  <button
                    type="button"
                    className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold uppercase text-white/60 transition hover:text-white"
                    onClick={handleDelete}
                  >
                    Excluir sessao
                  </button>
                )}
              </div>

              {selected && sessionAudioFiles(selected).length > 0 && <p className="text-sm text-white/60">Ao enviar a transcrição, os silêncios são removidos de uma cópia do áudio antes do envio ao Groq. A gravação original permanece salva.</p>}

              {(isSaving || saveProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{saveStage || 'Salvando sessao...'}</span>
                    <span>{saveProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{ width: `${saveProgress}%` }} />
                  </div>
                </div>
              )}

              {activeJob && (
                <div className="space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 text-xs text-cyan-100">
                  <div className="flex items-center justify-between gap-3">
                    <p className="uppercase tracking-[0.3em] text-cyan-200">Job</p>
                    <span>{activeJob.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${activeJob.progress}%` }} />
                  </div>
                  <p>Status: {activeJob.currentStage || activeJob.status}</p>
                </div>
              )}

              <p className="text-xs uppercase tracking-[0.3em] text-white/50">{environmentSummary}</p>
              {hasSimulatedResult && <p role="status" className="text-sm text-amber-200">Resultado de simulacao. O audio ainda nao foi transcrito de verdade.</p>}
              {transcriptionError && <p className="text-xs text-red-300">{transcriptionError}</p>}
              {transcriptionResult && (
                <div className="space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 text-xs text-cyan-100">
                  <p className="uppercase tracking-[0.3em] text-cyan-200">Transcricao</p>
                  <div className="flex flex-wrap gap-2 text-cyan-100/80">
                    <span>Status: {transcriptionResult.status || 'idle'}</span>
                    <span>Idioma: {transcriptionResult.language || '-'}</span>
                    <span>Segmentos: {transcriptionResult.segments?.length ?? 0}</span>
                  </div>
                  {transcriptionResult.segments?.[0]?.text && (
                    <p className="text-cyan-100/90">Exemplo: {transcriptionResult.segments[0].text}</p>
                  )}
                </div>
              )}
            </div>

            <aside className="sessions-library it-panel space-y-4 p-4 sm:p-5">
              {selected && getSessionId(selected) && <QualityPanel sessionId={getSessionId(selected)!} />}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="it-eyebrow">Arquivo</p>
                  <h2 className="mt-1 text-lg font-semibold">Suas sessões</h2>
                </div>
                <span className="sessions-count">{filteredItems.length}</span>
              </div>
              <label className="sessions-search" aria-label="Buscar sessão">
                <span aria-hidden="true">⌕</span>
                <input value={sessionQuery} onChange={event => setSessionQuery(event.target.value)} placeholder="Buscar por título ou número" />
                {sessionQuery && <button type="button" onClick={() => setSessionQuery('')} aria-label="Limpar busca">×</button>}
              </label>
              <div className="sessions-filters" role="tablist" aria-label="Filtrar sessões">
                {([['all', 'Todas'], ['pending', 'Em preparo'], ['transcribed', 'Transcritas']] as const).map(([value, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={sessionFilter === value} className={sessionFilter === value ? 'is-active' : ''} onClick={() => setSessionFilter(value)}>{label}</button>
                ))}
              </div>
              <p className="sessions-drag-hint">Arraste para reordenar o arquivo</p>
              <div className="sessions-list" aria-live="polite">
                {filteredItems.length === 0 && <div className="sessions-empty"><span className="sessions-empty-icon">✦</span><p>Nenhuma sessão encontrada</p><span>Ajuste a busca ou crie um novo capítulo.</span></div>}
                {filteredItems.map((session, index) => {
                  const sessionId = getSessionId(session) ?? `session-${index}`;
                  const isActive = getSessionId(selected) === sessionId;
                  const isDone = session.transcription?.status === 'completed';
                  return (
                    <button
                      key={sessionId}
                      type="button"
                      draggable
                      onDragStart={() => handleDragStart(sessionId)}
                      onDragOver={event => handleDragOver(event, sessionId)}
                      onDrop={event => handleDrop(event, sessionId)}
                      onDragLeave={() => setDragOverSessionId(null)}
                      onDragEnd={() => { setDraggedSessionId(null); setDragOverSessionId(null); }}
                      onClick={() => setSelected(session)}
                      className={`session-row ${isActive ? 'is-active' : ''} ${dragOverSessionId === sessionId ? 'is-drag-target' : ''}`}
                    >
                      <span className="session-row-grip" aria-hidden="true">⋮⋮</span>
                      <span className="session-row-number">{String(session.numero || index + 1).padStart(2, '0')}</span>
                      <span className="session-row-main"><strong>{session.titulo || 'Sessão sem nome'}</strong><small>{session.personagensPresentes?.length || 0} personagens · {session.cenariosVisitados?.length || 0} cenários</small></span>
                      <span className={`session-row-status ${isDone ? 'is-done' : ''}`} title={isDone ? 'Transcrição concluída' : 'Aguardando transcrição'}>{isDone ? '✓' : '•'}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
