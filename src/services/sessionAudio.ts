import type { ParticipantRole, Session, SessionAudio } from '../types/transcription';

export type AudioParticipantChoice = {
  participantId: string; label: string; username?: string; userId?: string;
  role: ParticipantRole | 'unclassified'; included: boolean;
};

export function audioParticipantId(audio: SessionAudio): string {
  return audio.userId ? `user:${audio.userId}` : `audio:${JSON.stringify([audio.bucket || '',
    audio.key || audio.localPath || audio.relativePath || audio.processedPath || audio.originalPath || audio.audioPath || audio.path || audio.filename || ''])}`;
}

export function sessionAudioParticipants(session: Session | null | undefined): AudioParticipantChoice[] {
  const saved = new Map(session?.transcriptionSettings?.participants.map(item => [item.participantId, item]));
  const metadata = new Map(session?.recorder?.metadata?.participants?.map(item => [item.userId, item]));
  const choices = new Map<string, AudioParticipantChoice>();
  for (const audio of sessionAudioFiles(session)) {
    const participantId = audioParticipantId(audio);
    if (choices.has(participantId)) continue;
    const choice = saved.get(participantId);
    const person = metadata.get(audio.userId);
    choices.set(participantId, {
      participantId, userId: audio.userId, username: audio.username || person?.username,
      label: audio.discordNick || audio.displayName || person?.discordNick || audio.username || person?.username || audio.userId || audio.originalFilename || 'Áudio enviado',
      role: choice?.role || 'unclassified', included: choice?.included ?? true
    });
  }
  return [...choices.values()];
}

export function selectedParticipantIds(choices: AudioParticipantChoice[]): string[] {
  return choices.filter(item => item.included).map(item => item.participantId).sort();
}

export function participantChoicesKey(choices: AudioParticipantChoice[]): string {
  return JSON.stringify(choices.map(({ participantId, role, included }) => ({ participantId, role, included }))
    .sort((a, b) => a.participantId.localeCompare(b.participantId)));
}

export function sessionAudioFiles(session: Session | null | undefined): SessionAudio[] {
  const files = session?.audioObjects?.length ? session.audioObjects : session?.audio ? [session.audio] : [];
  return files.filter(audio => Boolean(audio.key || audio.localPath || audio.relativePath || audio.processedPath || audio.originalPath || audio.audioPath || audio.path || audio.filename));
}

export function transcriptionRequest(session: Session) {
  const files = sessionAudioFiles(session);
  return {
    sourceMode: session.audio?.sourceMode || (files.some(audio => audio.userId) ? 'discord_multitrack' : 'mixed_upload'),
    language: 'pt',
    selectionSignature: session.transcriptionSettings?.selectionSignature,
    idempotencyKey: ['session-transcription', session._id || session.id, ...files.map(audio =>
      [audio.checksum || audio.key || audio.localPath || audio.relativePath || audio.processedPath || audio.originalPath || audio.audioPath || audio.path || audio.filename,
        audio.sourceStartMs ?? '', audio.sourceEndMs ?? ''].join(':')),
      ...(session.transcriptionSettings ? [participantChoicesKey(sessionAudioParticipants(session))] : [])].join(':'),
  };
}
