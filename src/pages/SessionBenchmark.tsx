import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import { useCampaign } from '../context/CampaignContext';

function SampleAudio({ id }: { id: string }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false, objectUrl = '';
    api.get(`/quality/audio/${id}`, { responseType: 'blob' }).then(({ data }) => {
      objectUrl = URL.createObjectURL(data);
      if (disposed) URL.revokeObjectURL(objectUrl); else setUrl(objectUrl);
    }).catch(() => { if (!disposed) setError('Não foi possível carregar o áudio deste trecho.'); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return error ? <p role="alert" className="text-amber-200">{error}</p> : url ? <audio aria-label="Áudio do trecho" controls src={url} className="w-full" /> : <p>Carregando áudio...</p>;
}

function time(milliseconds = 0) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
const percent = (value: number | null) => value === null ? 'Não medido' : `${(value * 100).toFixed(1)}%`;

export default function SessionBenchmark() {
  const { id } = useParams();
  const { campaigns, current, setCurrentById } = useCampaign();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any>(null); const [text, setText] = useState('');
  const [silence, setSilence] = useState(false); const [listened, setListened] = useState(false);
  const endpoint = `/quality/sessions/${id}/saved-benchmark`;
  async function reload() { const response = await api.get(endpoint); setData(response.data); }
  useEffect(() => {
    let disposed = false; setData(null); setError(''); setEditing(null);
    api.get(endpoint).then(response => { if (!disposed) setData(response.data); })
      .catch(err => { if (!disposed) setError(getApiErrorMessage(err, 'Não foi possível carregar esta sessão.')); });
    return () => { disposed = true; };
  }, [id]);
  useEffect(() => {
    if (data && campaigns.length && current?._id !== data.campanhaId) setCurrentById(data.campanhaId);
  }, [data?.campanhaId, campaigns, current?._id]);
  async function prepare() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.post(`${endpoint}/samples`, {}, { timeout: 120000 }); setData(response.data);
      setNotice('Trechos preparados a partir dos áudios locais. Escolha um para ouvir e corrigir.');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível preparar os trechos.')); }
    finally { setBusy(false); }
  }
  async function saveReference() {
    if (!editing || !listened) return;
    setBusy(true); setError('');
    try {
      await api.put(`/quality/references/${editing._id}`, { text: silence ? '' : text, kind: silence ? 'silence' : 'speech', revision: editing.reference?.revision });
      await reload(); setEditing(null); setNotice('Referência humana salva. O texto da transcrição original foi preservado.');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível salvar a referência.')); }
    finally { setBusy(false); }
  }
  async function evaluate() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post(`${endpoint}/evaluate`); await reload();
      setNotice('Avaliação concluída usando a transcrição salva. Nenhuma nova transcrição foi solicitada.');
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível calcular as métricas.')); }
    finally { setBusy(false); }
  }
  const samples: any[] = data?.samples || []; const reviewed = samples.filter(sample => sample.reference).length;
  const candidate = data?.runs?.[0];
  const referencesCurrent = candidate?.results?.length === reviewed && candidate?.results?.every((row: any) => samples.some(sample => sample._id === row.audioId && sample.reference?.revision === row.referenceRevision));
  const latest = referencesCurrent && candidate?.configuration?.transcriptionHash === data?.transcriptionHash ? candidate : null;
  const rows: any[] = latest?.results || [];
  const words = rows.reduce((sum, row) => sum + row.referenceWords, 0);
  const characters = rows.reduce((sum, row) => sum + row.referenceCharacters, 0);
  const wer = words ? rows.reduce((sum, row) => sum + row.errors, 0) / words : null;
  const cer = characters ? rows.reduce((sum, row) => sum + row.characterErrors, 0) / characters : null;
  return <div className="imagine-page mx-auto max-w-6xl space-y-6 text-white">
    <header className="it-panel it-glow it-grid-texture space-y-3 p-8">
      <Link to={`/sessions/${id}`} className="text-sm text-emerald-300">← Voltar à transcrição</Link>
      <h1 className="text-3xl font-semibold">Avaliar transcrição salva</h1>
      <p className="text-white/70">{data?.title || 'Carregando sessão...'}</p>
      <p className="text-sm text-emerald-200">Sem novas chamadas à xAI. Usa o texto já transcrito e cópias curtas dos áudios locais.</p>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-emerald-200">{notice}</p>}
    {data && <>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6">
        <h2 className="text-xl font-semibold">1. Ouvir e corrigir os trechos</h2>
        <p className="text-sm text-white/60">Prepare até 12 amostras, com até 20 segundos cada, distribuídas entre os participantes. Ouça cada áudio e corrija o que foi realmente falado.</p>
        <button type="button" disabled={busy || data.status !== 'completed'} onClick={prepare} className="rounded-xl border border-emerald-400/40 px-4 py-3 text-emerald-200 disabled:opacity-50">{busy ? 'Aguarde...' : 'Preparar trechos desta sessão'}</button>
        <p className="text-sm text-white/60">{samples.length} trechos disponíveis · {reviewed} referências corrigidas · {(samples.reduce((sum, sample) => sum + sample.durationMs, 0) / 60000).toFixed(1)} min de áudio.</p>
        {!samples.length && <p className="text-sm text-white/50">Prepare os trechos para começar. Nenhum resultado de precisão será calculado sem uma referência humana.</p>}
        <div className="grid gap-3 md:grid-cols-2">{samples.map(sample => <article key={sample._id} className="space-y-3 rounded-xl border border-white/10 p-4">
          <p className="text-sm text-emerald-300">{sample.speaker} · {time(sample.startMs)}–{time(sample.startMs + sample.durationMs)}</p>
          <p className="text-sm text-white/70">{sample.text}</p>
          <button type="button" disabled={busy} className="text-sm text-emerald-300 underline disabled:opacity-50" onClick={() => {
            setEditing(sample); setText(sample.reference?.text ?? sample.text); setSilence(sample.reference?.kind === 'silence'); setListened(false);
          }}>Ouvir e corrigir{sample.reference ? ' (referência salva)' : ''}</button>
        </article>)}</div>
        {editing && <div className="space-y-4 rounded-2xl border border-emerald-400/40 p-5">
          <h3 className="font-semibold">Referência de {editing.speaker} · {time(editing.startMs)}</h3>
          <SampleAudio key={editing._id} id={editing._id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={silence} onChange={event => setSilence(event.target.checked)} /> Este trecho não contém fala</label>
          <label className="block space-y-2 text-sm">Texto correto da referência<textarea aria-label="Texto correto da referência" value={text} onChange={event => setText(event.target.value)} disabled={silence || busy} rows={5} maxLength={10000} className="w-full rounded-xl bg-[#161c33] p-3 disabled:opacity-40" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={listened} onChange={event => setListened(event.target.checked)} /> Ouvi o áudio e conferi esta referência</label>
          <p className="text-xs text-white/50">Não considere o texto do modelo correto sem ouvir. As referências ficam preservadas até serem excluídas.</p>
          <div className="flex gap-4"><button type="button" disabled={busy || !listened || (!silence && !text.trim())} onClick={saveReference} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm disabled:opacity-50">Salvar referência</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className="text-sm text-white/60">Fechar</button></div>
        </div>}
      </section>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6">
        <h2 className="text-xl font-semibold">2. Calcular os erros</h2>
        <p className="text-sm text-white/60">Compara a transcrição salva com as referências corrigidas. O cálculo é local e não executa o modelo novamente.</p>
        <button type="button" disabled={busy || !reviewed} onClick={evaluate} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm disabled:opacity-50">Calcular WER e CER</button>
      </section>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6">
        <h2 className="text-xl font-semibold">3. Resultado dos trechos revisados</h2>
        {!latest ? <p className="text-sm text-white/50">Aguardando referências humanas e cálculo.</p> : <>
          <p className="text-sm text-white/70">{latest.models[0]} · {rows.length} amostras corrigidas · inferência não executada.</p>
          <div className="flex flex-wrap gap-6"><p>WER: <strong>{percent(wer)}</strong></p><p>CER: <strong>{percent(cer)}</strong></p><p>Palavras falsas em silêncio: <strong>{rows.reduce((sum, row) => sum + (row.falsePositiveWords || 0), 0)}</strong></p></div>
          <p className="text-sm text-amber-200">WER e CER medem erros; menor é melhor e podem ultrapassar 100%. Este resultado cobre apenas as amostras revisadas, não a precisão da sessão inteira.</p>
          <div className="space-y-4">{rows.map(row => <article key={row.audioId} className="space-y-2 rounded-xl border border-white/10 p-4">
            <p className="text-sm text-emerald-300">{row.speaker} · {time(row.startMs)} · WER {percent(row.wer)} · CER {percent(row.cer)}</p>
            <p className="text-sm text-white/60">Transcrição salva: {row.text || '(sem texto)'}</p>
            <p className="text-sm">Referência humana: {row.referenceText || '(sem fala)'}</p>
          </article>)}</div>
        </>}
      </section>
    </>}
  </div>;
}
