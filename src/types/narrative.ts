export type NarrativeReference = {
  sessionId: string;
  entryId: string;
  startMs: number | null;
  endMs: number | null;
  sourceText: string;
};

export type NarrativeFact = {
  text: string;
  references: NarrativeReference[];
  confidence?: number;
  certainty?: string;
};

export type NarrativeSpeakerIdentity = {
  userId: string | null;
  speakerName: string;
  characterId: string | null;
  characterName: string | null;
  speakerRole: 'player' | 'master' | 'spectator' | 'music_bot' | null;
  bindingStatus: 'confirmed' | 'suggested' | 'ambiguous' | 'unbound';
  bindingSource: string;
};

export type NarrativeCandidate = {
  id: string;
  kind: string;
  name?: string;
  aliases?: string[];
  description?: string;
  text?: string;
  status?: string;
  reviewStatus?: string;
  confidence?: number;
  references?: NarrativeReference[];
  canonicalEntityId?: string;
  mentionNames?: string[];
  resolution?: {
    clusterId: string;
    canonicalName: string;
    matchedAlias: string;
    confidence: number;
    method: string;
    targetCandidateId?: string;
    canonicalEntityId?: string;
    decision?: 'accepted' | 'rejected' | 'suggested';
  };
  [key: string]: unknown;
};

export type NarrativeResult = {
  shortSummary?: string | NarrativeFact;
  detailedSummary?: string | NarrativeFact;
  chronicle?: string | NarrativeFact | NarrativeFact[];
  narrativeChronicle?: string;
  narrative?: Record<string, unknown>;
  characters?: NarrativeCandidate[];
  scenarios?: NarrativeCandidate[];
  events?: NarrativeCandidate[];
  relationships?: NarrativeCandidate[];
  uncertainties?: NarrativeCandidate[];
  speakerIdentities?: NarrativeSpeakerIdentity[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd?: number | null;
    inputCacheHitTokens?: number | null;
    inputCacheMissTokens?: number | null;
    reasoningTokens?: number | null;
    costEstimated?: boolean;
    costSource?: 'provider' | 'estimated' | 'unknown';
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type NarrativeRun = {
  _id?: string;
  runId: string;
  sessionId?: string;
  status: string;
  stage?: string;
  currentStage?: string;
  progress?: number;
  createdAt?: string;
  errorCode?: string;
  errorMessage?: string;
  result?: NarrativeResult | null;
  candidates?: NarrativeCandidate[];
  review?: Record<string, unknown>;
  reviewState?: 'pending' | 'in_review' | 'approved' | string;
  resolutionSuggestions?: EntityResolutionSuggestion[];
  usage?: Record<string, unknown>;
  models?: string[];
  [key: string]: unknown;
};

export type OfficialNarrativeEntity = { _id: string; nome: string; entityType: 'character' | 'scenario' };

export type CandidateReview = {
  action: 'approve' | 'reject' | 'edit' | 'link' | 'merge' | 'dismiss_resolution' | 'unmerge';
  value?: Record<string, unknown>;
  entityId?: string;
};

export type EntityResolutionSuggestion = {
  suggestionId: string;
  entityType: 'character' | 'scenario';
  leftCandidateId: string;
  rightCandidateId: string;
  leftName: string;
  rightName: string;
  confidence: number;
  reason: string;
  status: 'suggested' | 'accepted' | 'rejected';
};
