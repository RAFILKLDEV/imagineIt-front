import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import { useCampaign } from '../context/CampaignContext';
import { QualityPanel } from '../components/QualityPanel';
import { qualityWarning } from '../services/qualityWarnings';

type Recording = { _id: string; campanhaId: string; titulo: string; status: 'recording' | 'stopped'; startedAt: string; lastSeenAt: string };
type Message = { _id: string; speaker: string; startMs: number; durationMs: number; status: string; text: string; error?: string; simulated?: boolean; qualityState?: string; revision?: number; warnings?: string[]; sourceAudioId?: string };
type Feed = { recording: Recording; messages: Message[]; counts: Record<string, number> };

function time(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export default function LiveRecording() {
  const { current } = useCampaign();
  const campaignId = current?._id;
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selected, setSelected] = useState('');
  const [feed, setFeed] = useState<Feed | null>(null);
  const [listError, setListError] = useState('');
  const [feedError, setFeedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [follow, setFollow] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const manualSelection = useRef(false);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    setRecordings([]); setSelected(''); setFeed(null); setListError(''); setLoading(true);
    manualSelection.current = false;
    async function poll() {
      if (!campaignId) { setLoading(false); return; }
      try {
        const { data } = await api.get<Recording[]>('/live-recordings', { params: { campanhaId: campaignId }, timeout: 10000 });
        if (disposed) return;
        setRecordings(data);
        setSelected(previous => manualSelection.current && data.some(item => item._id === previous)
          ? previous : (data.find(item => item.status === 'recording' && Date.now() - Date.parse(item.lastSeenAt) <= 35000) || data[0])?._id || '');
        setListError('');
      } catch (err) {
        if (!disposed) setListError(getApiErrorMessage(err, 'Não foi possível consultar as gravações. Tentando novamente...'));
      } finally {
        if (!disposed) { setLoading(false); timer = setTimeout(poll, 2000); }
      }
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [campaignId]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    setFeed(null); setFeedError('');
    async function poll() {
      if (!selected) return;
      try {
        const { data } = await api.get<Feed>(`/live-recordings/${selected}`, { timeout: 10000 });
        if (!disposed) { setFeed(data); setFeedError(''); }
      } catch (err) {
        if (!disposed) setFeedError(getApiErrorMessage(err, 'Conexão interrompida. Tentando novamente...'));
      } finally { if (!disposed) timer = setTimeout(poll, 2000); }
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [selected]);

  const visibleFeed = feed && feed.recording.campanhaId === campaignId && feed.recording._id === selected ? feed : null;
  const messages = visibleFeed?.messages || [];
  const counts = visibleFeed?.counts || {};
  const pending = (counts.queued || 0) + (counts.processing || 0);
  const recording = visibleFeed?.recording;
  const stale = recording?.status === 'recording' && Date.now() - Date.parse(recording.lastSeenAt) > 35_000;
  const lastMessage = messages.at(-1);
  useEffect(() => {
    if (follow) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [lastMessage?._id, lastMessage?.status, follow]);

  async function retry() {
    setRetrying(true);
    try { await api.post(`/live-recordings/${selected}/retry`); setFeedError(''); }
    catch (err) { setFeedError(getApiErrorMessage(err, 'Não foi possível tentar novamente.')); }
    finally { setRetrying(false); }
  }

  return (
    <div className="imagine-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="it-panel it-glow it-grid-texture p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">{current?.nome || 'Selecione uma campanha'}</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Transcrição ao vivo</h1><p className="mt-2 text-xs text-emerald-200">Modelo efetivo: xAI · grok-voice-transcribe-2.0</p>
          <p className="mt-3 text-sm text-white/60">O envio agora é manual: grave no Discord, encerre com /record stop e abra Sessões para usar Enviar transcrição. A captura e o processamento usam xAI Grok Voice Transcribe 2.0; as transcrições ao vivo anteriores continuam disponíveis abaixo.</p>
          <Link to="/sessions" className="it-secondary mt-5 inline-flex">Abrir Sessões e enviar transcrição</Link>
        </header>
        {!current && <Link to="/" className="inline-block text-emerald-300 underline">Selecionar campanha</Link>}
        {(listError || feedError) && <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{listError || feedError}</p>}
        {current && <section className="space-y-5 rounded-[32px] border border-white/10 bg-[#0c1223] p-6">
          {loading ? <p role="status" className="text-white/60">Buscando gravações...</p> : !recordings.length ? <div className="space-y-3 text-sm text-white/70">
            <h2 className="text-xl font-semibold text-white">Aguardando uma gravação</h2>
            <p>Inicie o gravador no computador e, no Discord, sincronize esta campanha, entre no canal de voz e use /join e /record start.</p>
            <Link to={`/campaigns/${campaignId}/settings`} className="inline-block text-emerald-300 underline">Ver comando de sincronização da campanha</Link>
            <p>Uma gravação iniciada antes desta atualização exige encerrar com /record stop, reiniciar o gravador e iniciar uma nova gravação.</p>
          </div> : <>
            <label className="block text-sm text-white/70">Gravação
              <select className="mt-2 w-full rounded-2xl border border-white/20 bg-[#0b101f] p-3 text-white" value={selected} onChange={e => { manualSelection.current = true; setSelected(e.target.value); }}>
                {recordings.map(item => <option key={item._id} value={item._id}>{item.titulo} — {new Date(item.startedAt).toLocaleString('pt-BR')} {item.status === 'recording' ? Date.now() - Date.parse(item.lastSeenAt) > 35000 ? '(sem sinal)' : '(ao vivo)' : '(encerrada)'}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p role="status" className={stale ? 'text-amber-300' : 'text-emerald-300'}>
                {!recording ? 'Carregando...' : stale ? 'Sem sinal do gravador. Verifique o terminal do bot.' : recording.status === 'recording' ? '● Gravando ao vivo' : 'Gravação encerrada'}
                {pending > 0 && ` · ${pending} trecho(s) em processamento`}
              </p>
              <label className="flex items-center gap-2 text-white/70"><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> Acompanhar novas falas</label>
            </div>
            {(counts.failed || 0) > 0 && <div className="flex flex-wrap items-center gap-3 text-sm text-red-200" role="alert">
              <span>{counts.failed} trecho(s) com falha.</span>
              <button type="button" disabled={retrying} onClick={retry} className="rounded-xl border border-red-300/30 px-3 py-2 disabled:opacity-50">{retrying ? 'Enviando...' : 'Tentar novamente'}</button>
            </div>}
            <div role="log" aria-label="Falas da gravação" aria-live="polite" aria-relevant="additions text" className="max-h-[60vh] space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4">
              {!messages.length && <p className="py-10 text-center text-sm text-white/50">{recording?.status === 'stopped' ? 'Nenhuma fala recebida nesta gravação.' : 'Aguardando as primeiras falas. O texto aparece após alguns segundos de áudio e processamento.'}</p>}
              {messages.map(message => <article key={message._id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="mb-2 flex gap-3 text-xs"><span className="font-semibold text-emerald-300">{message.speaker}</span><time className="text-white/40">{time(message.startMs)}</time></div>
                {message.simulated && <p className="mb-2 text-xs text-amber-300">Simulação: este texto não veio do áudio. Inicie o ambiente no modo real.</p>}
                {message.qualityState && <p className="mb-2 text-xs text-amber-200">{message.qualityState === 'provisional' ? 'Provisória' : message.qualityState === 'review_required' ? 'Precisa de revisão' : 'Confirmada'} · revisão {message.revision || 1}{message.warnings?.length ? ` · ${message.warnings.map(qualityWarning).join(', ')}` : ''}</p>}
                <p className={`whitespace-pre-wrap text-sm ${message.status === 'failed' ? 'text-red-200' : 'text-white/90'}`}>
                  {message.text || (message.status === 'completed' ? 'Nenhuma fala reconhecida neste trecho.' : message.status === 'failed' ? `Falha ao transcrever: ${message.error || 'Tente novamente.'}` : message.status === 'processing' ? 'Transcrevendo...' : 'Na fila para transcrição...')}
                </p>
              </article>)}
              <div ref={bottom} />
            </div>
            <p className="text-xs text-white/40">Exibindo até 500 trechos recentes. A gravação completa e a transcrição final continuam disponíveis no fluxo de Sessões após /record stop.</p>
            <Link to="/sessions" className="inline-block text-sm text-emerald-300 underline">Ver sessões</Link>
          </>}
        </section>}
        {selected && <QualityPanel key={selected} recordingId={selected} />}
      </div>
    </div>
  );
}
