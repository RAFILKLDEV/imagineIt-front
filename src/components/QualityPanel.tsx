import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';

const seconds = (ms: number | null | undefined) => ms == null ? 'Indisponível' : `${(ms / 1000).toFixed(1)} s`;
const percent = (n: number | null | undefined) => n == null ? 'Ainda não medida' : `${(n * 100).toFixed(1)}%`;

function metadataRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).length > 0) : [];
}

export function QualityPanel({ recordingId, sessionId }: { recordingId?: string; sessionId?: string }) {
  const [data, setData] = useState<any>(null);
  const [finalData, setFinalData] = useState<any>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [metric, setMetric] = useState('latencyMs');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout>;
    setData(null); setFinalData(null); setError('');
    async function poll() {
      try {
        const { data: result } = await api.get(sessionId ? `/quality/sessions/${sessionId}/metrics` : `/quality/recordings/${recordingId}/metrics`, { timeout: 15000 });
        if (!disposed) { setData(sessionId ? result.live : result); setFinalData(sessionId ? result.final : null); setError(''); }
      } catch (err) { if (!disposed) setError(getApiErrorMessage(err, 'Não foi possível carregar as métricas.')); }
      finally { if (!disposed) timer = setTimeout(poll, 5000); }
    }
    if (recordingId || sessionId) void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [recordingId, sessionId]);
  async function download() {
    setDownloading(true); setError('');
    try {
      const params = { ...(from ? { from: new Date(from).toISOString() } : {}), ...(to ? { to: new Date(to).toISOString() } : {}) };
      const { data: blob } = await api.get(sessionId ? `/quality/sessions/${sessionId}/diagnostic.zip` : `/quality/recordings/${recordingId || data.recordingId}/diagnostic.zip`, { params, responseType: 'blob', timeout: 120000 });
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'diagnostico-transcricao.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Não foi possível gerar o diagnóstico. Confira o intervalo e tente novamente.'); }
    finally { setDownloading(false); }
  }
  const configurations = metadataRecords(data?.configurations);
  const versions = metadataRecords(data?.versions);
  const timeline: any[] = data?.timeline || [];
  const firstAt = timeline.length ? Date.parse(timeline[0].at) : 0;
  const spanMs = timeline.length ? Math.max(1, Date.parse(timeline[timeline.length - 1].at) - firstAt) : 1;
  const points = timeline.map(p => ({ x: timeline.length === 1 ? 300 : (Date.parse(p.at) - firstAt) / spanMs * 600, y: p[metric], at: p.at })).filter(p => p.y != null);
  const max = Math.max(1, ...points.map(p => p.y));
  const plot = points.map(p => `${p.x},${100 - p.y / max * 90}`).join(' ');
  return <section data-recording-id={data?.recordingId || recordingId || ''} className="space-y-5 rounded-[28px] border border-emerald-400/20 bg-[#0c1223] p-6 text-white">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Qualidade e desempenho</h2><Link to="/benchmarks" className="rounded-xl border border-emerald-300/30 px-4 py-2 text-sm text-emerald-300">Abrir Benchmarks</Link></div>
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    {!data && !finalData && !error && <p className="text-sm text-white/50">Aguardando métricas desta gravação.</p>}
    {finalData && <div className="space-y-3 rounded-xl bg-white/5 p-4 text-sm"><p>Revisão final: {finalData.model || 'modelo registrado na sessão'}</p><p>Reconhecimento: {seconds(finalData.inferMs)} · Áudio: {seconds(finalData.audioDurationMs)} · RTF: {finalData.audioDurationMs ? (finalData.inferMs / finalData.audioDurationMs).toFixed(2) : 'indisponível'}</p>{finalData.windows?.length > 0 && <details><summary className="cursor-pointer text-emerald-200">Métricas por janela da revisão final</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Janela</th><th className="p-2">Inferência</th><th className="p-2">Carregamento</th><th className="p-2">RTF</th><th className="p-2">RAM</th><th className="p-2">CPU (núcleos)</th></tr></thead><tbody>{finalData.windows.map((w: any) => <tr key={w.entryId}><td className="p-2">{w.entryId}</td><td className="p-2">{seconds(w.inferMs)}</td><td className="p-2">{w.coldStart ? seconds(w.loadMs) : 'aquecido'}</td><td className="p-2">{w.rtf?.toFixed(2) || '—'}</td><td className="p-2">{w.rssBytes ? `${(w.rssBytes / 1048576).toFixed(0)} MiB` : '—'}</td><td className="p-2">{w.cpuCoresUsed?.toFixed(1) || '—'}</td></tr>)}</tbody></table></div></details>}</div>}
    {finalData && !data && <div className="space-y-3"><p className="text-sm text-white/60">Inclui transcrição final e até dez trechos de áudio disponíveis.</p><button type="button" onClick={download} disabled={downloading} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm disabled:opacity-50">{downloading ? 'Gerando...' : 'Baixar diagnóstico (inclui falas e áudio)'}</button></div>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['Confirmação p95 (estimada)', seconds(data.latency.confirmation.p95), `${data.latency.confirmation.samples} amostras aquecidas`],
          ['Primeira prévia p50 / p95', `${seconds(data.latency.preview.median)} / ${seconds(data.latency.preview.p95)}`, `${data.latency.preview.samples} amostras`],
          ['Fila atual', `${data.counts.pending} trecho(s)`, `Mais antigo: ${seconds(data.processing.oldestPendingMs)}`],
          ['RTF de reconhecimento', data.processing.weightedRtf == null ? 'Indisponível' : data.processing.weightedRtf.toFixed(2), 'Tempo de inferência / áudio único; não garante capacidade para vários falantes'],
          ['Memória ASR observada', data.resources.peakRssBytes ? `${(data.resources.peakRssBytes / 1048576).toFixed(0)} MiB` : 'Indisponível', data.resources.limitBytes ? `Limite: ${(data.resources.limitBytes / 1073741824).toFixed(1)} GiB` : 'Limite indisponível'],
          ['Precisão: erros de palavras (WER)', percent(data.accuracy.wer), `${data.accuracy.referenceSamples} referência(s) humana(s) · CER: ${percent(data.accuracy.cer)}`],
        ].map(([label, value, note]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/60">{label}</p><p className="mt-2 text-xl font-semibold text-emerald-200">{value}</p><p className="mt-2 text-xs text-white/40">{note}</p></div>)}
      </div>
      <p className="text-xs text-white/50">{data.latency.note} Confiança do modelo não é precisão. {data.coldStarts.length} carregamento(s) inicial(is), separados das latências aquecidas.</p>
      {data.profile && <p className="text-xs text-emerald-200">Perfis configurados: ao vivo {data.profile.liveModel} · final {data.profile.finalModel}. A qualidade medida depende das referências humanas.</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70"><span>Falhas: {data.counts.failed}</span><span>Tentativas com falha: {data.counts.failedAttempts}</span><span>Reenvios: {data.counts.uploadRetries || 0}</span><span>Reconexões: {data.counts.reconnects || 0}</span><span>Revisões: {data.counts.revisions}</span><span>Para revisar: {data.counts.reviewRequired}</span><span>Sem texto: {data.counts.unrecognized}</span><span>CPU ASR p95: {data.resources.cpuCoresP95 == null ? 'indisponível' : `${data.resources.cpuCoresP95.toFixed(1)} núcleo(s)`}</span></div>
      <details className="rounded-xl bg-white/5 p-4 text-sm"><summary className="cursor-pointer">Tempos, modelos e versões</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{[['Espera', 'queueWait'], ['Decodificação', 'decode'], ['Reconhecimento', 'inference'], ['Revisão', 'review'], ['Upload', 'upload']].map(([name, key]) => <p key={key}>{name} p50 / p95: {seconds(data.processing[key]?.median)} / {seconds(data.processing[key]?.p95)}</p>)}</div>
        <p className="mt-3 text-xs text-white/60">{configurations.map(c => `${c.model || 'Modelo não informado'} · ${c.device || '?'}/${c.computeType || '?'} · ${c.threads ?? '?'} threads · beam ${c.beamSize ?? '?'}`).join(' | ') || 'Configuração ainda não registrada.'}</p>
        <p className="mt-2 text-xs text-white/40">{data.resources.scope}</p>
        <p className="mt-2 text-xs text-white/40">Versões: {versions.map(v => Object.entries(v).map(([k, value]) => `${k} ${value}`).join(' · ')).join(' | ') || 'indisponíveis'}</p>
        {data.hardware && <p className="mt-2 text-xs text-white/40">Máquina ASR: {data.hardware.processor || data.hardware.architecture} · {data.hardware.cpuCount} processadores lógicos</p>}
        {data.capture && <p className="mt-2 text-xs text-white/40">Captura: {data.capture.sampleRate} Hz · filtro FIR de {data.capture.filterTaps} coeficientes · {data.capture.windowsAnalyzed} janelas analisadas (inclui prévias) · {data.capture.silentWindowsDropped} descartadas por energia baixa · pico observado {data.capture.peak?.toFixed(3)}</p>}
      </details>
      <div className="rounded-2xl bg-black/20 p-4">
        <label className="text-sm text-white/70">Evolução <select aria-label="Métrica do gráfico" value={metric} onChange={e => setMetric(e.target.value)} className="ml-3 rounded-lg bg-[#161c33] p-2">{[['latencyMs', 'Atraso (ms)'], ['queueDepth', 'Trechos na fila'], ['queueWaitMs', 'Espera (ms)'], ['rtf', 'RTF'], ['rssBytes', 'Memória (bytes)'], ['cpuCoresUsed', 'CPU (núcleos)']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {points.length ? <><svg role="img" aria-label="Evolução da métrica selecionada" viewBox="-5 0 610 115" className="mt-4 h-36 w-full"><polyline fill="none" stroke="#34d399" strokeWidth="2" points={plot} />{points.map((p, i) => <circle key={i} cx={p.x} cy={100 - p.y / max * 90} r="3" fill="#6ee7b7"><title>{new Date(p.at).toLocaleTimeString('pt-BR')}: {p.y.toFixed(2)}</title></circle>)}</svg><p className="text-xs text-white/40">Passe sobre os pontos para consultar os valores. Cada ponto agrega uma janela temporal.</p></> : <p className="py-6 text-sm text-white/50">O gráfico aparece quando houver medições.</p>}
      </div>
      <div className="space-y-3"><h3 className="font-semibold">O que pode melhorar</h3>{data.recommendations.length ? data.recommendations.map((r: any) => <div key={r.code} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm"><p className="text-amber-200">{r.message}</p><p className="mt-1 text-white/70">{r.suggestion}</p><p className="mt-2 text-xs text-white/40">Evidências: {JSON.stringify(r.evidence)}</p></div>) : <p className="text-sm text-white/60">Nenhum alerta pelas métricas disponíveis. Isso não comprova que o texto esteja correto.</p>}</div>
      <div className="space-y-3 border-t border-white/10 pt-5"><h3 className="font-semibold">Relatório para diagnóstico</h3><p className="text-sm text-white/60">Inclui métricas, transcrições e até dez áudios problemáticos. Participantes recebem códigos; o conteúdo das conversas permanece no arquivo.</p>
        <div className="flex flex-wrap gap-3"><label className="text-xs text-white/60">De (opcional)<input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-lg bg-[#161c33] p-2 text-white" /></label><label className="text-xs text-white/60">Até (opcional)<input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-lg bg-[#161c33] p-2 text-white" /></label></div>
        <button type="button" onClick={download} disabled={downloading} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold disabled:opacity-50">{downloading ? 'Gerando diagnóstico...' : 'Baixar diagnóstico (inclui falas e áudio)'}</button>
      </div>
    </>}
  </section>;
}
