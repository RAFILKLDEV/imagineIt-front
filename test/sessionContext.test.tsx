import assert from 'node:assert/strict';
import React from 'react';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionContextPanel, applySuggestion, parseAliases, parseLocations, parseNpcs } from '../src/components/SessionContextPanel';
import { SpeakerBindingsPanel } from '../src/components/SpeakerBindingsPanel';

test('context question helpers keep small owner notes structured', () => {
  assert.deepEqual(parseAliases('Ed -> Edward Elric\nTorre Azul → Torre Azul'), [
    { mentionedName: 'Ed', canonicalName: 'Edward Elric', entityType: 'other' },
    { mentionedName: 'Torre Azul', canonicalName: 'Torre Azul', entityType: 'other' }
  ]);
  assert.deepEqual(parseNpcs('Guardião — vigia o portão'), [{ name: 'Guardião', description: 'vigia o portão', temporary: true }]);
  assert.deepEqual(parseLocations('A vila — ponto de partida'), [{ name: 'A vila', note: 'ponto de partida', aliases: [] }]);
});

test('accepted AI suggestions merge with manual context without replacing it', () => {
  const draft: any = { previousEvents: 'A vila caiu.', currentSituation: '', conflicts: [], aliases: [], npcNotes: [], locations: [], objectives: ['Encontrar a chave'], gmSecrets: [], additionalNotes: '', aliasesText: '', npcNotesText: '', locationsText: '' };
  const next = applySuggestion(draft, { id: 's-1', field: 'objectives', value: 'Encontrar o rei', sourceText: 'encontrar o rei', confidence: 0.8, candidates: [], status: 'pending' });
  assert.deepEqual(next.objectives, ['Encontrar a chave', 'Encontrar o rei']);
  assert.equal(next.previousEvents, 'A vila caiu.');
});

test('session preparation components render without making context mandatory', () => {
  const contextHtml = renderToStaticMarkup(<SessionContextPanel sessionId="session-1" />);
  const bindingsHtml = renderToStaticMarkup(<SpeakerBindingsPanel sessionId="session-1" />);
  assert.ok(contextHtml.includes('Carregando contexto'));
  assert.ok(bindingsHtml.includes('Carregando participantes'));
});
