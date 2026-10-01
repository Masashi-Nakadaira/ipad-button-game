import { MELODY } from './musicData.js';

let context;
let melodyTimer;
let melodyToken = 0;
let speechToken = 0;
let nextNoteTime = 0;
let nextNoteIndex = 0;
let nextBassTime = 0;
let nextBassIndex = 0;
let lastMelodyStart = -1;
const oscillators = new Set();

export function chooseMelodyStart(notes = MELODY.notes, previousStart = -1, rng = Math.random) {
  const phraseStarts = [0, 4, 8, 12, 15, 19, 23, 27].filter(index => index < notes.length);
  const opening = index => Array.from({ length: 6 }, (_, offset) => notes[(index + offset) % notes.length][0]).join(',');
  const previousOpening = previousStart < 0 ? null : opening(previousStart);
  const choices = phraseStarts.filter(index => index !== previousStart && opening(index) !== previousOpening);
  const available = choices.length ? choices : phraseStarts.filter(index => index !== previousStart);
  return available[pickRandom(available.length, rng)];
}

function pickRandom(length, rng) { return Math.min(length - 1, Math.floor(rng() * length)); }

export function unlockAudio() {
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    context.resume();
    return true;
  } catch { return false; }
}

function stopNodes() {
  oscillators.forEach(node => { try { node.stop(); } catch {} });
  oscillators.clear();
}

export function stopAudio() {
  melodyToken++;
  speechToken++;
  clearInterval(melodyTimer);
  melodyTimer = null;
  stopNodes();
  try { window.speechSynthesis?.cancel(); } catch {}
}

function makeTone(frequency, at, duration, volume, type = 'sine') {
  if (!context || context.state !== 'running') return;
  const tone = context.createOscillator();
  const gain = context.createGain();
  tone.type = type;
  tone.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.015);
  gain.gain.setValueAtTime(volume, at + duration - 0.04);
  gain.gain.linearRampToValueAtTime(0.0001, at + duration + 0.045);
  tone.connect(gain).connect(context.destination);
  tone.start(at);
  tone.stop(at + duration + 0.05);
  oscillators.add(tone);
  tone.onended = () => oscillators.delete(tone);
}

export function beep(frequency = 440, duration = 0.15, volume = 0.07) {
  if (!context || context.state !== 'running') return;
  makeTone(frequency, context.currentTime, duration, volume);
}

export function startMelody({ rng = Math.random } = {}) {
  stopAudio();
  if (!unlockAudio()) return false;
  const token = ++melodyToken;
  nextNoteTime = context.currentTime + 0.02;
  nextNoteIndex = chooseMelodyStart(MELODY.notes, lastMelodyStart, rng);
  lastMelodyStart = nextNoteIndex;
  nextBassTime = nextNoteTime;
  nextBassIndex = Math.floor(MELODY.notes.slice(0, nextNoteIndex).reduce((beats, note) => beats + note[1], 0) / 4);
  const scheduleAhead = () => {
    if (token !== melodyToken || !context) return;
    if (context.state !== 'running') {
      nextNoteTime = context.currentTime + 0.02;
      nextBassTime = nextNoteTime;
      return;
    }
    while (nextBassTime < context.currentTime + 0.8) {
      makeTone(nextBassIndex++ % 2 ? 196 : 130.81, nextBassTime, MELODY.beatSeconds * 4, 0.008);
      nextBassTime += MELODY.beatSeconds * 4;
    }
    while (nextNoteTime < context.currentTime + 0.8) {
      const [pitch, beats] = MELODY.notes[nextNoteIndex];
      const seconds = beats * MELODY.beatSeconds;
      makeTone(440 * 2 ** ((pitch - 69) / 12), nextNoteTime, seconds, 0.045, 'triangle');
      nextNoteTime += seconds;
      nextNoteIndex = (nextNoteIndex + 1) % MELODY.notes.length;
    }
  };
  scheduleAhead();
  melodyTimer = setInterval(scheduleAhead, 200);
  return true;
}

export function speak(text, { onEnd, onError, rate = 0.9 } = {}) {
  const token = ++speechToken;
  const fallback = () => queueMicrotask(() => { if (token === speechToken) onError?.(); });
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    fallback();
    return false;
  }
  try {
    // Offline speech must use an installed Japanese voice. Network-backed
    // voices can otherwise stall the ten-second game's starting cue.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const localVoice = offline ? window.speechSynthesis.getVoices?.().find(voice =>
      /^ja(?:-|$)/i.test(voice.lang) && voice.localService === true) : null;
    if (offline && !localVoice) { fallback(); return false; }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = rate;
    if (localVoice) utterance.voice = localVoice;
    utterance.onend = () => { if (token === speechToken) onEnd?.(); };
    utterance.onerror = () => { if (token === speechToken) onError?.(); };
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    fallback();
    return false;
  }
}
