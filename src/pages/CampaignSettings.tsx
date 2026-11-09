import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import { useCampaign } from '../context/CampaignContext';
import { useToast } from '../hooks/useToast';
import { CampaignKnowledgePanel } from '../components/CampaignKnowledgePanel';

type Settings = {
  nome: string;
  descricao: string;
  status: 'ativa' | 'pausada' | 'finalizada';
  sistema: { nome: string; edicao: string };
  mestre: { nome: string; contato: string };
  tags: string[];
  transcriptionVocabulary: string[];
};

function normalize(data: Partial<Settings>): Settings {
  return {
    nome: data.nome || '', descricao: data.descricao || '', status: data.status || 'ativa',
    sistema: { nome: data.sistema?.nome || '', edicao: data.sistema?.edicao || '' },
    mestre: { nome: data.mestre?.nome || '', contato: data.mestre?.contato || '' },
    tags: data.tags || [],
    transcriptionVocabulary: data.transcriptionVocabulary || [],
  };
}

const inputClass = 'mt-2 w-full rounded-2xl border border-white/20 bg-[#0b101f] px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none';
const buttonClass = 'rounded-2xl border border-white/20 px-4 py-3 text-sm text-white transition hover:border-emerald-400 disabled:opacity-50';

export default function CampaignSettings() {
  const { id } = useParams();
  const { current, reloadCampaigns, setCurrentById } = useCampaign();
  const { notify } = useToast();
  const [form, setForm] = useState<Settings | null>(null);
  const [tags, setTags] = useState('');
  const [vocabulary, setVocabulary] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string>();

  useEffect(() => {
    if (id && current?._id !== id) setCurrentById(id);
  }, [id, current?._id, setCurrentById]);

  useEffect(() => {
    let disposed = false;
    setForm(null);
    setError('');
    api.get<Settings>(`/campaigns/${id}`).then(({ data }) => {
      if (disposed) return;
      setForm(normalize(data));
      setTags((data.tags || []).join(', '));
      setVocabulary((data.transcriptionVocabulary || []).join('\n'));
      setLoadedId(id);
    }).catch(err => {
      if (!disposed) setError(getApiErrorMessage(err, 'Não foi possível carregar a campanha.'));
    });
    return () => { disposed = true; };
  }, [id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || !form.nome.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/campaigns/${id}`, {
        ...form, nome: form.nome.trim(),
        tags: [...new Set(tags.split(',').map(tag => tag.trim()).filter(Boolean))],
        transcriptionVocabulary: [...new Set(vocabulary.split(/[\n,]/).map(term => term.trim()).filter(Boolean))].slice(0, 100),
      });
      await reloadCampaigns();
      if (current?._id === id) setCurrentById(id!);
      notify('Configurações salvas', { type: 'success' });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar as configurações.'));
    } finally { setSaving(false); }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify('Copiado para a área de transferência', { type: 'success' });
    } catch { notify('Não foi possível copiar. Selecione e copie o texto manualmente.', { type: 'error' }); }
  }

  const ready = form && loadedId === id;
  return (
    <div className="imagine-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="it-panel it-glow it-grid-texture p-8">
          <Link to="/" className="text-sm text-emerald-300 hover:underline">← Voltar para campanhas</Link>
          <h1 className="mt-5 text-3xl font-semibold text-white">Campanha</h1>
          <p className="mt-2 text-sm text-white/60">{ready ? form.nome : 'Gerencie os dados da campanha e a conexão com o gravador Discord.'}</p>
        </header>
        {error && <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        {!ready && !error && <p role="status" className="text-white/60">Carregando configurações...</p>}
        {ready && <>
          <form onSubmit={save} className="it-panel space-y-6 p-6 sm:p-8">
            <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
              <legend className="mb-5 text-lg font-semibold text-white">Dados da campanha</legend>
              <label className="block text-sm text-white/70">Nome da campanha
                <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className={inputClass} />
              </label>
              <label className="block text-sm text-white/70">Descrição
                <textarea rows={4} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className={inputClass} />
              </label>
              <label className="block text-sm text-white/70">Status
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Settings['status'] })} className={inputClass}>
                  <option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="finalizada">Finalizada</option>
                </select>
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm text-white/70">Sistema de RPG
                  <input value={form.sistema.nome} onChange={e => setForm({ ...form, sistema: { ...form.sistema, nome: e.target.value } })} className={inputClass} placeholder="Ex.: Dungeons & Dragons" />
                </label>
                <label className="block text-sm text-white/70">Edição
                  <input value={form.sistema.edicao} onChange={e => setForm({ ...form, sistema: { ...form.sistema, edicao: e.target.value } })} className={inputClass} placeholder="Ex.: 5ª edição" />
                </label>
                <label className="block text-sm text-white/70">Nome do mestre
                  <input value={form.mestre.nome} onChange={e => setForm({ ...form, mestre: { ...form.mestre, nome: e.target.value } })} className={inputClass} />
                </label>
                <label className="block text-sm text-white/70">Contato do mestre
                  <input value={form.mestre.contato} onChange={e => setForm({ ...form, mestre: { ...form.mestre, contato: e.target.value } })} className={inputClass} />
                </label>
              </div>
              <label className="block text-sm text-white/70">Tags (separadas por vírgula)
                <input value={tags} onChange={e => setTags(e.target.value)} className={inputClass} placeholder="Fantasia, aventura" />
              </label>
              <label className="block text-sm text-white/70">Vocabulário da transcrição
                <textarea rows={5} maxLength={6000} value={vocabulary} onChange={e => setVocabulary(e.target.value)} className={inputClass} placeholder="Um termo por linha: nomes, apelidos, locais, frontend, backend..." />
                <span className="mt-2 block text-xs text-white/40">Até 100 termos. Usados no ao vivo e na revisão final; personagens e cenários cadastrados também são considerados.</span>
              </label>
            </fieldset>
            <button type="submit" disabled={saving || !form.nome.trim()} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </form>
          <CampaignKnowledgePanel campaignId={id!} />
          <section className="it-panel space-y-4 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Gravação no Discord</h2>
            <Link to="/live" onClick={() => setCurrentById(id!)} className="inline-block rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white">Abrir transcrição ao vivo</Link>
            <p className="text-sm text-white/60">Com o bot online, execute este comando no servidor para vincular as próximas gravações a esta campanha.</p>
            <p className="break-all text-sm text-white/70">ID da campanha: <span className="select-all text-white">{id}</span></p>
            <code className="block select-all break-all rounded-2xl bg-black/30 p-4 text-sm text-emerald-300">/campanha sincronizar token:{id}</code>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => copy(id!)} className={buttonClass}>Copiar ID</button>
              <button type="button" onClick={() => copy(`/campanha sincronizar token:${id}`)} className={buttonClass}>Copiar comando do Discord</button>
              {current?._id !== id && <button type="button" onClick={() => { setCurrentById(id!); notify('Campanha selecionada', { type: 'success' }); }} className={buttonClass}>Usar esta campanha no site</button>}
            </div>
            <p className="text-sm text-white/60">Depois, entre no canal de voz e use /join e /record start. Ao terminar, use /record stop e aguarde a transcrição.</p>
          </section>
        </>}
      </div>
    </div>
  );
}
