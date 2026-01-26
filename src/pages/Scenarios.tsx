import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, resolveImageUrl } from '../services/api';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';

type ScenarioImage = { url: string; type?: string; descricao?: string; grid?: boolean };

type Scenario = {
  _id: string;
  campanhaId: string;
  nome: string;
  tipo?: string;
  descricao?: string;
  historia?: string;
  ambiente?: { clima?: string; iluminacao?: string; perigo?: string };
  imagens?: ScenarioImage[];
  npcsPresentes?: { personagemId?: string; papel?: string }[];
  notasDoMestre?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Character = { _id: string; nome: string; tipo?: string };

const EMPTY_FORM = {
  nome: '',
  tipo: 'cidade',
  descricao: '',
  historia: '',
  clima: '',
  iluminacao: '',
  perigo: '',
  notasDoMestre: ''
};

const scenarioTypes = [
  { value: 'cidade', label: 'Cidade' },
  { value: 'masmorra', label: 'Masmorra' },
  { value: 'regiao', label: 'Regiao' },
  { value: 'plano', label: 'Plano' },
  { value: 'ponto-interesse', label: 'Ponto de Interesse' }
];

export default function Scenarios() {
  const { current } = useCampaign();
  const { notify } = useToast();

  const [items, setItems] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [npcOptions, setNpcOptions] = useState<Character[]>([]);
  const [npcIds, setNpcIds] = useState<string[]>([]);

  const [images, setImages] = useState<ScenarioImage[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const loadScenarios = useCallback(async () => {
    if (!current) {
      setItems([]);
      return [];
    }
    const r = await api.get('/scenarios', { params: { campanhaId: current._id } });
    const sorted = [...(r.data as Scenario[])].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || '').getTime() - new Date(a.updatedAt || a.createdAt || '').getTime()
    );
    setItems(sorted);
    return sorted;
  }, [current]);

  const loadNpcOptions = useCallback(async () => {
    if (!current) {
      setNpcOptions([]);
      return;
    }
    const r = await api.get('/characters', { params: { campanhaId: current._id } });
    const list = (r.data as Character[]).filter(c => (c.tipo || '').toLowerCase() === 'npc');
    setNpcOptions(list);
  }, [current]);

  useEffect(() => {
    loadScenarios();
    loadNpcOptions();
  }, [loadScenarios, loadNpcOptions]);

  useEffect(() => {
    if (!selected) {
      setForm({ ...EMPTY_FORM });
      setNpcIds([]);
      setImages([]);
      setPendingImageFiles([]);
      return;
    }

    setForm({
      nome: selected.nome ?? '',
      tipo: selected.tipo ?? 'cidade',
      descricao: selected.descricao ?? '',
      historia: selected.historia ?? '',
      clima: selected.ambiente?.clima ?? '',
      iluminacao: selected.ambiente?.iluminacao ?? '',
      perigo: selected.ambiente?.perigo ?? '',
      notasDoMestre: selected.notasDoMestre ?? ''
    });

    setNpcIds(
      (selected.npcsPresentes || [])
        .map(npc => npc.personagemId)
        .filter(Boolean) as string[]
    );

    setImages(selected.imagens || []);
    setPendingImageFiles([]);
  }, [selected]);

  const environmentSummary = useMemo(() => {
    return `${form.tipo} • ${images.length} imagem${images.length === 1 ? '' : 's'}`;
  }, [form.tipo, images.length]);

  const toggleNpc = (id: string) => {
    setNpcIds(prev => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  };

  async function handleSave() {
    if (!current) {
      notify('Selecione uma campanha', { type: 'error' });
      return;
    }

    if (!form.nome.trim()) {
      notify('Nome obrigatorio', { type: 'error' });
      return;
    }

    const payload = {
      campanhaId: current._id,
      nome: form.nome,
      tipo: form.tipo,
      descricao: form.descricao,
      historia: form.historia,
      ambiente: {
        clima: form.clima,
        iluminacao: form.iluminacao,
        perigo: form.perigo
      },
      npcsPresentes: npcIds.map(id => ({ personagemId: id })),
      notasDoMestre: form.notasDoMestre
    };

    try {
      const r = selected
        ? await api.patch(`/scenarios/${selected._id}`, payload)
        : await api.post('/scenarios', payload);

      const saved = r.data as Scenario;
      await loadScenarios();
      await loadNpcOptions();
      setSelected(saved);
      window.dispatchEvent(new Event('scenariosUpdated'));
      notify(selected ? 'Cenario atualizado' : 'Cenario criado', { type: 'success' });
    } catch (error) {
      console.error(error);
      notify('Nao foi possivel salvar o cenario', { type: 'error' });
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm('Excluir o cenario?')) return;

    try {
      await api.delete(`/scenarios/${selected._id}`);
      await loadScenarios();
      setSelected(null);
      window.dispatchEvent(new Event('scenariosUpdated'));
      notify('Cenario removido', { type: 'success' });
    } catch (error) {
      console.error(error);
      notify('Nao foi possivel excluir o cenario', { type: 'error' });
    }
  }

  async function handleUploadImages() {
    if (!current) {
      notify('Selecione uma campanha', { type: 'error' });
      return;
    }
    if (!selected) {
      notify('Salve o cenario antes de enviar imagens', { type: 'error' });
      return;
    }
    if (!pendingImageFiles.length) {
      notify('Selecione ao menos uma imagem', { type: 'error' });
      return;
    }

    setIsUploadingImages(true);
    try {
      let lastScenario: Scenario | null = null;
      for (const file of pendingImageFiles) {
        const fd = new FormData();
        fd.append('file', file);
        const r = await api.post(`/scenarios/${selected._id}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        lastScenario = (r.data?.scenario || null) as Scenario | null;
      }

      if (lastScenario) {
        setSelected(lastScenario);
        setImages(lastScenario.imagens || []);
      }

      setPendingImageFiles([]);
      await loadScenarios();
      window.dispatchEvent(new Event('scenariosUpdated'));
      notify('Imagens enviadas', { type: 'success' });
    } catch (error) {
      console.error(error);
      notify('Nao foi possivel enviar as imagens', { type: 'error' });
    } finally {
      setIsUploadingImages(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#12182c] to-[#03070f] p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[36px] bg-[#050916] p-8 shadow-[0_30px_70px_rgba(3,7,18,0.8)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Cenarios
            </div>
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold uppercase text-white shadow-lg shadow-amber-900/30 transition hover:opacity-90"
              onClick={() => setSelected(null)}
            >
              Novo cenario
            </button>
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Cenario de batalha</h1>
          <p className="mt-2 text-sm text-white/70">
            Cadastre os locais onde a acao acontece e selecione os NPCs presentes.
          </p>
        </section>

        <section className="rounded-[40px] bg-[#0c1223] p-6 shadow-[0_20px_60px_rgba(5,5,20,0.8)]">
          <div className="grid gap-8 lg:grid-cols-[1.8fr,1fr]">
            <div className="space-y-6 rounded-[30px] border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-6 shadow-inner">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Nome
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Nome do cenario"
                    value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Tipo
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-3 py-2 text-base text-white focus:border-amber-500 focus:outline-none"
                    value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}
                  >
                    {scenarioTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Descricao
                <textarea
                  className="mt-2 h-24 w-full rounded-3xl border border-white/15 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-amber-500 focus:outline-none"
                  placeholder="Visao geral do local"
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                />
              </label>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Historia
                <textarea
                  className="mt-2 h-32 w-full rounded-3xl border border-white/15 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-amber-500 focus:outline-none"
                  placeholder="Contexto e acontecimentos"
                  value={form.historia}
                  onChange={e => setForm({ ...form, historia: e.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Clima
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Chuva, neblina..."
                    value={form.clima}
                    onChange={e => setForm({ ...form, clima: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Iluminacao
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Escura, fogo..."
                    value={form.iluminacao}
                    onChange={e => setForm({ ...form, iluminacao: e.target.value })}
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Perigo
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Armadilhas, monstros..."
                    value={form.perigo}
                    onChange={e => setForm({ ...form, perigo: e.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/15 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Imagens (upload)</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  onChange={e => setPendingImageFiles(Array.from(e.target.files || []))}
                />
                <button
                  type="button"
                  disabled={isUploadingImages}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold uppercase text-white shadow-lg shadow-amber-900/30 transition hover:opacity-90 disabled:opacity-50"
                  onClick={handleUploadImages}
                >
                  {isUploadingImages ? 'Enviando...' : 'Enviar imagens'}
                </button>
                {images.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map(img => (
                      <div
                        key={img.url}
                        className="h-24 overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                      >
                        <img
                          src={resolveImageUrl(img.url) || undefined}
                          alt="Imagem do cenario"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40">Sem imagens enviadas.</p>
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-white/15 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">NPCs presentes</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {npcOptions.map(npc => (
                    <label
                      key={npc._id}
                      className={`rounded-2xl border px-3 py-2 text-sm transition ${
                        npcIds.includes(npc._id)
                          ? 'border-amber-400 bg-amber-500/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={npcIds.includes(npc._id)}
                        onChange={() => toggleNpc(npc._id)}
                      />
                      {npc.nome}
                    </label>
                  ))}
                </div>
                {!npcOptions.length && (
                  <p className="text-xs text-white/40">Nenhum NPC cadastrado na campanha.</p>
                )}
              </div>

              <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                Notas do mestre
                <textarea
                  className="mt-2 h-20 w-full rounded-3xl border border-white/15 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-amber-500 focus:outline-none"
                  placeholder="Pistas e ganchos"
                  value={form.notasDoMestre}
                  onChange={e => setForm({ ...form, notasDoMestre: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold uppercase text-white shadow-lg shadow-amber-900/40 transition hover:opacity-90"
                  onClick={handleSave}
                >
                  {selected ? 'Atualizar cenario' : 'Salvar cenario'}
                </button>
                {selected && (
                  <button
                    type="button"
                    className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold uppercase text-white/60 transition hover:text-white"
                    onClick={handleDelete}
                  >
                    Excluir cenario
                  </button>
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">{environmentSummary}</p>
            </div>

            <div className="space-y-6 rounded-[30px] border border-white/5 bg-[#0c1021] p-6">
              <div className="space-y-2 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Cenarios salvos</p>
                <p className="text-sm text-white/60">Selecione um cenario para editar.</p>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {items.map(scenario => (
                  <button
                    key={scenario._id}
                    type="button"
                    className={`flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      selected?._id === scenario._id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    onClick={() => setSelected(scenario)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">{scenario.nome || 'Cenario sem nome'}</p>
                      <span className="text-xs uppercase text-amber-200">{scenario.tipo}</span>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-2">
                      {scenario.descricao || 'Sem descricao breve.'}
                    </p>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                      {new Date(scenario.updatedAt || scenario.createdAt || '').toLocaleDateString()}
                    </p>
                  </button>
                ))}
                {!items.length && (
                  <div className="rounded-2xl border border-white/10 p-4 text-xs text-white/50">
                    Nenhum cenario cadastrado ainda.
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

