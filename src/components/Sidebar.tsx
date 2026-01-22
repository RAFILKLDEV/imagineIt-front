import { Link } from "react-router-dom";
import { useCampaign } from "../context/CampaignContext";
import { useEffect, useState } from "react";
import { api } from "../services/api";

type Character = {
  _id: string;
  nome: string;
  tipo: string; // jogador | antagonista | npc | etc
};

export default function Sidebar() {
  const { current } = useCampaign();
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    if (!current) {
      setCharacters([]);
      return;
    }

    api
      .get(`/characters?campaign=${current._id}`)
      .then(res => setCharacters(res.data));
  }, [current]);

  const grouped = characters.reduce<Record<string, Character[]>>(
    (acc, char) => {
      acc[char.tipo] = acc[char.tipo] || [];
      acc[char.tipo].push(char);
      return acc;
    },
    {}
  );

  return (
    <aside className="w-64 bg-zinc-900 text-zinc-100 p-4 overflow-y-auto">
      <nav className="space-y-3 text-sm">
        <Link to="/campaigns" className="block hover:text-violet-400">
          Campanhas
        </Link>

        {current && (
          <div className="ml-2">
            <div className="font-semibold text-violet-400">
              {current.nome}
            </div>

            <div className="ml-4 mt-2 space-y-2">
              <div>
                <Link
                  to="/characters"
                  className="block hover:text-violet-300"
                >
                  📁 Personagens
                </Link>

                <div className="ml-4 mt-1 space-y-1">
                  {Object.entries(grouped).map(([tipo, chars]) => (
                    <div key={tipo}>
                      <div className="text-zinc-400 capitalize">
                        📂 {tipo}
                      </div>

                      <div className="ml-4 space-y-1">
                        {chars.map(c => (
                          <Link
                            key={c._id}
                            to={`/characters/${c._id}`}
                            className="block hover:text-violet-300 truncate"
                          >
                            {c.nome}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}

                  {characters.length === 0 && (
                    <div className="text-zinc-500 text-xs">
                      Nenhum personagem
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
