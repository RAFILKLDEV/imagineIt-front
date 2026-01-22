import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

type Campaign = { _id: string; nome: string };

type CampaignCtx = {
  campaigns: Campaign[];
  current?: Campaign;
  setCurrentById: (id: string) => void;
  reloadCampaigns: () => Promise<void>;
};

const Ctx = createContext<CampaignCtx | null>(null);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [current, setCurrent] = useState<Campaign | undefined>();

  async function reloadCampaigns() {
    const r = await api.get('/campaigns');
    setCampaigns(r.data);
  }

  useEffect(() => {
    reloadCampaigns();
  }, []);

  function setCurrentById(id: string) {
    const c = campaigns.find(c => c._id === id);
    if (c) setCurrent(c);
  }

  return (
    <Ctx.Provider value={{ campaigns, current, setCurrentById, reloadCampaigns }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCampaign must be used inside CampaignProvider');
  return ctx;
}
