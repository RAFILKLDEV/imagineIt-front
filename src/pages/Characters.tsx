import { useEffect, useState } from 'react';
import { api, resolveImageUrl } from '../services/api';
import { useCampaign } from '../context/CampaignContext';

type Character = any;

export default function Characters() {
  const { current } = useCampaign();

  const [items, setItems] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Character | null>(null);

  const [form, setForm] = useState({
    nome: '',
    tipo: 'jogador',
    conceito: '',
    historia: '',
    traços: '',
    defeitos: '',
    motivacoes: '',
    vivo: true,
    notasDoMestre: '',
    imagemUrl: ''
  });

  const [imagemFile, setImagemFile] = useState<File | null>(null);

  /* =======================
     LOAD PERSONAGENS
  ======================= */
  useEffect(() => {
    if (!current) return;

    api
      .get('/characters', { params: { campanhaId: current._id } })
      .then(r => setItems(r.data));
  }, [current]);

  /* =======================
     CREATE CHARACTER
  ======================= */
  async function create() {
    if (!current) {
      alert('Selecione uma campanha');
      return;
    }

    if (!form.nome.trim()) {
      alert('Nome obrigatório');
      return;
    }

    const fd = new FormData();
    fd.append('campanhaId', current._id);
    fd.append('nome', form.nome);
    fd.append('tipo', form.tipo);
    fd.append('conceito', form.conceito);
    fd.append('historia', form.historia);
    fd.append('notasDoMestre', form.notasDoMestre);
    fd.append('vivo', String(form.vivo));

    fd.append('personalidade[traços]', form.traços);
    fd.append('personalidade[defeitos]', form.defeitos);
    fd.append('personalidade[motivacoes]', form.motivacoes);

    if (imagemFile) {
      fd.append('imagem', imagemFile);
    } else if (form.imagemUrl.trim()) {
      fd.append('imagemUrl', form.imagemUrl.trim());
    }

    const r = await api.post('/characters', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    setItems([r.data, ...items]);
    setSelected(r.data);

    setForm({
      nome: '',
      tipo: 'jogador',
      conceito: '',
      historia: '',
      traços: '',
      defeitos: '',
      motivacoes: '',
      vivo: true,
      notasDoMestre: '',
      imagemUrl: ''
    });
    setImagemFile(null);
  }

  /* =======================
     GROUP TREE
  ======================= */
  const grouped = {
    jogador: items.filter(c => c.tipo === 'jogador'),
    npc: items.filter(c => c.tipo === 'npc'),
    antagonista: items.filter(c => c.tipo === 'antagonista'),
    secundario: items.filter(c => c.tipo === 'secundario')
  };

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* =====================
          TREE MENU
      ===================== */}
      <aside className="col-span-3 bg-card p-3 overflow-auto">
        <h3 className="font-semibold mb-3">Personagens</h3>

        {Object.entries(grouped).map(([tipo, lista]) =>
          lista.length > 0 ? (
            <div key={tipo} className="mb-4">
              <div className="text-xs uppercase opacity-70 mb-1">
                {tipo}
              </div>

              {lista.map(c => (
                <div
                  key={c._id}
                  onClick={() => setSelected(c)}
                  className={`cursor-pointer p-2 rounded flex gap-2 items-center
                    ${selected?._id === c._id
                      ? 'bg-bg border border-accent'
                      : 'hover:bg-bg'}`}
                >
                  {resolveImageUrl(c.imagem || c.imagemUrl) && (
                    <img
                      src={resolveImageUrl(c.imagem || c.imagemUrl)}
                      alt={c.nome}
                      className="w-10 h-10 object-cover rounded"
                    />
                  )}
                  <span className="text-sm">{c.nome}</span>
                </div>
              ))}
            </div>
          ) : null
        )}
      </aside>

      {/* =====================
          DETAILS
      ===================== */}
      <section className="col-span-5">
        {selected ? (
          <div className="bg-card p-4">
            {resolveImageUrl(selected.imagem || selected.imagemUrl) && (
              <img
                src={resolveImageUrl(selected.imagem || selected.imagemUrl)}
                className="w-40 h-40 object-cover rounded mb-3"
                alt={selected.nome}
              />
            )}

            <h2 className="text-xl font-semibold">{selected.nome}</h2>
            <p className="opacity-70 mb-2">{selected.tipo}</p>

            {selected.conceito && (
              <p><b>Conceito:</b> {selected.conceito}</p>
            )}

            {selected.historia && (
              <p><b>História:</b> {selected.historia}</p>
            )}

            {selected.personalidade && (
              <p className="text-sm mt-2">
                <b>Traços:</b>{' '}
                {selected.personalidade.traços?.join(', ')}
              </p>
            )}

            <p className="mt-2">
              <b>Status:</b>{' '}
              {selected.statusNarrativo?.vivo ? 'Vivo' : 'Morto'}
            </p>

            {selected.notasDoMestre && (
              <p className="mt-2">
                <b>Notas do Mestre:</b> {selected.notasDoMestre}
              </p>
            )}
          </div>
        ) : (
          <p className="opacity-60">Selecione um personagem</p>
        )}
      </section>

      {/* =====================
          FORM
      ===================== */}
      <section className="col-span-4 bg-card p-4">
        <h3 className="font-semibold mb-3">Criar Personagem</h3>

        <input
          className="bg-bg p-2 w-full mb-2"
          placeholder="Nome"
          value={form.nome}
          onChange={e => setForm({ ...form, nome: e.target.value })}
        />

        <select
          className="bg-bg p-2 w-full mb-2"
          value={form.tipo}
          onChange={e => setForm({ ...form, tipo: e.target.value })}
        >
          <option value="jogador">Jogador</option>
          <option value="npc">NPC</option>
          <option value="antagonista">Antagonista</option>
          <option value="secundario">Secundário</option>
        </select>

        <textarea
          className="bg-bg p-2 w-full mb-2"
          placeholder="Conceito"
          value={form.conceito}
          onChange={e => setForm({ ...form, conceito: e.target.value })}
        />

        <textarea
          className="bg-bg p-2 w-full mb-2"
          placeholder="História"
          value={form.historia}
          onChange={e => setForm({ ...form, historia: e.target.value })}
        />

        <input
          className="bg-bg p-2 w-full mb-2"
          placeholder="Traços (vírgula)"
          value={form.traços}
          onChange={e => setForm({ ...form, traços: e.target.value })}
        />

        <input
          className="bg-bg p-2 w-full mb-2"
          placeholder="Defeitos (vírgula)"
          value={form.defeitos}
          onChange={e => setForm({ ...form, defeitos: e.target.value })}
        />

        <input
          className="bg-bg p-2 w-full mb-2"
          placeholder="Motivações (vírgula)"
          value={form.motivacoes}
          onChange={e => setForm({ ...form, motivacoes: e.target.value })}
        />

        <textarea
          className="bg-bg p-2 w-full mb-2"
          placeholder="Notas do Mestre"
          value={form.notasDoMestre}
          onChange={e => setForm({ ...form, notasDoMestre: e.target.value })}
        />

        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={form.vivo}
            onChange={e => setForm({ ...form, vivo: e.target.checked })}
          />
          Personagem vivo
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={e => setImagemFile(e.target.files?.[0] || null)}
        />

        <input
          className="bg-bg p-2 w-full mt-2"
          placeholder="Ou link da imagem"
          value={form.imagemUrl}
          onChange={e => setForm({ ...form, imagemUrl: e.target.value })}
        />

        <button
          onClick={create}
          className="bg-accent text-black px-4 py-2 mt-3 w-full"
        >
          Salvar Personagem
        </button>
      </section>
    </div>
  );
}
