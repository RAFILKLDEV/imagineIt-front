import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';

export default function Campaigns() {
  const [nome, setNome] = useState('');
  const navigate = useNavigate();
  const { campaigns, current, setCurrentById, reloadCampaigns } = useCampaign();
  const { notify } = useToast();

  async function create() {
    if (!nome.trim()) {
      notify('Nome obrigatório', { type: 'error' });
      return;
    }
    const r = await api.post('/campaigns', { nome });
    await reloadCampaigns();
    setCurrentById(r.data._id);
    setNome('');
    navigate('/characters');
    notify('Campanha criada', { type: 'success' });
  }

  function handleSelect(id: string) {
    setCurrentById(id);
    navigate('/characters');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#161c33] to-[#050816] p-6 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[36px] bg-[#050916] p-8 shadow-[0_30px_70px_rgba(3,7,18,0.8)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Campanhas
            </div>
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 px-4 py-2 text-xs font-semibold uppercase text-white shadow-lg shadow-emerald-900/30 transition hover:opacity-90"
              onClick={create}
            >
              Criar campanha
            </button>
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Controle suas campanhas</h1>
          <p className="mt-2 text-sm text-white/60">
            Cadastre novos grupos, altere o nome ativo e mantenha o painel de campanhas sincronizado
            com o painel principal.
          </p>
        </section>

        <section className="rounded-[40px] bg-[#0c1223] p-6 shadow-[0_20px_60px_rgba(5,5,20,0.8)]">
          <div className="grid gap-8 lg:grid-cols-[1.5fr,1fr]">
            <div className="space-y-5 rounded-[28px] border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-6 shadow-inner">
              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Nome da campanha
                <input
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                  placeholder="Cadastre um nome marcante"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-6 py-3 text-sm font-semibold uppercase text-white shadow-lg shadow-emerald-900/40 transition hover:opacity-90"
                  onClick={create}
                >
                  Criar campanha
                </button>
                {current && (
                  <span className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Campanha ativa: <span className="text-white">{current.nome}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-white/5 bg-[#0b101f] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Campanhas existentes</p>
              <div className="space-y-2">
                {campaigns.length === 0 && (
                  <p className="text-sm text-white/50">Nenhuma campanha encontrada.</p>
                )}
                {campaigns.map(c => (
                  <div
                    key={c._id}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm text-white transition ${
                      current?._id === c._id
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-white/5 hover:border-white/30'
                    }`}
                    onClick={() => handleSelect(c._id)}
                  >
                    <span>{c.nome}</span>
                    {current?._id === c._id && (
                      <span className="text-xs uppercase tracking-[0.3em] text-emerald-300">Ativa</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
