import { useEffect, useMemo, useState } from "react";

type Config = {
  model: string; device: string; compute_type: string; language: string;
  beam_size: number; partial_interval_ms: number; silence_ms: number;
  min_speech_ms: number; rms_threshold: number; max_phrase_seconds: number;
};
type Transcript = { type: "transcript"; sessionId: string; userId: string; speaker: string; turnId: string; startMs: number; endMs: number; text: string; final: boolean };
const HOST = (import.meta.env.VITE_LIVE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const wsUrl = HOST.replace(/^http/, "ws") + "/ws/view";
const defaults: Config = { model:"base", device:"cpu", compute_type:"int8", language:"pt", beam_size:1, partial_interval_ms:2500, silence_ms:800, min_speech_ms:350, rms_threshold:0.008, max_phrase_seconds:15 };

export default function LiveTranscription() {
  const [config, setConfig] = useState<Config>(defaults);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [socketState, setSocketState] = useState("desconectado");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState("");
  useEffect(() => {
    let mounted = true;
    fetch(HOST + "/api/live/settings").then(r => { if (!r.ok) throw Error("Servidor indisponível"); return r.json(); }).then(x => mounted && setConfig(x)).catch(e => mounted && setErrors(e.message));
    const update = () => fetch(HOST + "/api/live/status").then(r => r.json()).then(x => mounted && setStatus(x)).catch(() => mounted && setStatus(null));
    update(); const interval = setInterval(update, 2000);
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout>;
    function connect() {
      if (!mounted) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => mounted && setSocketState("conectado");
      ws.onmessage = ev => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "history") setTranscripts(data.items || []);
          if (data.type === "transcript") setTranscripts(old => {
            const items = old.filter(x => x.turnId !== data.turnId);
            return [...items, data].sort((a,b) => a.startMs - b.startMs).slice(-500);
          });
          if (data.type === "error") setErrors(data.message);
        } catch {}
      };
      ws.onclose = () => {
        if (!mounted) return;
        setSocketState("reconectando");
        reconnect = setTimeout(connect, 1500);
      };
      ws.onerror = () => setSocketState("erro");
    }
    connect();
    return () => { mounted = false; clearInterval(interval); clearTimeout(reconnect); ws?.close(); };
  }, []);
  const sorted = useMemo(() => transcripts.slice().sort((a,b) => a.startMs - b.startMs), [transcripts]);
  async function save() {
    try {
      const res = await fetch(HOST + "/api/live/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(config) });
      if (!res.ok) throw Error(await res.text());
      setConfig(await res.json());
      setMessage("Configurações salvas. Alterações de modelo valem na próxima inferência.");
      setErrors("");
    } catch(e:any) { setErrors(e.message); }
  }
  const numberField = (name: keyof Config, label: string, step: number, min: number, max: number) => (
    <label className="flex flex-col gap-1 text-sm">{label}
      <input className="bg-zinc-800 border border-zinc-700 p-2 rounded" type="number" step={step} min={min} max={max}
      value={String(config[name])} onChange={e => setConfig(v => ({...v,[name]:Number(e.target.value)}))}/>
    </label>
  );
  const selectField = (name: keyof Config, label: string, options: string[]) => (
    <label className="flex flex-col gap-1 text-sm">{label}
      <select className="bg-zinc-800 border border-zinc-700 p-2 rounded" value={String(config[name])}
        onChange={e => setConfig(v=>({...v,[name]:e.target.value}))}>{options.map(o=><option key={o}>{o}</option>)}</select>
    </label>
  );
  return <main className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
    <h1 className="text-2xl font-bold">Transcrição ao vivo · Discord</h1>
    <p className="text-sm text-zinc-400">Servidor local: {HOST} · Painel: {socketState} · Bot conectado: {status?.botConnections ?? "—"} · Vozes ativas: {status?.activeSpeakers ?? "—"}</p>
    {errors && <p role="alert" className="text-red-300">{errors}</p>}
    {message && <p className="text-green-300">{message}</p>}
    <section className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
      <h2 className="font-semibold">Configuração do motor</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {selectField("model","Modelo",["tiny","base","small","medium","large-v3-turbo","large-v3"])}
        {selectField("device","Processador",["cpu","cuda","auto"])}
        {selectField("compute_type","Precisão numérica",["int8","float16","float32","auto"])}
        {selectField("language","Idioma",["pt","en","es"])}
        {numberField("beam_size","Beam size",1,1,8)}
        {numberField("partial_interval_ms","Atualização parcial (ms)",100,500,15000)}
        {numberField("silence_ms","Pausa para finalizar (ms)",100,200,5000)}
        {numberField("min_speech_ms","Fala mínima (ms)",50,100,3000)}
        {numberField("rms_threshold","Sensibilidade RMS",0.001,0.001,0.1)}
        {numberField("max_phrase_seconds","Limite de fala (segundos)",1,3,30)}
      </div>
      <button onClick={save} className="bg-amber-500 text-black px-4 py-2 rounded font-semibold">Salvar configurações</button>
    </section>
    <section className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
      <h2 className="font-semibold mb-3">Falas recebidas</h2>
      {sorted.length === 0 && <p className="text-zinc-400">Nenhuma fala recebida. Inicie o bot no Discord e use /start.</p>}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto">
        {sorted.map(t=><div key={t.turnId} className="border-b border-zinc-700 pb-2">
          <div className="text-xs text-zinc-400">{new Date(t.startMs).toLocaleTimeString("pt-BR")} · {t.speaker} · {t.final ? "Definitivo" : "Parcial"}</div>
          <p className={t.final ? "" : "italic text-amber-200"}>{t.text || "(sem fala reconhecida)"}</p>
        </div>)}
      </div>
    </section>
  </main>;
}
