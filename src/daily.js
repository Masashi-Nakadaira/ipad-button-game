import { GAMES } from './gameData.js';

export const HISTORY_KEY = 'button-game-daily-history-v1';
const eligibleIds = GAMES.filter(game => game.id !== 'team').map(game => game.id);

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateSeed(dateKey) {
  let hash = 2166136261;
  for (const char of dateKey) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function dailyGameIds(dateKey = localDateKey()) {
  let seed = dateSeed(dateKey);
  const nextRandom = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const ids = [...eligibleIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 3);
}

function validRecord(record) {
  return record && typeof record.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
    ['slow', 'normal', 'challenge'].includes(record.difficulty) &&
    Array.isArray(record.games) && record.games.length === 3 &&
    record.games.every(game => game && typeof game === 'object' && eligibleIds.includes(game.id) && Number.isInteger(game.score) && game.score >= 0 && game.score <= 100 && Number.isFinite(game.durationMs) && game.durationMs >= 0) &&
    new Set(record.games.map(game => game.id)).size === 3 &&
    Number.isInteger(record.total) && record.total === record.games.reduce((sum, game) => sum + game.score, 0) &&
    Number.isFinite(record.completedAt) && Number.isFinite(record.startedAt) && record.completedAt >= record.startedAt;
}

export function readHistory(storage) {
  try {
    const parsed = JSON.parse((storage ?? globalThis.localStorage).getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(validRecord).slice(-500) : [];
  } catch { return []; }
}

export function appendHistory(record, storage) {
  const records = readHistory(storage);
  if (!validRecord(record) || records.some(item => item.id === record.id)) return { records, saved: false };
  const next = [...records, record].slice(-500);
  try { (storage ?? globalThis.localStorage).setItem(HISTORY_KEY, JSON.stringify(next)); return { records: next, saved: true }; }
  catch { return { records: next, saved: false }; }
}

export function bestByDate(records, difficulty) {
  const best = new Map();
  for (const record of records) {
    if (record.difficulty !== difficulty) continue;
    const current = best.get(record.date);
    if (!current || record.total > current.total || (record.total === current.total && record.completedAt < current.completedAt)) best.set(record.date, record);
  }
  return [...best.values()];
}

export function ranking(records, difficulty) {
  return bestByDate(records, difficulty).sort((a, b) => b.total - a.total || a.completedAt - b.completedAt);
}

export function trend(records, difficulty, limit = 14) {
  return bestByDate(records, difficulty).sort((a, b) => a.date.localeCompare(b.date)).slice(-limit);
}

export function previousRun(records, current) {
  return records.filter(record => record.difficulty === current.difficulty && record.id !== current.id && record.completedAt < current.completedAt).sort((a, b) => b.completedAt - a.completedAt)[0] || null;
}
