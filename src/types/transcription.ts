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
  discordNick?: string;
  characterId?: string;
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
  audioChecksum?: string;
}

export interface TranscriptSegment {
  speaker?: string;
  userId?: string;
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
  transcription?: SessionTranscription;
}

export interface TranscriptionJob {
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
