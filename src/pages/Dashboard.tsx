import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { api } from '../services/api';
import type { Session } from '../types/transcription';

const steps = [
  { title: 'Sincronize a campanha', command: (id: string) => '/campanha sincronizar token:' + id, description: 'Use o comando no servidor do Discord onde o bot está online.' },
  { title: 'Entre no canal de voz', command: () => '/join', description: 'O bot entrará no canal de voz por meio do comando.' },
  { title: 'Inicie a gravação', command: () => '/record start', description: 'Grave as conversas sem abrir uma videochamada.' },
  { title: 'Encerre e processe', command: () => '/record stop', description: 'Abra Sessões depois de encerrar e escolha quando enviar à transcrição.' }
];
export default function Dashboard() {
  const { current, campaigns } = useCampaign();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guide, setGuide] = useState(false);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let alive = true;
    setSessions([]); setError('');
    if (!current) return;
    setLoading(true);
    api.get<Session[]>('/sessions', { params: { campanhaId: current._id } })
      .then(({ data }) => { if (alive) setSessions(data); })
      .catch(() => { if (alive) setError('Não foi possível consultar as sessões.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [current?._id]);
  const recent = [...sessions].sort((a,b) => Number(b.numero || 0) - Number(a.numero || 0)).slice(0,4);
  async function copy(command: string) {
    try { await navigator.clipboard.writeText(command); setCopied(command); } catch { setCopied(''); }
  }
  return <div className="space-y-7 imagine-page">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="it-eyebrow">Central de campanhas / Imagine it</p><h1 className="it-heading mt-2 text-3xl font-semibold sm:text-4xl">Visão geral</h1><p className="it-muted mt-2 text-sm">{current ? current.nome : 'Selecione uma campanha para começar.'}</p></div>
      {current && <Link className="it-secondary" to={'/campaigns/' + current._id + '/settings'}>Configurações da campanha ↗</Link>}
    </header>
    <section className="it-panel it-glow it-grid-texture relative p-7 sm:p-10">
      <div className="relative z-10 max-w-2xl"><span className="it-status"><span className="it-status-dot"/> Captura e memória de campanhas</span><h2 className="it-heading mt-6 text-3xl font-semibold sm:text-[42px]">Sua próxima aventura começa no <span className="text-[#B1A2FF]">Discord.</span></h2><p className="it-muted mt-4 max-w-xl text-base leading-7">Capture o áudio da sua sessão e transforme as conversas em registros organizados.</p><div className="mt-7 flex flex-wrap gap-3">{current ? <button type="button" className="it-primary" onClick={() => setGuide(!guide)} aria-expanded={guide}>{guide ? 'Ocultar instruções' : 'Preparar gravação'} <span aria-hidden="true">↗</span></button> : <Link className="it-primary" to="/">Selecionar campanha</Link>}<Link className="it-secondary" to="/sessions">Ver sessões</Link></div></div>
    </section>
    {guide && current && <section className="it-panel p-6 sm:p-8"><div className="mb-5"><p className="it-eyebrow">Preparação de áudio</p><h2 className="mt-2 text-xl font-semibold">Iniciar pelo Discord</h2><p className="it-muted mt-2 text-sm">Estes comandos são executados no Discord, não pelo navegador.</p></div><div className="grid gap-3 md:grid-cols-2">{steps.map((step, index) => <div className="it-panel-raised p-5" key={step.title}><p className="text-xs font-semibold text-[#B1A2FF]">ETAPA 0{index + 1}</p><h3 className="mt-2 font-semibold">{step.title}</h3><p className="it-muted mt-2 text-xs leading-5">{step.description}</p><div className="mt-4 flex items-center gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-black/40 px-3 py-3 text-xs text-[#A6DEF0]">{step.command(current._id)}</code><button type="button" className="it-secondary shrink-0" onClick={() => copy(step.command(current._id))} aria-label={'Copiar ' + step.command(current._id)}>{copied === step.command(current._id) ? 'Copiado' : 'Copiar'}</button></div></div>)}</div><div className="mt-5 flex flex-wrap gap-3"><Link className="it-secondary" to="/live">Acompanhar captura</Link><Link className="it-secondary" to="/sessions">Gerenciar transcrições</Link></div></section>}
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <section className="it-panel p-6"><div className="mb-5 flex items-center justify-between gap-4"><div><p className="it-eyebrow">Arquivo de aventuras</p><h2 className="mt-2 text-lg font-semibold">Sessões recentes</h2></div><Link className="text-xs text-[#A999FF] hover:text-white" to="/sessions">Ver todas ↗</Link></div>{loading ? <p role="status" className="it-muted text-sm">Carregando sessões...</p> : error ? <p role="alert" className="text-sm text-red-300">{error}</p> : recent.length ? <div className="space-y-2">{recent.map((session,index) => <Link key={session._id || session.id || index} to={'/sessions/' + (session._id || session.id)} className="flex items-center justify-between gap-4 rounded-xl border border-[#292D38] bg-[#171A22] px-4 py-4 transition hover:border-[#8264FF]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{session.titulo || 'Sessão sem título'}</p><p className="it-muted mt-1 text-xs">Sessão {session.numero || '—'}</p></div><span className="it-status shrink-0">{session.transcription?.status === 'completed' ? 'Transcrita' : 'Em arquivo'}</span></Link>)}</div> : <p className="it-muted rounded-xl border border-dashed border-[#343743] p-6 text-sm">Nenhuma sessão cadastrada nesta campanha.</p>}</section>
      <div className="space-y-5"><section className="it-panel p-6"><p className="it-eyebrow">Seu acervo</p><h2 className="mt-2 text-lg font-semibold">Campanhas</h2><p className="mt-4 text-3xl font-semibold">{campaigns.length}</p><p className="it-muted mt-1 text-xs">Campanhas cadastradas</p><Link to="/" className="mt-5 inline-block text-xs text-[#A999FF]">Gerenciar campanhas ↗</Link></section><section className="it-panel p-6"><p className="it-eyebrow">Referências</p><h2 className="mt-2 text-lg font-semibold">Mundo da campanha</h2><div className="mt-5 flex flex-wrap gap-2"><Link className="it-secondary" to="/characters">Personagens</Link><Link className="it-secondary" to="/scenarios">Cenários</Link></div></section></div>
    </div>
  </div>;
}
