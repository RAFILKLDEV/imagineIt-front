export type TranscriptionJobStatus =
  | 'queued'
  | 'preparing'
  | 'downloading'
  | 'transcribing'
  | 'aligning'
  | 'diarizing'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SourceMode = 'discord_multitrack' | 'mixed_upload';

export interface TranscriptWord {
  word: string;
  text?: string;
  start?: number;
  end?: number;
  score?: number;
  probability?: number;
}

export interface TranscriptItem {
  entryId?: string;
  userId?: string;
  speaker?: string;
  speakerName?: string;
  discordNick?: string;
  characterId?: string;
  characterName?: string | null;
  speakerRole?: SpeakerRole;
  bindingStatus?: SpeakerResolutionStatus;
  bindingSource?: string;
  startMs?: number;
  endMs?: number;
  durationMs?: number;
  rawText?: string;
  alignedText?: string;
  normalizedText?: string;
  text: string;
  status?: string;
  language?: string;
  overlap?: boolean;
  overlapWith?: string[];
  words?: TranscriptWord[];
  confidence?: number;
  warnings?: string[];
  reviewRequired?: boolean;
  audioObjectKey?: string;
  sourceAudioId?: string;
  audioChecksum?: string;
}

export interface TranscriptSegment {
  speaker?: string;
  speakerName?: string;
  userId?: string;
  characterId?: string;
  characterName?: string | null;
  speakerRole?: SpeakerRole;
  bindingStatus?: SpeakerResolutionStatus;
  bindingSource?: string;
  text: string;
  start?: number;
  end?: number;
  overlap?: boolean;
  overlapWith?: string[];
  warnings?: string[];
}

export interface TranscriptLayer {
  status?: string;
  items?: TranscriptItem[];
  fullTranscriptText?: string;
  warnings?: string[];
}

export interface SessionTranscription {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  sourceMode?: SourceMode;
  language?: string;
  engine?: string;
  engineVersion?: string;
  configuration?: Record<string, unknown>;
  items?: TranscriptItem[];
  segments?: TranscriptSegment[];
  rawTranscript?: TranscriptLayer;
  alignedTranscript?: TranscriptLayer;
  mergedTimeline?: TranscriptLayer;
  speakingFeatures?: TranscriptLayer;
  warnings?: string[];
  performance?: Record<string, unknown>;
  completedAt?: string;
}

export interface SessionAudio {
  storageProvider?: 'local' | 's3';
  localPath?: string;
  relativePath?: string;
  processedPath?: string;
  originalPath?: string;
  audioPath?: string;
  path?: string;
  contentType?: string;
  userId?: string;
  discordNick?: string;
  audioMode?: 'entry' | 'continuous_multitrack';
  username?: string;
  displayName?: string;
  sessionStartMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  bucket?: string;
  key?: string;
  filename?: string;
  originalFilename?: string;
  mimetype?: string;
  duration?: number;
  size?: number;
  codec?: string;
  checksum?: string;
  sourceMode?: SourceMode;
}

export type ParticipantRole = 'player' | 'spectator' | 'music_bot';
export interface TranscriptionParticipant {
  participantId: string;
  role: ParticipantRole;
  included: boolean;
}
export interface TranscriptionSettings {
  participants: TranscriptionParticipant[];
  selectionSignature?: string;
  reviewedAt?: string;
}

export type SpeakerRole = 'player' | 'master' | 'spectator' | 'music_bot';
export type SpeakerBindingStatus = 'confirmed' | 'suggested' | 'rejected';
export type SpeakerResolutionStatus = 'confirmed' | 'suggested' | 'ambiguous' | 'unbound';

export interface SpeakerBinding {
  userId: string;
  discordNick?: string | null;
  username?: string | null;
  globalName?: string | null;
  characterId?: string | null;
  role: SpeakerRole;
  status: SpeakerBindingStatus;
  source?: string;
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface SessionParticipant {
  userId: string | null;
  discordNick: string | null;
  username: string | null;
  globalName: string | null;
  observedNames: string[];
  role: SpeakerRole;
  source: 'recorder' | 'transcript' | 'unknown';
}

export interface SpeakerBindingCandidate {
  characterId: string;
  characterName: string;
  characterType?: string | null;
  player?: string | null;
  source: string;
  confidence: number;
}

export interface SpeakerBindingSuggestion {
  userId: string | null;
  speakerName: string;
  speakerRole: SpeakerRole;
  characterId: string | null;
  characterName: string | null;
  bindingStatus: SpeakerResolutionStatus;
  bindingSource: string;
  bindingCandidates: SpeakerBindingCandidate[];
}

export interface SessionContextAlias {
  mentionedName: string;
  entityType: 'character' | 'scenario' | 'npc' | 'other';
  entityId?: string | null;
  canonicalName?: string | null;
  note?: string | null;
}

export interface SessionContextNpc {
  name: string;
  description?: string | null;
  entityId?: string | null;
  temporary?: boolean;
}

export interface SessionContextLocation {
  name: string;
  entityId?: string | null;
  aliases?: string[];
  note?: string | null;
}

export interface SessionNarrativeContext {
  schemaVersion?: '1.0';
  previousEvents: string;
  currentSituation: string;
  conflicts: string[];
  aliases: SessionContextAlias[];
  npcNotes: SessionContextNpc[];
  locations: SessionContextLocation[];
  objectives: string[];
  gmSecrets: string[];
  additionalNotes: string;
  updatedAt?: string;
}

export type ContextSuggestionField = 'previousEvents' | 'currentSituation' | 'conflicts' | 'aliases' | 'npcNotes' | 'locations' | 'objectives' | 'gmSecrets' | 'additionalNotes' | 'playerCharacterBinding';
export interface ContextSuggestionCandidate {
  entityId?: string | null;
  entityType?: string;
  name: string;
}
export interface ContextSuggestion {
  id: string;
  field: ContextSuggestionField;
  value: string;
  sourceText: string;
  confidence: number;
  entityId?: string | null;
  entityType?: string | null;
  entityName?: string | null;
  conflict?: string | null;
  candidates: ContextSuggestionCandidate[];
  status: 'pending' | 'accepted' | 'rejected';
  editedValue?: string;
}

export interface Session {
  _id?: string;
  id?: string;
  ownerId?: string;
  campanhaId?: string;
  titulo?: string;
  numero?: number;
  cenariosVisitados?: string[];
  personagensPresentes?: string[];
  acontecimentosImportantes?: string[];
  versions?: { type?: string; content?: string }[];
  audio?: SessionAudio;
  audioObjects?: SessionAudio[];
  recorder?: { metadata?: { participants?: { userId?: string; discordNick?: string; username?: string; globalName?: string | null }[] } };
  transcriptionSettings?: TranscriptionSettings;
  speakerBindings?: SpeakerBinding[];
  narrativeContext?: SessionNarrativeContext;
  transcription?: SessionTranscription;
}

export interface TranscriptionJob {
  selectionSignature?: string;
  selectedParticipantIds?: string[];
  jobId: string;
  sessionId: string;
  campaignId: string;
  sourceMode: SourceMode;
  status: TranscriptionJobStatus;
  progress: number;
  currentStage: TranscriptionJobStatus;
  attempts: number;
  maxAttempts: number;
  errorCode?: string;
  errorMessage?: string;
  warnings?: string[];
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  heartbeatAt?: string;
  engine?: string;
  engineVersion?: string;
}
