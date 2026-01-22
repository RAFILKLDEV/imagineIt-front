import { useState } from 'react';
import { api } from '../services/api';
import { useCampaign } from '../context/CampaignContext';

export default function Campaigns() {
  const [nome, setNome] = useState('');
  const { campaigns, current, setCurrentById, reloadCampaigns } = useCampaign();

  async function create() {
    if (!nome.trim()) return alert('Nome obrigatório');
    const r = await api.post('/campaigns', { nome });
    await reloadCampaigns();
    setCurrentById(r.data._id);
    setNome('');
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Campanhas</h2>
      <input
        className="bg-card p-2 mr-2"
        value={nome}
        onChange={e => setNome(e.target.value)}
        placeholder="Nome"
      />
      <button onClick={create} className="bg-accent text-black px-3 py-1">
        Criar
      </button>

      <div className="mt-4 space-y-2">
        {campaigns.map(c => (
          <button
            type="button"
            key={c._id}
            onClick={() => setCurrentById(c._id)}
            className={`w-full text-left p-2 bg-card ${
              current?._id === c._id ? 'border border-accent' : ''
            }`}
          >
            {c.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
