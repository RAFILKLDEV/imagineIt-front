import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';

function AudioPlayer({ id }: { id: string }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false; let objectUrl = '';
    api.get(`/quality/audio/${id}`, { responseType: 'blob', timeout: 30000 }).then(({ data }) => {
      objectUrl = URL.createObjectURL(data); if (!disposed) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (!disposed) setError('Áudio indisponível ou expirado.'); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return error ? <p className="text-sm text-amber-200">{error}</p> : url ? <audio controls src={url} className="w-full" /> : <p className="text-sm text-white/50">Carregando áudio...</p>;
}

export default function Benchmarks() {
  const { current } = useCampaign();
  const [recordings, setRecordings] = useState<any[]>([]); const [recordingId, setRecordingId] = useState('');
  const [messages, setMessages] = useState<any[]>([]); const [references, setReferences] = useState<any[]>([]); const [runs, setRuns] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null); const [text, setText] = useState(''); const [silence, setSilence] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [includeMedium, setIncludeMedium] = useState(false);
  async function reload() {
    if (!current) return;
    const [r, refs, b, t, s] = await Promise.all([api.get('/live-recordings', { params: { campanhaId: current._id } }), api.get('/quality/references', { params: { campanhaId: current._id } }), api.get('/quality/benchmarks', { params: { campanhaId: current._id } }), api.get('/quality/load-trials', { params: { campanhaId: current._id } }), api.get('/quality/sessions', { params: { campanhaId: current._id } })]);
    return { recordings: r.data, references: refs.data, runs: b.data, trials: t.data, sessions: s.data };
  }
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout>;
    setRecordings([]); setSessions([]); setRecordingId(''); setMessages([]); setReferences([]); setRuns([]); setTrials([]); setEditing(null);
    async function poll() {
      try { const data = await reload(); if (!disposed && data) { setRecordings(data.recordings); setSessions(data.sessions); setReferences(data.references); setRuns(data.runs); setTrials(data.trials); setRecordingId(old => data.recordings.some((r: any) => r._id === old) || data.sessions.some((s: any) => `final:${s._id}` === old) ? old : data.recordings[0]?._id || (data.sessions[0] ? `final:${data.sessions[0]._id}` : '')); } }
      catch (err) { if (!disposed) setError(getApiErrorMessage(err, 'Não foi possível consultar os benchmarks.')); }
      finally { if (!disposed) timer = setTimeout(poll, 5000); }
    }
    void poll(); return () => { disposed = true; clearTimeout(timer); };
  }, [current?._id]);
  useEffect(() => {
    let disposed = false; setMessages([]); setEditing(null);
    if (recordingId) api.get(recordingId.startsWith('final:') ? `/quality/sessions/${recordingId.slice(6)}/samples` : `/live-recordings/${recordingId}`).then(({ data }) => { if (!disposed) setMessages(Array.isArray(data) ? data : data.messages); }).catch(() => { if (!disposed) setError('Não foi possível carregar as falas.'); });
    return () => { disposed = true; };
  }, [recordingId]);
  async function save() {
    setBusy(true); setError('');
    try {
      const ref = references.find(r => r.audioId === editing.sourceAudioId);
      await api.put(`/quality/references/${editing.sourceAudioId}`, { text: silence ? '' : text, kind: silence ? 'silence' : 'speech', revision: ref?.revision });
      const data = await reload(); if (data) setReferences(data.references);
      setNotice('Referência humana salva. O texto original foi preservado.'); setEditing(null);
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível salvar a referência.')); }
    finally { setBusy(false); }
  }
  async function run(performanceOnly = false) {
    setBusy(true); setError('');
    try {
      await api.post('/quality/benchmarks', { campanhaId: current?._id, models: ['tiny', 'base', 'small', ...(includeMedium ? ['medium'] : [])], mode: performanceOnly ? 'performance' : 'accuracy', ...(recordingId.startsWith('final:') ? { sessionId: recordingId.slice(6) } : { recordingId }) });
      setNotice('Benchmark enfileirado. Ele aguarda gravações ao vivo e processa as amostras em segundo plano.');
      const data = await reload(); if (data) setRuns(data.runs);
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível iniciar o benchmark.')); }
    finally { setBusy(false); }
  }
  const latest = runs[0];
  const resultRows: any[] = latest?.results || [];
  return <div className="imagine-page mx-auto max-w-6xl space-y-6 text-white">
    <header className="it-panel it-glow it-grid-texture p-8"><Link to="/live" className="text-sm text-emerald-300">← Ao vivo</Link><h1 className="mt-4 text-3xl font-semibold">Benchmarks</h1><p className="mt-3 text-sm text-white/60">{current?.nome || 'Selecione uma campanha'} · Compare os mesmos áudios entre modelos. Corrija 2–3 minutos de fala para começar a medir a precisão.</p></header>
    {!current && <Link to="/" className="text-emerald-300 underline">Selecionar campanha</Link>}
    {recordingId.startsWith('final:') && <section className="space-y-3 rounded-[28px] border border-emerald-400/30 bg-[#0c1223] p-6"><h2 className="text-xl font-semibold">Usar a transcrição desta sessão</h2><p className="text-sm text-white/60">Ouça trechos e compare o texto já salvo com referências corrigidas, sem novas chamadas à xAI.</p><Link className="inline-block rounded-xl bg-emerald-500 px-4 py-3 text-sm" to={`/benchmarks/sessions/${recordingId.slice(6)}`}>Avaliar transcrição salva</Link></section>}
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
    {current && <>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6"><h2 className="text-xl font-semibold">1. Ouvir e corrigir referências</h2><p className="text-sm text-white/60">Salvas: {references.length}. Os áudios das referências ficam preservados até você excluir a referência; os demais expiram em sete dias.</p>
        <select aria-label="Gravação para benchmark" value={recordingId} onChange={e => setRecordingId(e.target.value)} className="w-full rounded-xl bg-[#161c33] p-3">{!recordings.length && !sessions.length && <option value="">Nenhuma gravação disponível</option>}<optgroup label="Gravações ao vivo">{recordings.map(r => <option key={r._id} value={r._id}>{r.titulo} — {new Date(r.startedAt).toLocaleString('pt-BR')}</option>)}</optgroup><optgroup label="Revisões finais">{sessions.map(s => <option key={s._id} value={`final:${s._id}`}>{s.titulo || 'Sessão'} — revisão final</option>)}</optgroup></select>
        <div className="max-h-96 space-y-2 overflow-y-auto">{messages.filter(m => m.sourceAudioId).map(m => <div key={m._id} className="rounded-xl border border-white/10 p-4"><p className="text-xs text-emerald-300">{m.speaker} · {(m.startMs / 1000).toFixed(1)} s · {m.warnings?.join(', ') || 'Sem alerta automático'}</p><p className="my-2 text-sm text-white/70">{m.text || 'Sem texto reconhecido'}</p><button className="text-sm text-emerald-300 underline" type="button" onClick={() => { const ref = references.find(r => r.audioId === m.sourceAudioId); setEditing(m); setText(ref?.text ?? m.rawText ?? m.text ?? ''); setSilence(ref?.kind === 'silence'); }}>Ouvir e corrigir{references.some(r => r.audioId === m.sourceAudioId) ? ' (referência salva)' : ''}</button></div>)}</div>
        {!messages.some(m => m.sourceAudioId) && <p className="text-sm text-white/50">Os trechos ficarão disponíveis após o reconhecimento com o perfil de qualidade. Gravações antigas podem não ter cópia de diagnóstico.</p>}
        {editing && <div className="space-y-3 rounded-2xl border border-emerald-400/30 p-5"><h3 className="font-semibold">Referência de {editing.speaker}</h3><AudioPlayer key={editing.sourceAudioId} id={editing.sourceAudioId} /><p className="text-xs text-white/50">Escreva o que foi realmente falado, incluindo gagueira quando audível. Não use o resultado do modelo como referência sem ouvir.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={silence} onChange={e => setSilence(e.target.checked)} /> Este trecho não contém fala</label><textarea aria-label="Texto correto da referência" value={text} disabled={silence} onChange={e => setText(e.target.value)} rows={4} maxLength={10000} className="w-full rounded-xl bg-[#161c33] p-3 disabled:opacity-40" /><button type="button" disabled={busy || (!silence && !text.trim())} onClick={save} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm disabled:opacity-50">Salvar referência humana</button><button type="button" onClick={() => setEditing(null)} className="ml-3 text-sm text-white/60">Fechar</button></div>}
        {references.length > 0 && <details className="text-sm"><summary className="cursor-pointer">Referências salvas e versões</summary>{references.map(ref => <div key={ref._id} className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3"><p>v{ref.revision} · {ref.kind === 'silence' ? 'Sem fala' : ref.text}</p><button type="button" className="text-red-200" onClick={async () => { try { await api.delete(`/quality/references/${ref._id}`); const data = await reload(); if (data) setReferences(data.references); } catch { setError('Não foi possível excluir a referência.'); } }}>Excluir referência</button></div>)}</details>}
      </section>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6"><h2 className="text-xl font-semibold">2. Comparar modelos</h2><p className="text-sm text-white/60">tiny, base e small · Português · CPU/int8 · Mesmos áudios. Carregamento e aquecimento são registrados separadamente.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={includeMedium} onChange={e => setIncludeMedium(e.target.checked)} /> Incluir medium (mais demorado)</label><div className="flex flex-wrap gap-3"><button type="button" disabled={busy || !references.length} onClick={() => run(false)} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm disabled:opacity-50">Comparar qualidade e desempenho</button><button type="button" disabled={busy || !messages.some(m => m.sourceAudioId)} onClick={() => run(true)} className="rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-50">Comparar desempenho sem referência</button></div>
        <p className="text-xs text-white/40">WER e CER representam erros; menor é melhor. Podem ultrapassar 100%. Confiança não equivale a precisão. O benchmark não troca seu modelo automaticamente.</p>
      </section>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6"><h2 className="text-xl font-semibold">3. Resultados</h2>{!latest ? <p className="text-sm text-white/50">Nenhum benchmark executado.</p> : <><p className="text-sm text-white/70">Estado: {latest.status} · {resultRows.length}/{latest.models.length * latest.references.length} comparações · {new Date(latest.createdAt).toLocaleString('pt-BR')}</p>{latest.error && <p className="text-sm text-red-200">{latest.error}</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-white/50"><tr>{['Modelo', 'WER', 'CER', 'Termos corretos', 'Inferência média', 'RTF médio', 'Pico RAM', 'Amostras'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{latest.models.map((model: string) => { const rows = resultRows.filter(r => r.model === model); const n = rows.length; const words = rows.reduce((s, r) => s + (r.referenceWords || 0), 0); const chars = rows.reduce((s, r) => s + (r.referenceCharacters || 0), 0); return <tr key={model} className="border-t border-white/10"><td className="p-3 text-emerald-300">{model}</td><td className="p-3">{words ? `${(rows.reduce((s, r) => s + r.errors, 0) / words * 100).toFixed(1)}%` : 'Não medida'}</td><td className="p-3">{chars ? `${(rows.reduce((s, r) => s + r.characterErrors, 0) / chars * 100).toFixed(1)}%` : 'Não medida'}</td><td className="p-3">{rows.reduce((s, r) => s + (r.correctTerms || 0), 0)}/{rows.reduce((s, r) => s + (r.expectedTerms || 0), 0)}</td><td className="p-3">{n ? `${(rows.reduce((s, r) => s + r.metrics.inferMs, 0) / n / 1000).toFixed(2)} s` : '—'}</td><td className="p-3">{n ? (rows.reduce((s, r) => s + r.metrics.rtf, 0) / n).toFixed(2) : '—'}</td><td className="p-3">{n ? `${(Math.max(...rows.map(r => r.metrics.rssBytes || 0)) / 1048576).toFixed(0)} MiB` : '—'}</td><td className="p-3">{n}</td></tr>; })}</tbody></table></div>
        <details className="text-sm"><summary className="cursor-pointer">Original, referência e resultados lado a lado</summary>{latest.references.map((ref: any) => <div key={ref._id} className="mt-4 rounded-xl border border-white/10 p-4"><p className="text-white/50">Original: {ref.originalText || 'Indisponível'}</p><p className="mt-2 text-emerald-200">Referência: {ref.reviewed === false ? 'Ainda não corrigida por uma pessoa' : ref.text || '(sem fala)'}</p><div className="mt-3 grid gap-3 md:grid-cols-3">{resultRows.filter(r => r.referenceId === String(ref._id)).map(r => <div key={r.model} className="rounded-xl bg-white/5 p-3"><p className="text-xs text-emerald-300">{r.model}</p><p className="mt-2">{r.text || '(sem texto)'}</p></div>)}</div></div>)}</details>
      </>}</section>
      <section className="space-y-4 rounded-[28px] bg-[#0c1223] p-6"><h2 className="text-xl font-semibold">4. Carga com quatro participantes</h2><p className="text-sm text-white/60">Reprodução local de áudios reais. Os resultados incluem a janela de captura e uma estimativa de dois segundos de atualização do painel; não representam precisão nem garantem o atraso de toda gravação.</p>
        {!trials.length && <p className="text-sm text-white/50">Nenhum ensaio de carga registrado nesta campanha.</p>}
        {trials.map(trial => <div key={trial._id} className="rounded-xl border border-white/10 p-4"><p className="mb-3 text-sm text-emerald-300">{trial.scenario === 'recorded_timing_with_preview_and_confirmation' ? 'Tempos originais, com prévia e confirmação' : 'Estresse: quatro falantes simultâneos'} · {new Date(trial.generatedAt).toLocaleString('pt-BR')}</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-white/50"><tr><th className="p-2">Modelo</th><th className="p-2">Participantes</th><th className="p-2">Requisições</th><th className="p-2">Atraso p95 estimado</th><th className="p-2">Meta de 20 s</th></tr></thead><tbody>{trial.results.map((row: any) => <tr key={row.model} className="border-t border-white/10"><td className="p-2">{row.model}</td><td className="p-2">{row.participants}</td><td className="p-2">{row.samples.length}</td><td className="p-2">{(row.latencyP95Ms / 1000).toFixed(2)} s</td><td className={`p-2 ${row.passesLatencyTarget ? 'text-emerald-300' : 'text-amber-200'}`}>{row.passesLatencyTarget ? 'Atendida neste ensaio' : 'Não atendida'}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-white/40">Precisão: aguardando referências humanas. Consulte o diagnóstico exportado para os dados por requisição.</p></div>)}
      </section>
    </>}
  </div>;
}
