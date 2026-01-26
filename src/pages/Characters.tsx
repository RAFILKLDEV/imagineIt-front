import { useCallback, useEffect, useState } from 'react';
import { api, resolveImageUrl } from '../services/api';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

type Character = any;

const EMPTY_FORM = {
  nome: '',
  tipo: 'jogador',
  conceito: '',
  historia: '',
  tracos: '',
  defeitos: '',
  motivacoes: '',
  vivo: true,
  notasDoMestre: '',
  imagemUrl: ''
};

export default function Characters() {
  const { current } = useCampaign();
  const [items, setItems] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [creationMode, setCreationMode] = useState(false);
  const { notify } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const selectedImageUrl = selected ? resolveImageUrl(selected.imagem || selected.imagemUrl) : '';

  const normalizeListValue = (value: unknown) => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'string') return value;
    return '';
  };

  const loadCharacters = useCallback(async () => {
    if (!current) {
      setItems([]);
      return;
    }

    const r = await api.get('/characters', {
      params: { campanhaId: current._id }
    });

    const data = r.data;
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : [];

    setItems(list);
  }, [current]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  useEffect(() => {
    if (id && items.length) {
      const match = items.find(item => item._id === id);
      if (match && (!selected || selected._id !== match._id)) {
        setSelected(match);
        setCreationMode(false);
        return;
      }
    }

    if (!selected) {
      if (!creationMode && items.length) {
        setSelected(items[0]);
      }
      setForm({ ...EMPTY_FORM });
      setImagemFile(null);
      return;
    }

    if (!items.length) {
      setCreationMode(true);
      setSelected(null);
      return;
    }

    const exists = items.find(item => item._id === selected._id);
    if (!exists) {
      setSelected(items[0]);
      return;
    }

    setForm({
      ...EMPTY_FORM,
      nome: selected.nome ?? '',
      tipo: selected.tipo ?? 'jogador',
      conceito: selected.conceito ?? '',
      historia: selected.historia ?? '',
      tracos: normalizeListValue(selected.personalidade?.tracos),
      defeitos: normalizeListValue(selected.personalidade?.defeitos),
      motivacoes: normalizeListValue(selected.personalidade?.motivacoes),
      vivo: selected.statusNarrativo?.vivo ?? true,
      notasDoMestre: selected.notasDoMestre ?? '',
      imagemUrl: ''
    });
    setImagemFile(null);
    if (creationMode) {
      setCreationMode(false);
    }
  }, [selected, items, creationMode, id]);

  async function handleSave() {
  if (!current) {
    notify('Selecione uma campanha', { type: 'error' });
    return;
  }

  if (!form.nome.trim()) {
    notify('Nome obrigatório', { type: 'error' });
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

  fd.append('personalidade[tracos]', form.tracos);
  fd.append('personalidade[defeitos]', form.defeitos);
  fd.append('personalidade[motivacoes]', form.motivacoes);

  if (imagemFile) {
    fd.append('imagem', imagemFile);
  } else if (form.imagemUrl.trim()) {
    fd.append('imagemUrl', form.imagemUrl.trim());
  }

  try {
    let saved: Character;

    if (selected) {
      const r = await api.patch(`/characters/${selected._id}`, fd);
      saved = r.data;
    } else {
      const r = await api.post('/characters', fd);
      saved = r.data;
    }

    await loadCharacters();
    setCreationMode(false);
    setSelected(saved);
    setImagemFile(null);
    setForm({ ...EMPTY_FORM });

    notify(selected ? 'Personagem atualizado' : 'Personagem criado', {
      type: 'success'
    });
  } catch (err) {
    console.error(err);
    notify('Não foi possível salvar o personagem', { type: 'error' });
  }
}


  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm('Deseja remover este personagem permanentemente?')) return;

    await api.delete(`/characters/${selected._id}`);
    await loadCharacters();
    window.dispatchEvent(new Event('charactersUpdated'));
    setCreationMode(false);
    setSelected(null);
    setForm({ ...EMPTY_FORM });
    setImagemFile(null);
    notify('Personagem excluído', { type: 'success' });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#191f3b] to-[#0c122b] p-6 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[36px] bg-[#050916] p-8 shadow-[0_30px_70px_rgba(3,7,18,0.9)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Personagens
            </div>
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-500 px-4 py-2 text-xs font-semibold uppercase text-white shadow-lg shadow-purple-900/30 transition hover:opacity-90"
              onClick={() => {
                setSelected(null);
                setCreationMode(true);
                navigate('/characters');
              }}
            >
              Criar novo
            </button>
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Gerenciar as fichas</h1>
          <p className="mt-2 text-sm text-white/70">
            Atualize e organize os personagens da campanha com uma interface que destaca atributos,
            traços e retrato visual.
          </p>
        </section>

        <section className="rounded-[40px] bg-[#0c1223] p-6 shadow-[0_20px_60px_rgba(5,5,20,0.8)]">
          <div className="grid gap-8 lg:grid-cols-[1.8fr,1fr]">
            <div className="space-y-6 rounded-[30px] border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-6 shadow-inner">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Nome
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                    placeholder="Nome"
                    value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Tipo
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-purple-500 focus:outline-none"
                    value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="jogador">Jogador</option>
                    <option value="npc">NPC</option>
                    <option value="antagonista">Antagonista</option>
                    <option value="secundario">Secundário</option>
                  </select>
                </label>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Conceito
                <textarea
                  className="mt-2 h-24 w-full rounded-3xl border border-white/15 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                  placeholder="Ex: Mercenário com dilemas morais"
                  value={form.conceito}
                  onChange={e => setForm({ ...form, conceito: e.target.value })}
                />
              </label>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                História
                <textarea
                  className="mt-2 h-32 w-full rounded-3xl border border-white/15 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                  placeholder="Conte brevemente a trajetória"
                  value={form.historia}
                  onChange={e => setForm({ ...form, historia: e.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Traços
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                    placeholder="coragem, astúcia"
                    value={form.tracos}
                    onChange={e => setForm({ ...form, tracos: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Defeitos
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                    placeholder="imperfeito, impulsivo"
                    value={form.defeitos}
                    onChange={e => setForm({ ...form, defeitos: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Motivações
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                    placeholder="vingança, redenção"
                    value={form.motivacoes}
                    onChange={e => setForm({ ...form, motivacoes: e.target.value })}
                  />
                </label>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Notas do Mestre
                <textarea
                  className="mt-2 h-20 w-full rounded-3xl border border-white/15 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                  placeholder="Anotações secretas, ganchos futuros"
                  value={form.notasDoMestre}
                  onChange={e => setForm({ ...form, notasDoMestre: e.target.value })}
                />
              </label>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                  <input
                    type="checkbox"
                    checked={form.vivo}
                    onChange={e => setForm({ ...form, vivo: e.target.checked })}
                    className="h-4 w-4 rounded-sm border border-white/20 bg-transparent text-purple-500 focus:ring-0"
                  />
                  Personagem vivo
                </label>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">
                  Status narrativo
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-3 text-sm font-semibold uppercase text-white shadow-lg shadow-purple-900/40 transition hover:opacity-90"
                  onClick={handleSave}
                >
                  {selected ? 'Salvar alterações' : 'Salvar personagem'}
                </button>
              </div>
              {selected && (
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-white/60">
                  <span>Ficha carregada: {selected.nome}</span>
                  <button
                    type="button"
                    className="text-red-400 underline-offset-4 transition hover:text-red-300"
                    onClick={handleDelete}
                  >
                    Excluir personagem
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6 rounded-[30px] border border-white/5 bg-[#0c1021] p-6">
              <div className="space-y-2 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Imagem</p>
                <p className="text-lg font-semibold">{selected ? selected.nome : 'Sem personagem selecionado'}</p>
                <p className="text-sm text-white/50">
                  Faça um upload ou cole a URL direta para atualizar o retrato visual.
                </p>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                  onChange={e => setImagemFile(e.target.files?.[0] || null)}
                />
              </label>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Link direto
                <input
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                  placeholder="https://"
                  value={form.imagemUrl}
                  onChange={e => setForm({ ...form, imagemUrl: e.target.value })}
                />
              </label>

              <div className="h-52 w-full overflow-hidden rounded-2xl border border-white/5 bg-slate-900/60">
                {imagemFile ? (
                  <img
                    src={URL.createObjectURL(imagemFile)}
                    alt="Prévia da imagem"
                    className="h-full w-full object-cover"
                  />
                ) : selectedImageUrl ? (
                  <img
                    src={selectedImageUrl || undefined}
                    alt={selected?.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs uppercase text-white/50">
                    Pré-visualização da imagem
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
