import { Link } from "react-router-dom";
import { useCampaign } from "../context/CampaignContext";
import { useEffect, useState } from "react";
import { api } from "../services/api";

type Character = {
  _id: string;
  nome: string;
  tipo: string;
};

type Scenario = {
  _id: string;
  nome: string;
  tipo?: string;
  updatedAt?: string;
};

export default function Sidebar() {
  const { current } = useCampaign();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  const loadCharacters = () => {
    if (!current) {
      setCharacters([]);
      return;
    }
    api.get(`/characters?campanhaId=${current._id}`).then(res => setCharacters(res.data));
  };

  const loadScenarios = () => {
    if (!current) {
      setScenarios([]);
      return;
    }
    api.get(`/scenarios?campanhaId=${current._id}`).then(res => setScenarios(res.data));
  };

  useEffect(() => {
    loadCharacters();
    loadScenarios();
  }, [current]);

  useEffect(() => {
    const handler = () => {
      loadCharacters();
      loadScenarios();
    };

    window.addEventListener('charactersUpdated', handler);
    window.addEventListener('scenariosUpdated', handler);
    return () => {
      window.removeEventListener('charactersUpdated', handler);
      window.removeEventListener('scenariosUpdated', handler);
    };
  }, [current]);

  const grouped = characters.reduce<Record<string, Character[]>>((acc, char) => {
    acc[char.tipo] = acc[char.tipo] || [];
    acc[char.tipo].push(char);
    return acc;
  }, {});

  return (
    <aside className="w-64 bg-zinc-900 text-zinc-100 p-4 overflow-y-auto border-r border-black/40">
      <nav className="space-y-4 text-sm">
        <Link to="/" className="block font-semibold text-white hover:text-amber-300">
          Campanhas
        </Link>

        {current && (
          <>
            <div className="text-xs uppercase tracking-[0.4em] text-white/60">Campanha ativa</div>
            <div className="font-semibold text-amber-400 truncate">{current.nome}</div>

            <div className="space-y-2 text-[11px] uppercase tracking-[0.5em] text-white/40">
              <Link to="/characters" className="block hover:text-amber-200">
                Personagens
              </Link>
              <Link to="/sessions" className="block hover:text-amber-200">
                Sessões
              </Link>
              <Link to="/scenarios" className="block hover:text-amber-200">
                Cenários
              </Link>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Personagens</div>
              {Object.entries(grouped).map(([tipo, chars]) => (
                <div key={tipo}>
                  <div className="text-zinc-400 capitalize text-[11px]">• {tipo}</div>
                  <div className="space-y-1 pl-3">
                    {chars.map(c => (
                      <Link
                        key={c._id}
                        to={`/characters/${c._id}`}
                        className="block text-[12px] hover:text-amber-200 truncate"
                      >
                        {c.nome}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {!characters.length && (
                <div className="text-zinc-500 text-xs">Sem personagens</div>
              )}
            </div>

            <div className="border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.4em] text-zinc-500">
              Cenários recentes
            </div>
            <div className="space-y-1 pl-2 text-[12px]">
              {scenarios.slice(0, 5).map(scenario => (
                <Link
                  key={scenario._id}
                  to="/scenarios"
                  className="block hover:text-amber-200 truncate"
                >
                  {scenario.nome}
                </Link>
              ))}
              {!scenarios.length && (
                <div className="text-zinc-500 text-xs">Nenhum cenário</div>
              )}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
