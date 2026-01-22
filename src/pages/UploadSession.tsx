import { useState } from 'react';
import { api } from '../services/api';
import { useCampaign } from '../context/CampaignContext';

export default function UploadSession(){
  const { current } = useCampaign();
  const [file,setFile]=useState<File|null>(null);

  async function send(){
    if(!current) return alert('Selecione uma campanha');
    if(!file) return alert('Selecione um arquivo');
    const fd = new FormData();
    fd.append('audio', file);
    fd.append('campanhaId', current._id);
    await api.post('/sessions/upload', fd);
    alert('Enviado');
  }

  return (
    <div className="max-w-xl bg-card p-4">
      <h2 className="text-lg font-semibold mb-2">Enviar Sessão</h2>
      <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      <button onClick={send} className="bg-accent text-black px-3 py-1 mt-2">Enviar</button>
    </div>
  );
}
