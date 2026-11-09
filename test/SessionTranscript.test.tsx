import assert from 'node:assert/strict';
import React from 'react';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildChronologyEntries, SessionTranscript } from '../src/components/SessionTranscript';

test('simulated result explicitly says the text did not come from the audio', () => {
  const html=renderToStaticMarkup(<SessionTranscript session={{transcription:{status:'completed',engineVersion:'simulated-v1',items:[]}}} />);
  assert.ok(html.includes('Resultado de simulacao'));
  assert.ok(html.includes('nao foi extraido do audio'));
});

test('completed transcript renders speaker, text and real timestamps', () => {
  const html=renderToStaticMarkup(<SessionTranscript session={{titulo:'Mesa local',transcription:{status:'completed',items:[{speaker:'Jogador',text:'Abrimos a porta.',startMs:1200,endMs:3400}]}}} />);
  for(const expected of ['Mesa local','completed','Jogador','Abrimos a porta.','0:01','0:03']) assert.ok(html.includes(expected),expected);
});
test('failure message is visible instead of a successful transcript', () => {
  const html=renderToStaticMarkup(<SessionTranscript session={{transcription:{status:'failed',errorMessage:'Audio invalido'}}} />);
  assert.ok(html.includes('role="alert"')); assert.ok(html.includes('Audio invalido')); assert.ok(html.includes('failed'));
});
test('existing segment-based sessions remain readable', () => {
  const html=renderToStaticMarkup(<SessionTranscript session={{transcription:{segments:[{speaker:'Mestre',text:'Sessao antiga',start:5,end:7}]}}} />);
  assert.ok(html.includes('Sessao antiga'));assert.ok(html.includes('0:05'));
});

test('chronology preserves original speech, stable overlap order, and confirmed campaign identity', () => {
  const entries = buildChronologyEntries({
    speakerBindings: [],
    campaignKnowledge: {
      knowledge: { context: {} as any, items: [], discordBindings: [{ userId: '123456', playerName: 'Ana', characterIds: ['char-1'], status: 'confirmed' }] },
      characters: [{ _id: 'char-1', nome: 'Lira', jogador: 'Ana' }],
      scenarios: []
    },
    transcription: { items: [
      { entryId: 'fala-2', userId: '123456', speaker: 'Discord Ana', characterId: 'char-1', rawText: 'fala original', text: 'texto corrigido', startMs: 12500, endMs: 15800 },
      { entryId: 'fala-3', userId: 'unknown', speaker: 'Sem vínculo', text: 'segunda fala', startMs: 12500, endMs: 15800 },
      { entryId: 'fala-1', text: 'primeiro horário', startMs: 1000, endMs: 2000 }
    ] }
  });
  assert.deepEqual(entries.map(item => item.entryId), ['fala-1', 'fala-2', 'fala-3']);
  assert.equal(entries[1].text, 'fala original');
  assert.equal(entries[1].discordUserId, '123456');
  assert.equal(entries[1].playerName, 'Ana');
  assert.equal(entries[1].characterName, 'Lira');
  assert.equal(entries[2].characterId, null);
  assert.equal(entries[2].playerName, null);
  assert.deepEqual(Object.keys(entries[1]), ['entryId', 'startMs', 'endMs', 'discordUserId', 'speakerName', 'playerName', 'characterId', 'characterName', 'text']);
});

test('chronology does not truncate sessions with thousands of transcript entries', () => {
  const items = Array.from({ length: 1_500 }, (_, index) => ({ entryId: `fala-${index}`, text: `fala ${index}`, startMs: index }));
  const entries = buildChronologyEntries({ transcription: { items } });
  assert.equal(entries.length, 1_500);
  assert.equal(entries[1_499].entryId, 'fala-1499');
});

test('a session-level rejected binding overrides inherited campaign character mapping', () => {
  const [entry] = buildChronologyEntries({
    speakerBindings: [{ userId: '123456', role: 'player', status: 'rejected' }],
    campaignKnowledge: {
      knowledge: { context: {} as any, items: [], discordBindings: [{ userId: '123456', playerName: 'Ana', characterIds: ['char-1'], status: 'confirmed' }] },
      characters: [{ _id: 'char-1', nome: 'Lira', jogador: 'Ana' }],
      scenarios: []
    },
    transcription: { items: [{ userId: '123456', speaker: 'Ana', text: 'Não atribuir personagem', startMs: 1 }] }
  });
  assert.equal(entry.characterId, null);
  assert.equal(entry.characterName, null);
});
