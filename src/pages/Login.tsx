import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (register) {
        const response = await api.post('/auth/register', { email: email.trim(), password, displayName: displayName.trim() });
        if (response.data.user?.emailVerified) {
          await login(email.trim(), password);
          navigate('/dashboard', { replace: true });
        } else if (response.data.verificationToken) {
          setMessage(`Conta criada. Token de verificação local: ${response.data.verificationToken}`);
          setRegister(false);
        } else {
          setRegister(false);
          setMessage('Conta criada. Verifique o e-mail antes de entrar.');
        }
      } else {
        await login(email.trim(), password);
        navigate('/dashboard', { replace: true });
      }
    } catch (cause: any) {
      setMessage(String(cause?.response?.data?.error || 'Não foi possível concluir a operação.'));
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
    <form onSubmit={submit} className="w-full rounded-3xl border border-white/10 bg-[#141420] p-8 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a99aff]">Imagine It</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">{register ? 'Criar conta' : 'Entrar'}</h1>
      <p className="mt-2 text-sm text-[#9da3b8]">Acesse sua conta e acompanhe seus créditos.</p>
      {register && <label className="mt-6 block text-sm text-[#c9c7d8]">Nome<input name="name" value={displayName} onChange={event => setDisplayName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" autoComplete="name" /></label>}
      <label className="mt-6 block text-sm text-[#c9c7d8]" htmlFor="email">E-mail<input id="email" name="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" autoComplete="email" /></label>
      <label className="mt-4 block text-sm text-[#c9c7d8]" htmlFor="password">Senha<input id="password" name="password" type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" autoComplete={register ? 'new-password' : 'current-password'} /></label>
      {message && <p role="alert" className="mt-4 rounded-xl bg-[#8f86ff]/10 px-3 py-2 text-sm text-[#d8d5ff]">{message}</p>}
      <button type="submit" disabled={busy} className="mt-6 w-full rounded-xl bg-[#8f86ff] px-4 py-3 font-semibold text-[#141420] disabled:opacity-50">{busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}</button>
      <button type="button" onClick={() => { setRegister(value => !value); setMessage(''); }} className="mt-4 w-full text-sm text-[#aaa4e8]">{register ? 'Já tenho uma conta' : 'Criar uma conta'}</button>
    </form>
  </div>;
}
