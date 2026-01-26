import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { api, resolveImageUrl } from '../services/api';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';

type Session = any;

const EMPTY_FORM = {
  titulo: '',
  numero: '',
  cenariosVisitados: [] as string[],
  personagensPresentes: [] as string[],
  acontecimentosImportantes: '',
  versionType: '',
  versionContent: '',
  audioUrl: ''
};

export default function Sessions() {
  const { current } = useCampaign();
  const [items, setItems] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [scenarios, setScenarios] = useState<{ _id: string; nome: string }[]>([]);
  const [characters, setCharacters] = useState<{ _id: string; nome: string }[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStage, setSaveStage] = useState<string | null>(null);
  const saveProgressResetRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<any | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const { notify } = useToast();
  const AUDIO_SERVER_URL = 'http://54.157.56.101:8000';
  const getSessionId = (session: Session | null | undefined): string | null => {
    const id = session?._id ?? session?.id;
    if (id === null || id === undefined) return null;
    return String(id);
  };

  const toNumero = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeSessions = (list: Session[]) => {
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

    const unique = [...byId.values(), ...withoutId];
    return [...unique].sort((a, b) => {
      const aNum = toNumero(a?.numero);
      const bNum = toNumero(b?.numero);
      return (aNum ?? Number.MAX_SAFE_INTEGER) - (bNum ?? Number.MAX_SAFE_INTEGER);
    });
  };

  const getNextSessionNumero = (list: Session[]) => {
    const maxNumero = (list ?? []).reduce((acc: number, session: Session) => {
      const numero = toNumero(session?.numero);
      if (!numero) return acc;
      return numero > acc ? numero : acc;
    }, 0);
    return String(maxNumero + 1);
  };

  const loadOptions = useCallback(async () => {
    if (!current) return;
    const [scenariosRes, charactersRes] = await Promise.all([
      api.get('/scenarios', { params: { campanhaId: current._id } }),
      api.get('/characters', { params: { campanhaId: current._id } })
    ]);
    setScenarios(scenariosRes.data);
    setCharacters(charactersRes.data);
  }, [current]);

  const loadSessions = useCallback(async () => {
    if (!current) {
      setItems([]);
      return [];
    }

    const r = await api.get('/sessions', { params: { campanhaId: current._id } });
    const normalized = normalizeSessions(r.data);
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
      setAudioFile(null);
      return;
    }

    setForm({
      titulo: selected.titulo ?? '',
      numero: selected.numero?.toString() ?? '',
      cenariosVisitados: selected.cenariosVisitados?.map((id: string) => id.toString()) ?? [],
      personagensPresentes: selected.personagensPresentes?.map((id: string) => id.toString()) ?? [],
      acontecimentosImportantes: (selected.acontecimentosImportantes || []).join(', '),
      versionType: selected.versions?.[0]?.type ?? '',
      versionContent: selected.versions?.[0]?.content ?? '',
      audioUrl: selected.audio?.filename ?? ''
    });
    setTranscriptionResult(selected.transcription ?? null);
    setTranscriptionError(null);
    setAudioFile(null);
  }, [selected, items]);

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
          normalized.map(session =>
            getSessionId(session)
              ? api.patch(`/sessions/${getSessionId(session)}`, { numero: session.numero })
              : Promise.resolve()
          )
        );
        const refreshed = await loadSessions();
        if (selected) {
          const match = refreshed?.find(item => getSessionId(item) === getSessionId(selected));
          if (match) setSelected(match);
        }
        notify('Sessões reordenadas', { type: 'success' });
      } catch (error) {
        console.error(
          'sessions.reorder error',
          axios.isAxiosError(error) ? error.response?.data ?? error.message : error
        );
        notify('Não foi possível reordenar as sessões', { type: 'error' });
        await loadSessions();
      }
    },
    [items, loadSessions, notify, selected]
  );

  const handleDragStart = (sessionId: string) => {
    setDraggedSessionId(sessionId);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    event.preventDefault();
    setDragOverSessionId(sessionId);
  };

  const handleDrop = async (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    event.preventDefault();
    if (draggedSessionId) {
      await persistReorder(draggedSessionId, sessionId);
    }
    setDraggedSessionId(null);
    setDragOverSessionId(null);
  };

  const handleDragEnd = () => {
    setDraggedSessionId(null);
    setDragOverSessionId(null);
  };

  type PresignResponse = {
    uploadUrl: string;
    fileUrl: string;
  };

  async function uploadAudioToS3(
    file: File,
    campanhaId: string,
    onProgress?: (percent: number) => void,
    onStage?: (text: string) => void
  ): Promise<string> {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_PARALLEL = 5;

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    const createRes = await api.post("/upload/multipart/create", {
      campanhaId,
      tipo: "sessions",
      contentType: file.type,
      filename: file.name
    });

    const { uploadId, key } = createRes.data;

    const uploadedParts: { ETag: string; PartNumber: number }[] = [];
    let uploadedBytes = 0;
    let startedParts = 0;

    const uploadPart = async (partNumber: number) => {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const presignRes = await api.post("/upload/multipart/presign-part", {
        key,
        uploadId,
        partNumber
      });

      const { url } = presignRes.data;

      startedParts++;
      onStage?.(`Enviando áudio (${startedParts}/${totalParts})`);

      // 🔹 TIMER ANTI-TRAVA
      let fakeProgress = 0;
      const tick = setInterval(() => {
        fakeProgress += 1;
        onProgress?.(
          Math.min(
            80,
            Math.round(((uploadedBytes + blob.size * 0.1 + fakeProgress * 1024 * 50) / file.size) * 100)
          )
        );
      }, 700);

      try {
        const res = await fetch(url, {
          method: "PUT",
          body: blob
        });

        if (!res.ok) throw new Error(`Upload falhou: parte ${partNumber}`);

        const etag = res.headers.get("ETag");
        if (!etag) throw new Error(`ETag ausente: parte ${partNumber}`);

        uploadedParts.push({
          ETag: etag.replace(/"/g, ""),
          PartNumber: partNumber
        });

        uploadedBytes += blob.size;
        onProgress?.(Math.round((uploadedBytes / file.size) * 100));
      } finally {
        clearInterval(tick);
      }
    };


    const queue = Array.from({ length: totalParts }, (_, i) => i + 1);

    while (queue.length) {
      const batch = queue.splice(0, MAX_PARALLEL);
      await Promise.all(batch.map(uploadPart));
    }

    const completeRes = await api.post("/upload/multipart/complete", {
      key,
      uploadId,
      parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber)
    });

    return completeRes.data.fileUrl;
  }



  async function handleSave() {
    if (!current) {
      notify('Selecione uma campanha', { type: 'error' });
      return;
    }

    if (saveInFlightRef.current) return;

    if (!form.titulo.trim()) {
      notify('Título obrigatório', { type: 'error' });
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

    const importantEvents = form.acontecimentosImportantes
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const trimmedAudioUrl = form.audioUrl.trim();

    const versionPayload =
      form.versionType.trim() || form.versionContent.trim()
        ? [
          {
            type: form.versionType,
            content: form.versionContent
          }
        ]
        : [];

    let audioMetadata = null;

    /* =========================
       UPLOAD DO ÁUDIO (SE EXISTIR)
    ========================= */
    if (audioFile) {
      if (selected) {
        notify('Trocar o áudio de uma sessão existente não é suportado aqui.', {
          type: 'error'
        });
        saveInFlightRef.current = false;
        setIsSaving(false);
        setSaveStage(null);
        setSaveProgress(0);
        return;
      }

      try {
        setSaveStage('Enviando áudio (iniciando)');
        setSaveProgress(5);

        const audioUrl = await uploadAudioToS3(
          audioFile,
          current._id,
          (percent: number) => {
            // Escala o progresso do upload para 5% → 80%
            const scaled = 5 + Math.round(percent * 0.75);
            setSaveProgress(prev => (scaled > prev ? scaled : prev));
          },
          (stage: string) => {
            setSaveStage(stage);
          }
        );

        setSaveProgress(85);
        setSaveStage('Áudio enviado');

        audioMetadata = { filename: audioUrl };
      } catch (err) {
        console.error(err);
        notify('Não foi possível enviar o áudio', { type: 'error' });
        saveInFlightRef.current = false;
        setIsSaving(false);
        setSaveStage(null);
        setSaveProgress(0);
        return;
      }
    }

    /* =========================
       SALVAR SESSÃO NO BACKEND
    ========================= */
    try {
      const saveBase = audioFile ? 90 : 30;

      setSaveStage('Salvando sessão');
      setSaveProgress(prev => (prev < saveBase ? saveBase : prev));

      const payload: Record<string, any> = {
        campanhaId: current._id,
        titulo: form.titulo,
        cenariosVisitados: form.cenariosVisitados,
        personagensPresentes: form.personagensPresentes,
        acontecimentosImportantes: importantEvents,
        versions: versionPayload
      };

      // 🔒 BLINDAGEM DA TRANSCRIÇÃO
      const effectiveTranscription =
        transcriptionResult ?? selected?.transcription ?? null;

      if (effectiveTranscription) {
        payload.transcription = effectiveTranscription;
      }

      if (form.numero.trim()) {
        payload.numero = Number(form.numero);
      }

      if (audioMetadata) {
        payload.audio = audioMetadata;
      } else if (trimmedAudioUrl) {
        payload.audio = { filename: trimmedAudioUrl };
      }

      let saved: Session;

      const requestConfig = {
        onUploadProgress: (event: any) => {
          if (!event?.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          const start = audioFile ? 90 : 30;
          const scaled = start + Math.round((percent / 100) * (100 - start));
          setSaveProgress(prev => (scaled > prev ? scaled : prev));
        }
      };

      if (selected) {
        const sessionId = getSessionId(selected);
        if (!sessionId) throw new Error('Session id missing');

        const r = await api.patch(
          `/sessions/${sessionId}`,
          payload,
          requestConfig
        );
        saved = r.data;
      } else {
        const r = await api.post('/sessions', payload, requestConfig);
        saved = r.data;
      }

      await loadSessions();
      setSelected(saved);
      setAudioFile(null);
      setForm({ ...EMPTY_FORM });

      notify(selected ? 'Sessão atualizada' : 'Sessão criada', {
        type: 'success'
      });

      setSaveStage('Concluído');
      setSaveProgress(100);
    } catch (error) {
      console.error(
        'sessions.save error',
        axios.isAxiosError(error)
          ? error.response?.data ?? error.message
          : error
      );
      notify('Não foi possível salvar a sessão', { type: 'error' });
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);

      if (saveProgressResetRef.current !== null) {
        window.clearTimeout(saveProgressResetRef.current);
      }

      saveProgressResetRef.current = window.setTimeout(() => {
        setSaveProgress(0);
        setSaveStage(null);
        saveProgressResetRef.current = null;
      }, 600);
    }
  }


  async function getPresignedAudioUrl(fileUrl: string): Promise<string> {
    // transforma a URL do S3 em KEY
    const url = new URL(fileUrl);
    const key = url.pathname.replace(/^\/+/, '');

    const r = await fetch('http://localhost:4000/upload/presign-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    if (!r.ok) {
      throw new Error('Falha ao obter URL de download');
    }

    const { downloadUrl } = await r.json();
    return downloadUrl;
  }


  async function handleGenerateTranscription() {
    if (isTranscribing) return;

    const sessionId = getSessionId(selected);
    if (!sessionId) {
      notify('Salve a sessão antes de transcrever', { type: 'error' });
      return;
    }

    const audioUrl = selected?.audio?.filename;

    if (!audioUrl) {
      notify('Esta sessão não possui áudio', { type: 'error' });
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      // 🚀 ENVIA SOMENTE A URL PARA O BACKEND
      const r = await axios.post(
        `${AUDIO_SERVER_URL}/process-url`,
        {
          url: audioUrl,
          language: 'pt',
          context: 'rpg',
          diarize: false
        },
        { timeout: 1000 * 60 * 45 }
      );

      setTranscriptionResult(r.data);

      await api.patch(`/sessions/${sessionId}`, {
        transcription: r.data
      });

      const refreshed = await loadSessions();
      const match = refreshed?.find(s => getSessionId(s) === sessionId);
      if (match) setSelected(match);

      notify('Transcrição gerada com sucesso', { type: 'success' });

    } catch (error) {
      console.error(error);
      setTranscriptionError('Falha ao gerar transcrição');
      notify('Falha ao gerar transcrição', { type: 'error' });
    } finally {
      setIsTranscribing(false);
    }
  }



  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm('Deseja excluir esta sessão?')) return;

    const sessionId = getSessionId(selected);
    if (!sessionId) return;
    await api.delete(`/sessions/${sessionId}`);
    await loadSessions();
    setSelected(null);
    setForm({ ...EMPTY_FORM });
    setAudioFile(null);
    notify('Sessão excluída', { type: 'success' });
  }

  const selectedAudioSource = useMemo(() => {
    return (
      resolveImageUrl(
        selected?.audio?.filename ||
        selected?.audio?.url ||
        selected?.audio?.path ||
        selected?.audio?.location ||
        ''
      ) || ''
    );
  }, [selected]);

  const canTranscribe = Boolean(getSessionId(selected)) && Boolean(selectedAudioSource);

  const environmentSummary = useMemo(() => {
    return `${form.cenariosVisitados.length} cenários • ${form.personagensPresentes.length} personagens`;
  }, [form.cenariosVisitados, form.personagensPresentes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#161c33] to-[#050816] p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[36px] bg-[#050916] p-8 shadow-[0_30px_70px_rgba(3,7,18,0.8)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Sessões
            </div>
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold uppercase text-white shadow-lg shadow-cyan-900/30 transition hover:opacity-90"
              onClick={() => setSelected(null)}
            >
              Criar sessão
            </button>
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Documente cada sessão</h1>
          <p className="mt-2 text-sm text-white/60">
            Registre títulos, número, cenários visitados, personagens presentes e as versões narrativas.
          </p>
        </section>

        <section className="rounded-[40px] bg-[#0c1223] p-6 shadow-[0_20px_60px_rgba(5,5,20,0.8)]">
          <div className="grid gap-8 lg:grid-cols-[1.8fr,1fr]">
            <div className="space-y-6 rounded-[30px] border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-6 shadow-inner">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Título
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Título da sessão"
                    value={form.titulo}
                    onChange={e => setForm({ ...form, titulo: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Número
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="1"
                    value={form.numero}
                    readOnly
                  />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Cenários visitados</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {scenarios.map(s => (
                    <label
                      key={s._id}
                      className={`rounded-2xl border px-3 py-2 text-sm transition ${form.cenariosVisitados.includes(s._id)
                        ? 'border-cyan-400 bg-cyan-500/10'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={form.cenariosVisitados.includes(s._id)}
                        onChange={() => toggleSelection('cenariosVisitados', s._id)}
                      />
                      {s.nome}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Personagens presentes</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {characters.map(c => (
                    <label
                      key={c._id}
                      className={`rounded-2xl border px-3 py-2 text-sm transition ${form.personagensPresentes.includes(c._id)
                        ? 'border-cyan-400 bg-cyan-500/10'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={form.personagensPresentes.includes(c._id)}
                        onChange={() => toggleSelection('personagensPresentes', c._id)}
                      />
                      {c.nome}
                    </label>
                  ))}
                </div>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Acontecimentos importantes
                <input
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                  placeholder="vírgula separa itens"
                  value={form.acontecimentosImportantes}
                  onChange={e => setForm({ ...form, acontecimentosImportantes: e.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Versão (tipo)
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="narrativa, resumo..."
                    value={form.versionType}
                    onChange={e => setForm({ ...form, versionType: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Conteúdo
                  <textarea
                    className="mt-2 h-20 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Descreva a versão"
                    value={form.versionContent}
                    onChange={e => setForm({ ...form, versionContent: e.target.value })}
                  />
                </label>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Link do áudio
                <input
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                  placeholder="https://"
                  value={form.audioUrl}
                  onChange={e => setForm({ ...form, audioUrl: e.target.value })}
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Upload do áudio
                <input
                  type="file"
                  accept="audio/*"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                  onChange={e => setAudioFile(e.target.files?.[0] || null)}
                />
              </label>
              {audioFile && (
                <p className="text-xs text-cyan-300">Arquivo pronto para envio: {audioFile.name}</p>
              )}
              {!audioFile && selected?.audio?.filename && (
                <p className="text-xs text-white/50">Áudio atual: {selected.audio.filename}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold uppercase text-white shadow-lg shadow-cyan-900/40 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {selected ? 'Salvar sessão' : 'Registrar sessão'}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateTranscription}
                  disabled={!canTranscribe || isTranscribing || isSaving}
                  className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-sm font-semibold uppercase text-cyan-200 transition hover:text-white disabled:opacity-60"
                >
                  {isTranscribing ? 'Transcrevendo...' : 'Gerar transcrição'}
                </button>

                {selected && (
                  <button
                    type="button"
                    className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold uppercase text-white/60 transition hover:text-white"
                    onClick={handleDelete}
                  >
                    Excluir sessão
                  </button>
                )}
              </div>

              {(isSaving || saveProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{saveStage || 'Salvando sessão...'}</span>
                    <span>{saveProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                      style={{ width: `${saveProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                {environmentSummary}
              </p>
              {transcriptionError && (
                <p className="text-xs text-red-300">{transcriptionError}</p>
              )}
              {transcriptionResult && (
                <div className="space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 text-xs text-cyan-100">
                  <p className="uppercase tracking-[0.3em] text-cyan-200">Transcrição</p>
                  <div className="flex flex-wrap gap-2 text-cyan-100/80">
                    <span>Idioma: {transcriptionResult.language || '—'}</span>
                    <span>Tempo: {transcriptionResult.seconds ?? '—'}s</span>
                    <span>Segmentos: {transcriptionResult.segments?.length ?? 0}</span>
                  </div>
                  {transcriptionResult.segments?.[0]?.text && (
                    <p className="text-cyan-100/90">
                      Exemplo: {transcriptionResult.segments[0].text}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6 rounded-[30px] border border-white/5 bg-[#0c1021] p-6">
              <div className="space-y-2 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Sessões salvas</p>
                <p className="text-sm text-white/60">
                  Selecione uma sessão para carregar seus dados no formulário.
                </p>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {items.map((session, index) => {
                  const sessionId = getSessionId(session) ?? `session-${index}`;
                  return (
                    <button
                      key={sessionId}
                      type="button"
                      draggable
                      onDragStart={() => handleDragStart(sessionId)}
                      onDragOver={event => handleDragOver(event, sessionId)}
                      onDrop={event => handleDrop(event, sessionId)}
                      onDragLeave={() => setDragOverSessionId(null)}
                      onDragEnd={handleDragEnd}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm text-white transition ${getSessionId(selected) === sessionId
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-white/10 hover:border-white/30'
                        } ${dragOverSessionId === sessionId ? 'border-white/70 bg-white/5' : ''
                        }`}
                      onClick={() => setSelected(session)}
                    >
                      <div>
                        <p className="font-semibold">{session.titulo || 'Sessão sem nome'}</p>
                        <p className="text-xs text-white/50">#{session.numero || '—'}</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                        {session.personagensPresentes?.length || 0} presentes
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
