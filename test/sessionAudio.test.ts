import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionAudioFiles, transcriptionRequest, sessionAudioParticipants, selectedParticipantIds, audioParticipantId } from '../src/services/sessionAudio';

test('a locally recorded session can be submitted without S3 keys', () => {
  const session = { _id: 'session', audioObjects: [
    { storageProvider: 'local' as const, userId: 'speaker', localPath: 'sessions/recording/original/speaker/merged.wav' },
  ] };
  assert.equal(sessionAudioFiles(session).length, 1);
  assert.equal(transcriptionRequest(session).sourceMode, 'discord_multitrack');
  assert.equal(transcriptionRequest(session).idempotencyKey, transcriptionRequest(structuredClone(session)).idempotencyKey);
  const changed = { ...session, audioObjects: [{ ...session.audioObjects[0], localPath: 'another.wav' }] };
  assert.notEqual(transcriptionRequest(changed).idempotencyKey, transcriptionRequest(session).idempotencyKey);
});

test('uploaded audio still works and missing audio cannot be submitted', () => {
  assert.equal(sessionAudioFiles({ audio: { bucket: 'bucket', key: 'audio.wav' } }).length, 1);
  assert.equal(transcriptionRequest({ audio: { key: 'audio.wav' } }).sourceMode, 'mixed_upload');
  assert.equal(sessionAudioFiles({ audio: {} }).length, 0);
  assert.equal(sessionAudioFiles(null).length, 0);
});

test('participant choices group all captured windows, restore categories and change request identity with selection', () => {
  const audioObjects = ['player', 'spectator', 'music'].flatMap(userId => [0, 600000].map(sourceStartMs => ({
    userId, username: userId, discordNick: `Nick ${userId}`, localPath: `${userId}/merged.wav`, sourceStartMs
  })));
  const session = { _id: 'session', audioObjects };
  assert.equal(sessionAudioParticipants(session).length, 3);
  assert.ok(sessionAudioParticipants(session).every(item => item.role === 'unclassified'));
  const configured = { ...session, transcriptionSettings: { selectionSignature: 'saved-signature', participants: [
    { participantId: 'user:player', role: 'player' as const, included: true },
    { participantId: 'user:spectator', role: 'spectator' as const, included: true },
    { participantId: 'user:music', role: 'music_bot' as const, included: false }
  ] } };
  const choices = sessionAudioParticipants(configured);
  assert.deepEqual(selectedParticipantIds(choices), ['user:player', 'user:spectator']);
  assert.equal(choices[2].role, 'music_bot');
  assert.equal(choices[0].label, 'Nick player');
  assert.equal(transcriptionRequest(configured).selectionSignature, 'saved-signature');
  assert.notEqual(transcriptionRequest(configured).idempotencyKey, transcriptionRequest(session).idempotencyKey);
  assert.equal(audioParticipantId({ bucket: 'test', key: 'one.wav' }), 'audio:["test","one.wav"]');
});
