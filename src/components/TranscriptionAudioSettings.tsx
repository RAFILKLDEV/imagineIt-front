import type { AudioParticipantChoice } from '../services/sessionAudio';

type Props = {
  participants: AudioParticipantChoice[];
  onChange: (participants: AudioParticipantChoice[]) => void;
  disabled: boolean;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
};

export function TranscriptionAudioSettings({ participants, onChange, disabled, saved, saving, onSave }: Props) {
  if (!participants.length) return <p className="text-sm text-white/50">Nenhum áudio identificado nesta sessão.</p>;
  const selected = participants.filter(item => item.included).length;
  const ready = participants.every(item => item.role !== 'unclassified');
  const update = (id: string, patch: Partial<AudioParticipantChoice>) => onChange(participants.map(item => item.participantId === id ? { ...item, ...patch } : item));
  return <section aria-label="Áudios para transcrição" className="space-y-3 text-sm text-white">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Áudios para transcrição</h3><p className="mt-1 text-xs text-white/50">Marque quem deve entrar no reconhecimento.</p></div><span className="text-xs text-cyan-200">{selected}/{participants.length} selecionados</span></div>
    <button type="button" disabled={disabled} className="text-xs text-cyan-200 underline disabled:opacity-50" onClick={() => onChange(participants.map(item => ({ ...item, role: 'player', included: true })))}>Marcar todos como jogadores</button>
    <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10" role="list">
      {participants.map(item => <div key={item.participantId} data-participant-id={item.participantId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3" role="listitem">
        <div className="min-w-0"><p className="truncate font-medium">{item.label}</p>{item.username && item.username !== item.label && <p className="truncate text-xs text-white/40">@{item.username}</p>}</div>
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-white/60">Categoria<select aria-label={`Categoria de ${item.label}`} value={item.role} disabled={disabled} className="rounded-lg border border-white/20 bg-[#10192b] px-2 py-1.5 text-white" onChange={event => { const role = event.target.value as AudioParticipantChoice['role']; update(item.participantId, { role, included: role === 'player' }); }}><option value="unclassified">Selecione</option><option value="player">Jogador</option><option value="spectator">Espectador</option><option value="music_bot">Bot de música</option></select></label><label className="flex items-center gap-2 text-xs text-cyan-100"><input type="checkbox" aria-label={`Incluir ${item.label} na transcrição`} checked={item.included} disabled={disabled} onChange={event => update(item.participantId, { included: event.target.checked })} />Incluir</label></div>
      </div>)}
    </div>
    {!ready && <p className="text-xs text-amber-200">Escolha uma categoria para cada áudio antes de enviar.</p>}
    {!selected && <p className="text-xs text-amber-200">Selecione pelo menos um áudio.</p>}
    <button type="button" onClick={onSave} disabled={disabled || !ready || saved} className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50">{saving ? 'Salvando…' : saved ? 'Seleção salva' : 'Salvar seleção'}</button>
  </section>;
}
