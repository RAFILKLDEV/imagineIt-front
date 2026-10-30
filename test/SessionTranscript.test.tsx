import assert from 'node:assert/strict';
import React from 'react';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionTranscript } from '../src/components/SessionTranscript';

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
