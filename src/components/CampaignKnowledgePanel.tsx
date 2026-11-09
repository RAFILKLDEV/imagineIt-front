import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiError';
import { useToast } from '../hooks/useToast';
import type { CampaignKnowledge, ContextSuggestion, SessionContextAlias, SessionContextLocation, SessionContextNpc } from '../types/transcription';

type Character = { _id: string; nome: string; apelidos?: string[]; tipo?: string; jogador?: string; conceito?: string; historia?: string; notasDoMestre?: string; relacionamentos?: Array<{ personagemId?: string; tipo?: string; descricao?: string }> };
type Scenario = { _id: string; nome: string; tipo?: string; descricao?: string; historia?: string; notasDoMestre?: string; segredos?: Array<{ titulo?: string; descricao?: string }> };
type Batch = { _id: string; sourceText: string; provider: string; model: string; chunkCount?: number; suggestions: ContextSuggestion[]; unresolvedReferences?: Array<{ text: string; sourceText: string }> };
type Payload = { knowledge: CampaignKnowledge; knowledgeHistory: Array<{ effectiveFromSessionNumber?: number }>; characters: Character[]; scenarios: Scenario[]; suggestions: Batch[]; nextSessionNumber: number };
const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-[#0a0e18] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300';
const buttonClass = 'rounded-xl border border-white/15 px-3 py-2 text-xs text-white/75 transition hover:border-cyan-300 hover:text-white disabled:opacity-50';
const aiInputMaxChars = 2_000_000;
const aiChunkChars = 50_000;
const fieldLabels: Record<ContextSuggestion['field'], string> = {
  previousEvents: 'Acontecimentos anteriores', currentSituation: 'Situação atual', conflicts: 'Conflito', aliases: 'Alias', npcNotes: 'NPC/relacionamento',
  locations: 'Local/região', items: 'Item', objectives: 'Objetivo', gmSecrets: 'Segredo do mestre', additionalNotes: 'Anotação', playerCharacterBinding: 'Vínculo de jogador'
};

function summaryLines(knowledge: CampaignKnowledge) {
  const context = knowledge.context;
  return [
    ['História e acontecimentos', context.previousEvents],
    ['Situação atual', context.currentSituation],
    ['Objetivos', context.objectives.join('\n')],
    ['Conflitos', context.conflicts.join('\n')],
    ['NPCs e relacionamentos', (context.npcNotes as SessionContextNpc[]).map(item => `${item.name}${item.description ? ` — ${item.description}` : ''}`).join('\n')],
    ['Locais e regiões', (context.locations as SessionContextLocation[]).map(item => `${item.name}${item.note ? ` — ${item.note}` : ''}`).join('\n')],
    ['Aliases e glossário', (context.aliases as SessionContextAlias[]).map(item => `${item.mentionedName}${item.canonicalName ? ` → ${item.canonicalName}` : ''}`).join('\n')],
    ['Itens', knowledge.items.join('\n')],
    ['Anotações privadas do mestre', context.gmSecrets.join('\n')],
    ['Outras anotações', context.additionalNotes]
  ].filter(([, value]) => String(value || '').trim());
}

export function CampaignKnowledgePanel({ campaignId }: { campaignId: string }) {
  const { notify } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [bindings, setBindings] = useState<CampaignKnowledge['discordBindings']>([]);
  const [userId, setUserId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [characterIds, setCharacterIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result } = await api.get<Payload>(`/campaigns/${encodeURIComponent(campaignId)}/knowledge`);
      setData(result);
      setBindings(result.knowledge.discordBindings || []);
      setError('');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Não foi possível carregar o conhecimento da campanha.'));
    } finally { setLoading(false); }
  }, [campaignId]);
  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => data ? summaryLines(data.knowledge) : [], [data]);

  async function addFromAI() {
    if (!text.trim() || busy) return;
    const estimatedChunks = Math.ceil(text.length / aiChunkChars);
    if (estimatedChunks > 1 && !window.confirm(`Este texto será analisado em aproximadamente ${estimatedChunks} chamadas sequenciais à IA. O provedor configurado pode cobrar por elas. Deseja continuar?`)) return;
    setBusy(true); setError('');
    try {
      await api.post(`/campaigns/${encodeURIComponent(campaignId)}/knowledge/suggestions`, { text });
      setText('');
      await load();
      notify('Sugestões salvas para revisão; nada foi aplicado automaticamente.', { type: 'success' });
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Não foi possível gerar sugestões para esta campanha.'));
    } finally { setBusy(false); }
  }

  async function review(batchId: string, suggestion: ContextSuggestion, action: 'accept' | 'reject' | 'edit', value?: string) {
    setBusy(true); setError('');
    try {
      await api.patch(`/campaigns/${encodeURIComponent(campaignId)}/knowledge/suggestions/${encodeURIComponent(batchId)}/${encodeURIComponent(suggestion.id)}`, { action, ...(value === undefined ? {} : { value }) });
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Não foi possível atualizar a sugestão.'));
    } finally { setBusy(false); }
  }

  async function addBinding() {
    if (!data || !userId.trim() || !characterIds.length) return;
    const next = [...bindings.filter(item => item.userId !== userId.trim()), { userId: userId.trim(), playerName: playerName.trim(), characterIds, status: 'confirmed' as const }];
    setBusy(true); setError('');
    try {
      await api.put(`/campaigns/${encodeURIComponent(campaignId)}/knowledge/bindings`, { bindings: next });
      setBindings(next); setUserId(''); setPlayerName(''); setCharacterIds([]);
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Não foi possível salvar o vínculo de Discord.'));
    } finally { setBusy(false); }
  }

  async function removeBinding(id: string) {
    const next = bindings.filter(item => item.userId !== id);
    setBusy(true); setError('');
    try {
      await api.put(`/campaigns/${encodeURIComponent(campaignId)}/knowledge/bindings`, { bindings: next });
      setBindings(next);
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Não foi possível remover o vínculo.'));
    } finally { setBusy(false); }
  }

  if (loading) return <section className="it-panel p-6" aria-label="Conhecimento da Campanha"><p className="text-sm text-white/55">Carregando conhecimento da campanha…</p></section>;
  if (!data) return <section className="it-panel p-6" aria-label="Conhecimento da Campanha"><p role="alert" className="text-sm text-red-200">{error}</p></section>;

  return <section className="it-panel space-y-6 p-5 sm:p-7" aria-label="Conhecimento da Campanha">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="it-eyebrow">Memória compartilhada</p><h2 className="it-heading mt-2 text-2xl font-semibold">Conhecimento da Campanha</h2><p className="mt-2 max-w-3xl text-sm text-white/60">A base usada pelas sessões. Sugestões preservam a origem e só entram no conhecimento depois da revisão do mestre.</p></div>
      <nav className="flex flex-wrap gap-2" aria-label="Navegação da campanha">
        <Link to="/sessions" className={buttonClass}>Sessões</Link><Link to="/characters" className={buttonClass}>Personagens</Link><Link to="/scenarios" className={buttonClass}>Cenários</Link>
      </nav>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {[['Personagens e jogadores', data.characters.map(item => `${item.nome}${item.jogador ? ` · ${item.jogador}` : ''}${item.apelidos?.length ? ` · ${item.apelidos.join(', ')}` : ''}${item.conceito ? ` — ${item.conceito}` : ''}${item.historia ? `\n${item.historia}` : ''}${item.notasDoMestre ? `\nNota privada: ${item.notasDoMestre}` : ''}`).join('\n\n')],
        ['NPCs e relacionamentos', data.characters.filter(item => ['npc', 'antagonista', 'secundario'].includes(item.tipo || '')).map(item => `${item.nome}${item.relacionamentos?.length ? ` · ${item.relacionamentos.map(link => link.descricao || link.tipo || link.personagemId).filter(Boolean).join('; ')}` : ''}`).join('\n')],
        ['Cenários, locais e regiões', data.scenarios.map(item => `${item.nome}${item.tipo ? ` · ${item.tipo}` : ''}${item.descricao ? ` — ${item.descricao}` : ''}${item.historia ? `\n${item.historia}` : ''}${item.segredos?.length ? `\nSegredos do mestre: ${item.segredos.map(secret => `${secret.titulo || 'Segredo'} — ${secret.descricao || ''}`).join('; ')}` : ''}${item.notasDoMestre ? `\nNota privada do mestre: ${item.notasDoMestre}` : ''}`).join('\n\n')],
        ['Glossário e itens', [...data.knowledge.items, ...data.knowledge.context.aliases.map(alias => `${alias.mentionedName} → ${alias.canonicalName || alias.entityId || 'pendente'}`)].join('\n')]].map(([title, value]) => <article key={title} className="rounded-xl border border-white/10 bg-black/15 p-4"><h3 className="text-sm font-semibold text-cyan-100">{title}</h3><p className="mt-2 whitespace-pre-line text-sm text-white/65">{value || 'Ainda sem registros.'}</p></article>)}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {summary.length ? summary.map(([title, value]) => <article key={String(title)} className="rounded-xl border border-white/10 bg-black/15 p-4"><h3 className="text-sm font-semibold text-white/80">{title}</h3><p className="mt-2 whitespace-pre-line text-sm text-white/60">{value}</p></article>) : <p className="text-sm text-white/45">Ainda não há contexto narrativo adicional aprovado.</p>}
      {data.knowledge.discordBindings.map(binding => <article key={binding.userId} className="rounded-xl border border-cyan-300/15 bg-cyan-400/[.04] p-4"><h3 className="text-sm font-semibold text-cyan-100">{binding.status === 'confirmed' ? 'Vínculo Discord confirmado' : 'Vínculo Discord pendente'}</h3><p className="mt-2 text-sm text-white/70">{binding.playerName || 'Jogador'} · {binding.userId}</p><p className="text-xs text-white/45">{binding.characterIds.map(id => data.characters.find(character => character._id === id)?.nome || id).join(', ')}</p><button className={`${buttonClass} mt-3`} type="button" disabled={busy} onClick={() => void removeBinding(binding.userId)}>Remover</button></article>)}
    </div>
    <form className="rounded-2xl border border-white/10 bg-black/15 p-4" onSubmit={event => { event.preventDefault(); void addBinding(); }}>
      <h3 className="font-semibold text-white">Jogadores e vínculos Discord</h3><p className="mt-1 text-xs text-white/50">Use o ID estável do Discord e associe apenas personagens confirmados. O vínculo passa a valer a partir da próxima sessão ({data.nextSessionNumber}).</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/60">Discord user ID<input className={inputClass} value={userId} onChange={event => setUserId(event.target.value)} /></label>
        <label className="text-xs text-white/60">Nome do jogador<input className={inputClass} value={playerName} onChange={event => setPlayerName(event.target.value)} /></label>
      </div>
      <label className="mt-3 block text-xs text-white/60">Personagens associados
        <select multiple value={characterIds} onChange={event => setCharacterIds(Array.from(event.target.selectedOptions, option => option.value))} className={`${inputClass} min-h-24`}>
          {data.characters.filter(item => !['npc', 'antagonista'].includes(item.tipo || '')).map(item => <option key={item._id} value={item._id}>{item.nome}{item.jogador ? ` — ${item.jogador}` : ''}</option>)}
        </select>
      </label>
      <button type="submit" className="it-primary mt-3" disabled={busy || !userId.trim() || !characterIds.length}>Salvar vínculo</button>
    </form>
    <section className="rounded-2xl border border-violet-300/20 bg-violet-400/[.04] p-4">
      <h3 className="font-semibold text-violet-100">Adicionar informações com IA</h3><p className="mt-1 text-sm text-white/55">Cole até 2 milhões de caracteres. Textos longos são divididos em partes para análise; cada parte gera uma chamada ao provedor configurado. A IA consulta os registros e aliases existentes, mas não cria nem altera entidades oficiais.</p>
      <textarea aria-label="Anotações da campanha para organizar com IA" maxLength={aiInputMaxChars} rows={8} value={text} onChange={event => setText(event.target.value)} className={`${inputClass} min-h-48`} placeholder="Personagens, fatos, locais, itens, objetivos, conflitos, aliases ou segredos do mestre…" />
      <p className="mt-1 text-right text-xs text-white/40">{text.length.toLocaleString()} / {aiInputMaxChars.toLocaleString()} caracteres{ text.length > aiChunkChars ? ` · aproximadamente ${Math.ceil(text.length / aiChunkChars)} chamadas` : ''}</p>
      <button type="button" className="it-primary mt-3" disabled={busy || !text.trim()} onClick={() => void addFromAI()}>{busy ? 'Processando…' : 'Gerar sugestões'}</button>
    </section>
    {data.suggestions.map(batch => <section key={batch._id} className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
      <header><h3 className="font-semibold text-white">Revisão de sugestões</h3><p className="mt-1 text-xs text-white/45">{batch.provider} · {batch.model} · fonte preservada ({batch.sourceText.length.toLocaleString()} caracteres){batch.chunkCount && batch.chunkCount > 1 ? ` · ${batch.chunkCount} partes analisadas` : ''}</p></header>
      {batch.suggestions.map(suggestion => <article key={suggestion.id} className={`rounded-xl border p-3 ${suggestion.status === 'accepted' ? 'border-emerald-300/25 bg-emerald-400/[.04]' : suggestion.status === 'rejected' ? 'border-white/10 opacity-50' : 'border-amber-300/20 bg-amber-400/[.03]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-wide text-violet-200">{fieldLabels[suggestion.field]} · {Math.round(suggestion.confidence * 100)}% · {suggestion.status === 'pending' ? `aplica desde sessão ${suggestion.effectiveFromSessionNumber || data.nextSessionNumber}` : suggestion.status}</p><p className="mt-1 whitespace-pre-line text-sm text-white">{suggestion.editedValue || suggestion.value}</p>{suggestion.entityName && <p className="mt-1 text-xs text-cyan-200">Destino: {suggestion.entityName}{suggestion.entityId ? ` (${suggestion.entityId})` : ''}</p>}<p className="mt-1 text-xs text-white/45">Trecho de origem: “{suggestion.sourceText}”</p>{suggestion.conflict && <p className="mt-1 text-xs text-amber-200">Revisão obrigatória: {suggestion.conflict}</p>}{suggestion.candidates?.length ? <p className="mt-1 text-xs text-amber-200">Candidatos: {suggestion.candidates.map(item => item.name).join(', ')}</p> : null}</div>
          {suggestion.status === 'pending' && <div className="flex gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => { const value = window.prompt('Edite a sugestão antes de aplicar.', suggestion.editedValue || suggestion.value); if (value?.trim()) void review(batch._id, suggestion, 'edit', value); }}>Editar</button><button type="button" className={`${buttonClass} text-emerald-200`} disabled={busy || Boolean(suggestion.conflict && !suggestion.editedValue)} title={suggestion.conflict && !suggestion.editedValue ? 'Edite para resolver a ambiguidade antes de aceitar' : undefined} onClick={() => void review(batch._id, suggestion, 'accept')}>Aceitar</button><button type="button" className={`${buttonClass} text-red-200`} disabled={busy} onClick={() => void review(batch._id, suggestion, 'reject')}>Rejeitar</button></div>}
        </div>
      </article>)}
      {batch.unresolvedReferences?.length ? <p className="text-xs text-amber-100">{batch.unresolvedReferences.length} referência(s) ambígua(s) aparecem acima como sugestão(ões) pendente(s) de revisão.</p> : null}
      <details className="text-xs text-white/50"><summary className="cursor-pointer">Ver texto-fonte completo</summary><pre className="mt-2 whitespace-pre-wrap">{batch.sourceText}</pre></details>
    </section>)}
  </section>;
}
