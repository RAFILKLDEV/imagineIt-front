import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useCampaign } from '../context/CampaignContext';

export default function Sessions(){
  const { current } = useCampaign();
  const [items,setItems]=useState<any[]>([]);

  useEffect(()=>{
    if(current) api.get('/sessions/by-campaign/'+current._id).then(r=>setItems(r.data));
  },[current]);

  return (
    <div>
      <h2 className="text-lg font-semibold">Sessões</h2>
      {!current && <p>Selecione uma campanha</p>}
      {items.map(s=>(<div key={s._id} className="bg-card p-2 mt-2">{s.titulo}</div>))}
    </div>
  );
}
