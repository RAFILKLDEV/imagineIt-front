import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

type Campaign = { _id: string; nome: string };

type CampaignCtx = {
  campaigns: Campaign[];
  current?: Campaign;
  setCurrentById: (id: string) => void;
  reloadCampaigns: () => Promise<Campaign[]>;
};

const STORAGE_KEY = 'rpg:selectedCampaign';
const Ctx = createContext<CampaignCtx | null>(null);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const campaignsRef = useRef<Campaign[]>([]);
  const [current, setCurrent] = useState<Campaign | undefined>();

  async function reloadCampaigns() {
    const r = await api.get<Campaign[]>('/campaigns');
    if (!Array.isArray(r.data)) throw new Error("A API de campanhas retornou dados invalidos. Confira VITE_API_URL.");
    campaignsRef.current = r.data;
    setCampaigns(r.data);
    return r.data;
  }

  useEffect(() => {
    reloadCampaigns().then(data => {
      const storedId =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const selected =
        (storedId && data.find((c: Campaign) => c._id === storedId)) || data[0];
      if (selected) setCurrent(selected);
    });
  }, []);

  useEffect(() => {
    if (!current) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, current._id);
    }
  }, [current]);

  function setCurrentById(id: string) {
    const c = campaignsRef.current.find(c => c._id === id);
    if (c) {
      setCurrent(c);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, c._id);
      }
    }
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
