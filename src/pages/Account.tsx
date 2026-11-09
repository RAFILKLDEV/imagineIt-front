import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => navigate('/login')); }, [navigate]);
  async function logout() { await api.post('/auth/logout'); navigate('/login'); }
  return <section className="mx-auto max-w-2xl space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a99aff]">Conta</p><h1 className="mt-2 text-3xl font-semibold text-white">Perfil e configurações</h1></header><div className="rounded-3xl border border-white/10 bg-[#141420] p-6">{user ? <><div className="grid gap-4 sm:grid-cols-2"><div><div className="text-xs uppercase tracking-[.16em] text-[#858aa0]">Nome</div><div className="mt-1 text-white">{user.displayName}</div></div><div><div className="text-xs uppercase tracking-[.16em] text-[#858aa0]">E-mail</div><div className="mt-1 text-white">{user.email}</div></div><div><div className="text-xs uppercase tracking-[.16em] text-[#858aa0]">Verificação</div><div className="mt-1 text-emerald-300">{user.emailVerified ? 'E-mail verificado' : 'Pendente'}</div></div></div><button type="button" onClick={logout} className="mt-8 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:border-red-300/40 hover:text-red-200">Sair da conta</button>{message && <p className="mt-3 text-sm text-white/55">{message}</p>}</> : <p className="text-sm text-white/55">Carregando…</p>}</div></section>;
}
