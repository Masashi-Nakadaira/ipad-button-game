import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMelodyStart, speak, startMelody, stopAudio } from '../src/audio.js';
import { MELODY } from '../src/musicData.js';

test('melody changes phrase openings, preserves note order through wrap, and cancels scheduled sound', () => {
  const tones = [];
  const audioContext = {
    state: 'running', currentTime: 0, destination: {}, resume() {},
    createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return audioContext.destination; } }),
    createOscillator: () => {
      const tone = { frequency: { value: 0 }, connect() { return { connect() {} }; },
        start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; this.stopCalls = (this.stopCalls || 0) + 1; } };
      tones.push(tone);
      return tone;
    }
  };
  globalThis.window = { AudioContext: class { constructor() { return audioContext; } } };
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let tick;
  globalThis.setInterval = callback => { tick = callback; return 1; };
  globalThis.clearInterval = () => {};
  try {
    const runs = [];
    for (const random of [0, 0, 0.99]) {
      tones.length = 0;
      audioContext.currentTime = 0;
      assert.equal(startMelody({ rng: () => random }), true);
      for (let time = 0.4; time < 6.5; time += 0.4) { audioContext.currentTime = time; tick(); }
      const melody = tones.filter(tone => tone.type === 'triangle');
      runs.push(melody.map(tone => Math.round(69 + 12 * Math.log2(tone.frequency.value / 440))));
      assert.ok(melody.length > 10);
      for (let index = 1; index < melody.length; index++) {
        assert.ok(melody[index].startedAt < melody[index - 1].stoppedAt);
      }
      stopAudio();
      assert.ok(tones.every(tone => tone.stopCalls === 2 && tone.stoppedAt === undefined));
    }
    const starts = [0, 4, 27];
    for (let index = 0; index < runs.length; index++) {
      assert.deepEqual(runs[index].slice(0, 10), Array.from({ length: 10 }, (_, offset) => MELODY.notes[(starts[index] + offset) % MELODY.notes.length][0]));
    }
    assert.notDeepEqual(runs[0].slice(0, 6), runs[1].slice(0, 6));
    assert.notDeepEqual(runs[1].slice(0, 6), runs[2].slice(0, 6));
  } finally {
    stopAudio();
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test('start choice excludes a repeated six-note opening', () => {
  const opening = index => Array.from({ length: 6 }, (_, offset) => MELODY.notes[(index + offset) % MELODY.notes.length][0]);
  for (const previous of [0, 4, 8, 12, 15, 19, 23, 27]) for (const random of [0, 0.5, 0.99]) {
    const next = chooseMelodyStart(MELODY.notes, previous, () => random);
    assert.notEqual(next, previous);
    assert.notDeepEqual(opening(next), opening(previous));
  }
});

test('speech ends once, cancellations do not complete, and unsupported speech falls back', async () => {
  const spoken = [];
  globalThis.window.speechSynthesis = { cancel() {}, speak(utterance) { spoken.push(utterance); } };
  globalThis.window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  let ended = 0, errored = 0;
  assert.equal(speak('合図', { onEnd: () => ended++, onError: () => errored++ }), true);
  spoken[0].onend();
  assert.equal(ended, 1);
  speak('中断', { onEnd: () => ended++, onError: () => errored++ });
  stopAudio();
  spoken[1].onend();
  spoken[1].onerror();
  assert.equal(ended, 1);
  assert.equal(errored, 0);
  delete globalThis.window.SpeechSynthesisUtterance;
  assert.equal(speak('代替', { onError: () => errored++ }), false);
  await Promise.resolve();
  assert.equal(errored, 1);
  speak('中断した代替', { onError: () => errored++ });
  stopAudio();
  await Promise.resolve();
  assert.equal(errored, 1);
});

test('offline speech uses only an installed Japanese voice or immediately falls back', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  const spoken = [];
  const synthesis = { cancel() {}, speak(utterance) { spoken.push(utterance); }, getVoices: () => [] };
  globalThis.window.speechSynthesis = synthesis;
  globalThis.window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  try {
    let fallbacks = 0;
    assert.equal(speak('音声なし', { onError: () => fallbacks++ }), false);
    await Promise.resolve();
    assert.equal(fallbacks, 1);
    assert.equal(spoken.length, 0);
    synthesis.getVoices = () => [{ lang: 'ja-JP', localService: false }, { lang: 'en-US', localService: true }];
    assert.equal(speak('ネット音声のみ', { onError: () => fallbacks++ }), false);
    await Promise.resolve();
    assert.equal(fallbacks, 2);
    assert.equal(spoken.length, 0);
    const local = { lang: 'ja-JP', localService: true };
    synthesis.getVoices = () => [local];
    assert.equal(speak('ローカル日本語', { onError: () => fallbacks++ }), true);
    assert.equal(spoken[0].voice, local);
    spoken[0].onend();
    assert.equal(fallbacks, 2);
  } finally {
    stopAudio();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
