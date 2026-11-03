import assert from 'node:assert/strict';
import React from 'react';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NarrativeResultView } from '../src/components/NarrativeResultView';
import { evidenceLink, requestNarrativeGeneration, runIsActive, transcriptAnchor } from '../src/services/narrativePresentation';

test('narrative evidence links point at the immutable transcript entry', () => {
  assert.equal(transcriptAnchor('entry/1'), 'transcript-entry%2F1');
  assert.equal(evidenceLink({ sessionId: 'session-1', entryId: 'entry-1', startMs: 1200, endMs: 2500, sourceText: 'A porta abriu.' }, 'session-1'), '#transcript-entry-1');
  assert.equal(evidenceLink({ sessionId: 'session-2', entryId: 'entry-1', startMs: null, endMs: null, sourceText: 'Outra sessão.' }, 'session-1'), '/sessions/session-2#transcript-entry-1');
});

test('generation requires explicit consent and active runs are pollable', () => {
  assert.throws(() => requestNarrativeGeneration(false), /Confirme/);
  assert.deepEqual(requestNarrativeGeneration(true), { consent: true });
  assert.equal(runIsActive({ runId: 'r-1', status: 'processing' }), true);
  assert.equal(runIsActive({ runId: 'r-2', status: 'awaiting_review' }), false);
});

test('narrative result renders review candidates and source references', () => {
  const html = renderToStaticMarkup(<NarrativeResultView sessionId="session-1" run={{ runId: 'run-1', status: 'awaiting_review', result: {
    shortSummary: 'O grupo abriu a porta.',
    narrativeChronicle: 'A porta foi aberta.',
    characters: [{ id: 'candidate-1', category: 'character', name: 'Arun', kind: 'unknown', status: 'uncertain', confidence: 0.62, description: 'Uma figura mencionada.', references: [{ sessionId: 'session-1', entryId: 'entry-7', startMs: 1000, endMs: 2500, sourceText: 'Arun abriu a porta.' }] }],
    scenarios: [], events: [], relationships: [], uncertainties: []
  } }} onReview={async () => undefined} />);
  for (const expected of ['Resumo curto', 'O grupo abriu a porta.', 'Arun', 'Aprovar candidato', 'Rejeitar', 'entry-7', 'Arun abriu a porta.']) assert.ok(html.includes(expected), expected);
});

test('narrative result renders conservative duplicate suggestions', () => {
  const html = renderToStaticMarkup(<NarrativeResultView sessionId="session-1" run={{ runId: 'run-2', status: 'awaiting_review', resolutionSuggestions: [{ suggestionId: 's-1', entityType: 'character', leftCandidateId: 'a', rightCandidateId: 'b', leftName: 'Cronk', rightName: 'Kronk', confidence: 0.8, reason: 'nomes parecidos', status: 'suggested' }], result: {
    characters: [{ id: 'a', category: 'character', name: 'Cronk', kind: 'unknown', references: [] }, { id: 'b', category: 'character', name: 'Kronk', kind: 'unknown', references: [] }], scenarios: [], events: [], relationships: [], uncertainties: []
  } }} onReview={async () => undefined} />);
  assert.ok(html.includes('Possiveis duplicatas'));
  assert.ok(html.includes('E a mesma pessoa'));
  assert.ok(html.includes('Sao diferentes'));
});

