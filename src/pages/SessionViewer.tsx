import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Session } from '../types/transcription';

import { SessionTranscript } from '../components/SessionTranscript';
import { QualityPanel } from '../components/QualityPanel';

export default function SessionViewer() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Session | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const { data } = await api.get<Session>(`/sessions/${id}`);
        if (!disposed) { setSession(data); setError(''); }
      } catch { if (!disposed) setError('Nao foi possivel carregar a sessao. Confira a API e tente novamente.'); }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [id]);
  useEffect(() => { setPreview(null); setShowPreview(false); setPreviewError(''); }, [id]);
  async function openPreview() {
    setShowPreview(true);
    try {
      const { data } = await api.get(`/quality/sessions/${id}/preview`);
      setPreview({ ...session, titulo: `${session?.titulo || 'Sessão'} — prévia ao vivo`, transcription: { status: 'completed', sourceMode: 'discord_multitrack',
        items: data.messages.map((m: any) => ({ entryId: m.chunkId, userId: m.userId, speaker: m.speaker, text: m.text || '', rawText: m.rawText, startMs: m.startMs, endMs: m.startMs + m.durationMs, warnings: m.warnings, reviewRequired: m.qualityState === 'review_required' })) } });
      setPreviewError(data.messages.length ? '' : 'Esta sessão não possui prévia ao vivo preservada.');
    } catch { setPreviewError('Não foi possível carregar a prévia ao vivo.'); }
  }

  return <div className="space-y-6">
    <Link to={`/benchmarks/sessions/${id}`} className="inline-block rounded-xl border border-emerald-400/40 px-4 py-3 text-emerald-300">Avaliar transcrição sem reenviar áudio</Link>
    <div className="flex gap-3 text-sm"><button type="button" className={`rounded-xl border px-4 py-2 ${!showPreview ? 'border-emerald-400 text-emerald-300' : 'border-white/20 text-white/60'}`} onClick={() => setShowPreview(false)}>Versão final</button><button type="button" className={`rounded-xl border px-4 py-2 ${showPreview ? 'border-emerald-400 text-emerald-300' : 'border-white/20 text-white/60'}`} onClick={openPreview}>Prévia ao vivo preservada</button></div>{showPreview && <p className="text-xs text-white/50">Mostrando até 500 falas da prévia; a versão final é mantida separadamente.</p>}<SessionTranscript session={showPreview ? preview : session} error={showPreview ? previewError : error} />{id && <QualityPanel sessionId={id} />}</div>;
}
