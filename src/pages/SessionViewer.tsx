import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Session } from '../types/transcription';

import { SessionTranscript } from '../components/SessionTranscript';

export default function SessionViewer() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');

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

  return <SessionTranscript session={session} error={error} />;
}
