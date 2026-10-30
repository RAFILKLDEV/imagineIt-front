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
  if (!participants.length) return null;
  const selected = participants.filter(item => item.included).length;
  const ready = participants.every(item => item.role !== 'unclassified');
  function update(id: string, patch: Partial<AudioParticipantChoice>) {
    onChange(participants.map(item => item.participantId === id ? { ...item, ...patch } : item));
  }
  return (
    <section aria-label="Configuração dos áudios para transcrição" className="space-y-4 rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4 text-sm text-white">
      <h2 className="text-lg font-semibold">Áudios para transcrição</h2>
      <p className="text-white/70">Classifique quem foi gravado e escolha quais áudios enviar. Todas as partes de cada participante seguem a mesma escolha.</p>
      <button type="button" disabled={disabled} className="text-cyan-200 underline disabled:opacity-50"
        onClick={() => onChange(participants.map(item => ({ ...item, role: 'player', included: true })))}>
        Marcar todos como jogadores
      </button>
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
        <legend className="sr-only">Participantes captados</legend>
        {participants.map(item => (
          <div key={item.participantId} data-participant-id={item.participantId} className="space-y-2 rounded-xl border border-white/10 p-3">
            <p className="break-words font-semibold">{item.label}</p>
            {item.username && item.username !== item.label && <p className="text-xs text-white/60">@{item.username}</p>}
            {item.userId && <p className="text-xs text-white/40">Discord: {item.userId}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-wrap items-center gap-2">
                Categoria
                <select aria-label={`Categoria de ${item.label}`} value={item.role}
                  className="rounded-lg border border-white/20 bg-[#10192b] px-2 py-2 text-white"
                  onChange={event => {
                    const role = event.target.value as AudioParticipantChoice['role'];
                    update(item.participantId, { role, included: role === 'player' });
                  }}>
                  <option value="unclassified">Selecione...</option>
                  <option value="player">Jogador</option>
                  <option value="spectator">Espectador</option>
                  <option value="music_bot">Bot de música</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-cyan-100">
                <input type="checkbox" aria-label={`Incluir ${item.label} na transcrição`} checked={item.included}
                  onChange={event => update(item.participantId, { included: event.target.checked })} />
                Incluir na transcrição
              </label>
            </div>
          </div>
        ))}
      </fieldset>
      <p className="text-white/70">Jogadores entram por padrão ao escolher a categoria. Espectadores e bots de música ficam desmarcados; você pode incluí-los manualmente.</p>
      {participants.length === 1 && !participants[0].userId && <p className="text-amber-200">Este arquivo contém áudio misturado. A seleção inclui ou exclui o arquivo inteiro; não separa vozes ou música dentro dele.</p>}
      <p aria-live="polite" className="font-medium text-cyan-200">{selected} de {participants.length} áudios selecionados.</p>
      {!ready && <p className="text-amber-200">Escolha a categoria de cada áudio antes de enviar.</p>}
      {!selected && <p className="text-amber-200">Selecione pelo menos um áudio para transcrever.</p>}
      <button type="button" onClick={onSave} disabled={disabled || !ready || saved}
        className="rounded-xl border border-cyan-400/40 px-4 py-2 text-cyan-100 disabled:opacity-50">
        {saving ? 'Salvando seleção...' : saved ? 'Seleção salva' : 'Salvar seleção de áudios'}
      </button>
      <p className="text-xs text-white/60">Salvar a seleção não envia áudio ao Groq. Ao clicar em Enviar transcrição, a seleção também é salva antes do envio.</p>
    </section>
  );
}
