import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useCampaign } from '../context/CampaignContext';

export default function Scenarios(){
  const { current } = useCampaign();
  const [items,setItems]=useState<any[]>([]);
  const [nome,setNome]=useState('');

  useEffect(()=>{
    if(current) api.get('/scenarios?campanhaId='+current._id).then(r=>setItems(r.data));
  },[current]);

  async function create(){
    if(!current) return alert('Selecione uma campanha');
    if(!nome.trim()) return alert('Nome obrigatório');
    const r = await api.post('/scenarios',{ nome, campanhaId: current._id });
    setItems([r.data,...items]); setNome('');
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Cenários</h2>
      <input className="bg-card p-2 mr-2" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome"/>
      <button onClick={create} className="bg-accent text-black px-3 py-1">Criar</button>
      {items.map(c=>(<div key={c._id} className="bg-card p-2 mt-2">{c.nome}</div>))}
    </div>
  );
}
