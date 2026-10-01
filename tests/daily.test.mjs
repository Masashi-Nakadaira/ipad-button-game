import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../src/gameData.js';
import {
  HISTORY_KEY, appendHistory, bestByDate, dailyGameIds, localDateKey,
  previousRun, ranking, readHistory, trend
} from '../src/daily.js';

const playable = new Set(GAMES.map(game => game.id).filter(id => id !== 'team'));

function record({ id = 'run-1', date = '2026-09-24', difficulty = 'normal',
  scores = [100, 80, 60], completedAt = 2_000 } = {}) {
  return {
    id, date, difficulty, startedAt: completedAt - 1_000, completedAt,
    games: ['ten', 'rps', 'light'].map((gameId, index) => ({
      id: gameId, score: scores[index], durationMs: 100 + index
    })),
    total: scores.reduce((sum, score) => sum + score, 0)
  };
}

function memoryStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[HISTORY_KEY, initial]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    raw: () => values.get(HISTORY_KEY)
  };
}

test('daily draw is fixed for a date, has three unique solo games, and varies across dates', () => {
  const draws = new Set();
  for (let day = 1; day <= 31; day++) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    const ids = dailyGameIds(date);
    assert.deepEqual(dailyGameIds(date), ids);
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    assert.ok(ids.every(id => playable.has(id)));
    draws.add(ids.join(','));
  }
  assert.ok(draws.size > 1);
});

test('date key uses local calendar fields across month and year boundaries', () => {
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
  assert.equal(localDateKey(new Date(2025, 11, 31, 23, 59)), '2025-12-31');
});

test('history persists completed runs and rejects the same id twice', () => {
  const storage = memoryStorage();
  const first = record();
  assert.deepEqual(appendHistory(first, storage), { records: [first], saved: true });
  assert.deepEqual(readHistory(storage), [first]);
  assert.deepEqual(appendHistory({ ...first, total: 0 }, storage), { records: [first], saved: false });
  assert.deepEqual(appendHistory(first, storage), { records: [first], saved: false });
  assert.equal(JSON.parse(storage.raw()).length, 1);
});

test('incomplete and inconsistent runs are never persisted', () => {
  const base = record();
  const invalid = [
    { ...base, id: 'short', games: base.games.slice(0, 2) },
    { ...base, id: 'duplicate-game', games: [base.games[0], base.games[0], base.games[2]] },
    { ...base, id: 'team-game', games: [base.games[0], base.games[1], { ...base.games[2], id: 'team' }] },
    { ...base, id: 'wrong-total', total: 300 },
    { ...base, id: 'out-of-range', games: [{ ...base.games[0], score: 101 }, ...base.games.slice(1)] },
    { ...base, id: 'null-game', games: [null, ...base.games.slice(1)] },
    { ...base, id: 'unfinished-time', completedAt: base.startedAt - 1 }
  ];
  const storage = memoryStorage();
  for (const entry of invalid) assert.equal(appendHistory(entry, storage).saved, false);
  assert.deepEqual(readHistory(storage), []);
  assert.equal(storage.raw(), undefined);
});

test('corrupt JSON and malformed entries do not erase valid history', () => {
  const good = record();
  assert.deepEqual(readHistory(memoryStorage('{broken')), []);
  assert.deepEqual(readHistory(memoryStorage(JSON.stringify({ runs: [good] }))), []);
  const mixed = [good, null, { ...good, id: 'bad', games: [null, ...good.games.slice(1)] }, { ...good, id: 'partial', games: [] }];
  assert.deepEqual(readHistory(memoryStorage(JSON.stringify(mixed))), [good]);
});

test('storage access failures return safely without crashing', () => {
  const getterThrows = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const setterThrows = { getItem() { return null; }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(readHistory(getterThrows), []);
  assert.equal(appendHistory(record(), getterThrows).saved, false);
  assert.equal(appendHistory(record(), setterThrows).saved, false);
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.deepEqual(readHistory(), []);
    assert.equal(appendHistory(record()).saved, false);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'localStorage', prior);
    else delete globalThis.localStorage;
  }
});

test('each difficulty keeps its own daily best and ranks best dates by score', () => {
  const records = [
    record({ id: 'normal-old', date: '2026-09-23', scores: [60, 60, 60], completedAt: 10_000 }),
    record({ id: 'normal-later', date: '2026-09-23', scores: [90, 90, 90], completedAt: 20_000 }),
    record({ id: 'normal-tie-later', date: '2026-09-23', scores: [90, 90, 90], completedAt: 30_000 }),
    record({ id: 'normal-next-day', date: '2026-09-24', scores: [80, 80, 80], completedAt: 40_000 }),
    record({ id: 'slow', date: '2026-09-23', difficulty: 'slow', scores: [100, 100, 100], completedAt: 50_000 })
  ];
  assert.deepEqual(bestByDate(records, 'normal').map(x => x.id), ['normal-later', 'normal-next-day']);
  assert.deepEqual(ranking(records, 'normal').map(x => x.id), ['normal-later', 'normal-next-day']);
  assert.deepEqual(ranking(records, 'slow').map(x => x.id), ['slow']);
  assert.deepEqual(ranking(records, 'challenge'), []);
});

test('ranking resolves equal daily scores by earlier completion and trend follows date order', () => {
  const records = [
    record({ id: 'new', date: '2026-09-25', completedAt: 5_000 }),
    record({ id: 'old', date: '2026-09-23', completedAt: 2_000 }),
    record({ id: 'middle', date: '2026-09-24', completedAt: 3_000 }),
    record({ id: 'slow', date: '2026-09-26', difficulty: 'slow', completedAt: 1_000 })
  ];
  assert.deepEqual(ranking(records, 'normal').map(x => x.id), ['old', 'middle', 'new']);
  assert.deepEqual(trend(records, 'normal', 2).map(x => x.id), ['middle', 'new']);
});

test('previous run uses the latest earlier completion in the same difficulty', () => {
  const old = record({ id: 'old', completedAt: 2_000 });
  const recent = record({ id: 'recent', completedAt: 4_000 });
  const current = record({ id: 'current', completedAt: 6_000 });
  const records = [old, record({ id: 'slow', difficulty: 'slow', completedAt: 5_000 }), current, recent,
    record({ id: 'future', completedAt: 8_000 })];
  assert.equal(previousRun(records, current)?.id, 'recent');
  assert.equal(previousRun(records, old), null);
});
