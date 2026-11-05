import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { SessionParticipant, SpeakerBinding, SpeakerBindingCandidate, SpeakerBindingSuggestion, SpeakerRole } from '../types/transcription';

type CharacterOption = { _id: string; nome: string; tipo?: string | null; jogador?: string | null; apelidos?: string[] };
type Props = { sessionId: string; campaignId?: string; onSaved?: (bindings: SpeakerBinding[]) => void };

const roles: Array<[SpeakerRole, string]> = [
  ['player', 'Jogador'],
  ['master', 'Mestre'],
  ['spectator', 'Espectador'],
  ['music_bot', 'Bot/música']
];

function bindingFor(bindings: SpeakerBinding[], userId: string): SpeakerBinding[] {
  return bindings.filter(binding => binding.userId === userId);
}

function replaceUser(bindings: SpeakerBinding[], userId: string, next: SpeakerBinding[]): SpeakerBinding[] {
  return [...bindings.filter(binding => binding.userId !== userId), ...next];
}

function labels(participant: SessionParticipant) {
  return participant.observedNames.length ? participant.observedNames.join(' · ') : participant.userId || 'Participante sem ID Discord';
}

function candidateLabel(candidate: SpeakerBindingCandidate) {
  return `${candidate.characterName}${candidate.player ? ` · ${candidate.player}` : ''}`;
}

export function SpeakerBindingsPanel({ sessionId, onSaved }: Props) {
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [bindings, setBindings] = useState<SpeakerBinding[]>([]);
  const [suggestions, setSuggestions] = useState<SpeakerBindingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/sessions/${encodeURIComponent(sessionId)}/speaker-bindings`);
      setParticipants(Array.isArray(data?.participants) ? data.participants : []);
      setCharacters(Array.isArray(data?.characters) ? data.characters : []);
      setBindings(Array.isArray(data?.bindings) ? data.bindings.map((value: SpeakerBinding) => ({ ...value, characterId: value.characterId ? String(value.characterId) : null })) : []);
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      setError('');
    } catch { setError('Não foi possível carregar os participantes desta sessão.'); }
    finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  const suggestionsByUser = useMemo(() => new Map(suggestions.map(item => [item.userId || '', item])), [suggestions]);

  function setRole(participant: SessionParticipant, role: SpeakerRole) {
    if (!participant.userId) return;
    const current = bindingFor(bindings, participant.userId);
    const next: SpeakerBinding[] = role === 'player'
      ? (current.length && current.every(binding => binding.role === role) ? current.map(binding => ({ ...binding, role, status: 'confirmed' as const })) : [{ userId: participant.userId, role, status: 'confirmed' as const, characterId: null }])
      : [{ userId: participant.userId, role, status: 'confirmed' as const, characterId: null }];
    setBindings(previous => replaceUser(previous, participant.userId!, next));
    setNotice('');
  }

  function toggleCharacter(participant: SessionParticipant, characterId: string) {
    if (!participant.userId) return;
    const role = bindingFor(bindings, participant.userId)[0]?.role || participant.role || 'player';
    if (role !== 'player' && role !== 'master') return;
    const current = bindingFor(bindings, participant.userId).filter(binding => binding.role === role);
    const has = current.some(binding => binding.characterId === characterId);
    const next = has ? current.filter(binding => binding.characterId !== characterId) : [...current, { userId: participant.userId, role, status: 'confirmed' as const, characterId }];
    setBindings(previous => replaceUser(previous, participant.userId!, next.length ? next : [{ userId: participant.userId!, role, status: 'confirmed', characterId: null }]));
    setNotice('');
  }

  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = bindings.filter(binding => binding.userId).map(binding => ({ userId: binding.userId, characterId: binding.characterId || null, role: binding.role, status: binding.status || 'confirmed' }));
      const { data } = await api.put(`/sessions/${encodeURIComponent(sessionId)}/speaker-bindings`, { bindings: payload });
      const saved = Array.isArray(data?.bindings) ? data.bindings : payload;
      setBindings(saved);
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      setNotice('Associações salvas para esta sessão.');
      onSaved?.(saved);
    } catch (err: any) { setError(err?.response?.data?.error || 'Não foi possível salvar as associações.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/[.04] p-4" aria-label="Participantes e personagens">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="it-eyebrow">Identidade da sessão</p><h3 className="mt-1 text-lg font-semibold">Quem está falando?</h3><p className="mt-1 max-w-2xl text-sm text-white/60">O ID do Discord identifica o locutor real. Confirme personagens apenas quando tiver certeza; uma fala nunca é atribuída automaticamente só pelo nome.</p></div><button type="button" className="it-secondary !px-3 !py-2 !text-xs" disabled={busy || loading} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar associações'}</button></div>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{notice}</p>}
    {loading ? <p className="text-sm text-white/50">Carregando participantes…</p> : participants.length ? <div className="space-y-3">{participants.map(participant => {
      const userId = participant.userId || `anonymous:${participant.observedNames.join('|')}`;
      const current = participant.userId ? bindingFor(bindings, participant.userId) : [];
      const role = current[0]?.role || participant.role || 'player';
      const suggestion = participant.userId ? suggestionsByUser.get(participant.userId) : undefined;
      return <article key={userId} className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{labels(participant)}</p><p className="mt-1 font-mono text-[11px] text-white/40">{participant.userId || 'sem discordUserId'}</p></div><select aria-label={`Papel de ${labels(participant)}`} value={role} disabled={!participant.userId} onChange={event => setRole(participant, event.target.value as SpeakerRole)} className="rounded-lg border border-white/15 bg-[#0d1220] px-2 py-1 text-xs text-white">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {!participant.userId && <p className="mt-2 text-xs text-amber-200">Este áudio não possui ID Discord; ele pode continuar na transcrição, mas não recebe vínculo determinístico.</p>}
        {participant.userId && (role === 'player' || role === 'master') && <div className="mt-3 space-y-2"><p className="text-xs text-white/50">{role === 'master' ? 'NPCs interpretados pelo mestre (você pode selecionar mais de um):' : 'Personagens possíveis (você pode selecionar mais de um):'}</p><div className="grid gap-2 sm:grid-cols-2">{characters.filter(character => role === 'master' ? ['npc', 'antagonista', 'secundario'].includes(character.tipo || '') : !['npc', 'antagonista'].includes(character.tipo || '')).map(character => { const checked = current.some(binding => binding.characterId === character._id); return <label key={character._id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-xs ${checked ? 'border-violet-300/70 bg-violet-300/10 text-violet-100' : 'border-white/10 text-white/65'}`}><input type="checkbox" checked={checked} onChange={() => toggleCharacter(participant, character._id)} /><span>{character.nome}</span></label>; })}</div>{!characters.length && <p className="text-xs text-white/45">Nenhum personagem oficial foi cadastrado nesta campanha.</p>}</div>}
        {suggestion && <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/[.06] p-2 text-xs text-amber-100"><p>{suggestion.bindingStatus === 'ambiguous' ? 'Há mais de uma associação possível:' : 'Sugestão baseada no nome do jogador; confirme somente se fizer sentido:'}</p><div className="mt-1 flex flex-wrap gap-2">{suggestion.bindingCandidates.map(candidate => <span key={candidate.characterId} className="rounded bg-black/20 px-2 py-1">{candidateLabel(candidate)}</span>)}</div></div>}
      </article>;
    })}</div> : <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/55">Nenhum participante com metadados foi encontrado ainda. A análise continuará disponível sem vínculos.</p>}
  </section>;
}
