import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISON_KINDS, getMaxScore, getQuizPool, getTotalRounds, makeRedSequence,
  newRound, normalizeGameScore, reactionGrade, redScore, rpsAnswer, rpsResult,
  teamScore, tenGrade } from '../src/gameEngine.js';
import { QUIZ } from '../src/gameData.js';

test('ten seconds and reaction time have bounded, monotone scores', () => {
  assert.deepEqual(tenGrade(10000), { seconds: '10.00', difference: '0.00', points: 100, phrase: 'ぴったり！' });
  assert.equal(tenGrade(9820).seconds, '9.82');
  assert.equal(reactionGrade(0).points, 20);
  assert.equal(reactionGrade(200).points, 20);
  assert.equal(reactionGrade(3600).points, 1);
  assert.equal(reactionGrade(4000).points, 1);
  let previous = 20;
  for (let ms = 0; ms <= 3600; ms += 25) {
    const grade = reactionGrade(ms);
    assert.ok(grade.points <= previous && grade.points >= 1);
    previous = grade.points;
  }
});

test('rock paper scissors handles both directions and a tie', () => {
  for (let opponent = 0; opponent < 3; opponent++) {
    for (const instruction of ['勝って', '負けて', 'あいこで']) {
      const answer = rpsAnswer(opponent, instruction);
      assert.equal(rpsResult(opponent, instruction, answer), true);
      assert.equal(rpsResult(opponent, instruction, (answer + 1) % 3), false);
    }
  }
});

test('team gives reachable center perfect and bounded edge score', () => {
  for (const players of [2, 3, 4]) {
    const center = Array.from({ length: players }, (_, button) => ({ button, position: button % 2 ? 0.48 : 0.52 }));
    assert.equal(teamScore(center, players).points, 100);
    assert.equal(teamScore(center.map(x => ({ ...x, position: 0 })), players).points, 0);
  }
  assert.ok(teamScore([{ position: 0.479 }, { position: 0.521 }], 2).points < 100);
  assert.equal(teamScore([{ position: 0.5 }], 2), null);
});

test('memory grows with difficulty, regenerates, and never repeats adjacent colors', () => {
  for (const [difficulty, firstLength] of [['slow', 1], ['normal', 2], ['challenge', 3]]) {
    let previous;
    for (let index = 0; index < 4; index++) {
      const sequence = newRound('memory', { index, difficulty, previousSequence: previous, rng: () => 0 }).sequence;
      assert.equal(sequence.length, firstLength + index);
      assert.ok(sequence.every((color, i) => Number.isInteger(color) && color >= 0 && color <= 3 && (i === 0 || color !== sequence[i - 1])));
      if (previous) assert.notDeepEqual(sequence.slice(0, previous.length), previous);
      previous = sequence;
    }
  }
});

test('all comparison directions have distinct values and correct answer', () => {
  const directions = { number: ['larger', 'smaller'], length: ['longer', 'shorter'],
    weight: ['heavier', 'lighter'], era: ['older', 'newer'], date: ['earlier', 'later'] };
  for (const kind of COMPARISON_KINDS) for (const direction of directions[kind]) {
    for (const [random, side] of [[0, 0], [0.99, 1]]) {
      const { comparison } = newRound('bigger', { kind, direction, rng: () => random });
      assert.equal(comparison.kind, kind);
      assert.equal(comparison.direction, direction);
      assert.equal(comparison.correctIndex, side);
      assert.ok(comparison.prompt && comparison.explanation);
      const a = comparison.choices[side].magnitude;
      const b = comparison.choices[1 - side].magnitude;
      assert.notEqual(a, b);
      assert.equal(a < b, ['smaller', 'shorter', 'lighter', 'older', 'earlier'].includes(direction));
    }
  }
});

test('comparison uses all five categories and increases work by difficulty', () => {
  const usedKinds = [];
  for (let index = 0; index < 5; index++) {
    const { comparison } = newRound('bigger', { index, usedKinds, rng: () => 0 });
    usedKinds.push(comparison.kind);
  }
  assert.deepEqual(new Set(usedKinds), new Set(COMPARISON_KINDS));
  const slow = newRound('bigger', { kind: 'number', difficulty: 'slow', rng: () => 0 }).comparison;
  assert.ok(slow.choices.every(choice => /[＋－]/.test(choice.label)));
  const normal = newRound('bigger', { kind: 'number', difficulty: 'normal', rng: () => 0 }).comparison;
  assert.ok(normal.choices.some(choice => choice.label.includes('＋')));
  assert.ok(normal.choices.some(choice => choice.label.includes('－')));
  const challenge = newRound('bigger', { kind: 'number', difficulty: 'challenge', rng: () => 0 }).comparison;
  assert.ok(challenge.choices.every(choice => choice.label.includes('＋') && choice.label.includes('－')));
  const bar = newRound('bigger', { kind: 'length', difficulty: 'slow', rng: () => 0 }).comparison;
  assert.ok(bar.choices.every(choice => choice.visual.type === 'bar'));
  assert.ok(Math.abs(bar.choices[0].magnitude - bar.choices[1].magnitude) < 24);
  for (const kind of ['length', 'weight']) {
    const comparison = newRound('bigger', { kind, difficulty: 'normal', rng: () => 0 }).comparison;
    assert.equal(comparison.choices.filter(choice => /^\d+\.\d{2}(?:m|kg)$/.test(choice.label)).length, 1);
  }
  const time = newRound('bigger', { kind: 'date', difficulty: 'normal', rng: () => 0 }).comparison;
  assert.ok(time.choices.some(choice => choice.label.includes('から')));
  const mixedEra = newRound('bigger', { kind: 'era', difficulty: 'challenge', rng: () => 0 }).comparison;
  assert.ok(mixedEra.choices.some(choice => choice.label.startsWith('昭和')));
  assert.ok(mixedEra.choices.some(choice => choice.label.startsWith('西暦')));
  assert.notEqual(mixedEra.choices[0].magnitude, mixedEra.choices[1].magnitude);
});

function valueShownByChoice(kind, choice) {
  const label = choice.label;
  let match;
  if (kind === 'number') {
    match = label.match(/^(\d+)＋(\d+)－(\d+)$/);
    if (match) return Number(match[1]) + Number(match[2]) - Number(match[3]);
    match = label.match(/^(\d+)－(\d+)＋(\d+)$/);
    if (match) return Number(match[1]) - Number(match[2]) + Number(match[3]);
    match = label.match(/^(\d+)＋(\d+)$/);
    if (match) return Number(match[1]) + Number(match[2]);
    match = label.match(/^(\d+)－(\d+)$/);
    if (match) return Number(match[1]) - Number(match[2]);
  }
  if (kind === 'length') {
    if (choice.visual.type === 'bar') return choice.visual.widthPercent;
    match = label.match(/^(\d+)m(\d+)cm＋(\d+)cm$/);
    if (match) return Number(match[1]) * 100 + Number(match[2]) + Number(match[3]);
    match = label.match(/^(\d+)m(\d+)cm$/);
    if (match) return Number(match[1]) * 100 + Number(match[2]);
    match = label.match(/^(\d+\.\d{2})m$/);
    if (match) return Math.round(Number(match[1]) * 100);
    match = label.match(/^(\d+)cm$/);
    if (match) return Number(match[1]);
  }
  if (kind === 'weight') {
    match = label.match(/^(\d+)kg(\d+)g＋(\d+)g$/);
    if (match) return Number(match[1]) * 1000 + Number(match[2]) + Number(match[3]);
    match = label.match(/^(\d+)kg(\d+)g$/);
    if (match) return Number(match[1]) * 1000 + Number(match[2]);
    match = label.match(/^(\d+\.\d{2})kg$/);
    if (match) return Math.round(Number(match[1]) * 1000);
    match = label.match(/^(\d+)g$/);
    if (match) return Number(match[1]);
  }
  if (kind === 'era') {
    match = label.match(/^(昭和|平成)(\d+)年(?:の(\d+)年後)?$/);
    if (match) return (match[1] === '昭和' ? 1925 : 1988) + Number(match[2]) + Number(match[3] || 0);
    match = label.match(/^西暦(\d+)年$/);
    if (match) return Number(match[1]);
  }
  if (kind === 'date') {
    match = label.match(/^(\d{2}):(\d{2})から(?:(\d+)時間)?(\d+)分(後|前)$/);
    if (match) return Number(match[1]) * 60 + Number(match[2]) + (match[5] === '後' ? 1 : -1) * (Number(match[3] || 0) * 60 + Number(match[4]));
    match = label.match(/^(\d{2}):(\d{2})$/);
    if (match) return Number(match[1]) * 60 + Number(match[2]);
    match = label.match(/^(\d+)月(\d+)日$/);
    if (match) return Number(match[1]) * 32 + Number(match[2]);
  }
  assert.fail(`unrecognized ${kind} label: ${label}`);
}

test('comparison labels evaluate to their answers across seeds without representation bias', () => {
  const decimalOnLow = { length: 0, weight: 0 };
  const decimalOnHigh = { length: 0, weight: 0 };
  const japaneseOnLow = { era: 0 }, japaneseOnHigh = { era: 0 };
  for (let seed = 1; seed <= 120; seed++) for (const difficulty of ['slow', 'normal', 'challenge']) {
    let value = seed;
    const rng = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
    for (const kind of COMPARISON_KINDS) {
      const { comparison } = newRound('bigger', { kind, difficulty, rng });
      const actual = comparison.choices.map(choice => valueShownByChoice(kind, choice));
      assert.deepEqual(actual, comparison.choices.map(choice => choice.magnitude));
      assert.notEqual(actual[0], actual[1]);
      const lowerIndex = actual[0] < actual[1] ? 0 : 1;
      const expected = ['smaller', 'shorter', 'lighter', 'older', 'earlier'].includes(comparison.direction) ? lowerIndex : 1 - lowerIndex;
      assert.equal(comparison.correctIndex, expected);
      if (difficulty === 'normal' && (kind === 'length' || kind === 'weight')) {
        const decimal = comparison.choices.find(choice => /^\d+\.\d{2}(?:m|kg)$/.test(choice.label));
        if (decimal) (decimal.magnitude === Math.min(...actual) ? decimalOnLow : decimalOnHigh)[kind]++;
      }
      if (difficulty === 'normal' && kind === 'era' && comparison.choices.some(choice => choice.label.startsWith('西暦'))) {
        const japanese = comparison.choices.find(choice => !choice.label.startsWith('西暦'));
        (japanese.magnitude === Math.min(...actual) ? japaneseOnLow : japaneseOnHigh).era++;
      }
    }
  }
  for (const kind of ['length', 'weight']) assert.ok(decimalOnLow[kind] > 0 && decimalOnHigh[kind] > 0);
  assert.ok(japaneseOnLow.era > 0 && japaneseOnHigh.era > 0);
});

test('count steps mix target and distractors and finish one target beyond goal', () => {
  for (const difficulty of ['slow', 'normal', 'challenge']) for (const random of [0, 0.99]) {
    const round = newRound('count', { difficulty, rng: () => random });
    assert.ok(round.targetCount >= 4 && round.targetCount <= 7);
    assert.ok(round.dummyCount >= 4 && round.dummyCount <= 7);
    const last = round.steps.at(-1);
    assert.equal(last.targetCount, round.targetCount + 1);
    assert.equal(round.steps.at(-2).targetCount, round.targetCount);
    assert.equal(last.items.filter(item => item.kind === 'distractor').length, round.dummyCount);
    assert.equal(last.items.filter(item => item.kind === 'target').length, round.targetCount + 1);
    assert.equal(new Set(last.items.map(item => item.id)).size, last.items.length);
    for (let index = 0; index < round.steps.length; index++) {
      const step = round.steps[index];
      assert.equal(step.items.length, index + 1);
      assert.equal(step.targetCount, step.items.filter(item => item.kind === 'target').length);
      assert.ok(step.items.every(item => item.kind === 'target' ? item.emoji === round.targetEmoji : item.emoji !== round.targetEmoji));
    }
  }
});

test('color match session changes reference twice, varies right, and scores only matches', () => {
  for (const difficulty of ['slow', 'normal', 'challenge']) for (const random of [0, 0.99]) {
    const { sequence, matchCount } = makeRedSequence({ difficulty, rng: () => random });
    assert.equal(sequence.length, 24);
    assert.ok(matchCount === 8 || matchCount === 9);
    assert.equal(sequence.filter((stimulus, index) => index > 0 && stimulus.left !== sequence[index - 1].left).length, 2);
    assert.ok(sequence.every((stimulus, index) => Number.isInteger(stimulus.durationMs) && stimulus.durationMs > 0 &&
      (index === 0 || (stimulus.right !== sequence[index - 1].right && (stimulus.left !== sequence[index - 1].left) === (index === 8 || index === 16)))));
    for (let period = 0; period < 3; period++) assert.ok(sequence.slice(period * 8, period * 8 + 8).filter(s => s.left === s.right).length >= 2);
    const matchIndices = sequence.flatMap((stimulus, index) => stimulus.left === stimulus.right ? [index] : []);
    assert.equal(redScore(sequence, []).points, 0);
    assert.equal(redScore(sequence, matchIndices).points, 100);
    const wrong = sequence.findIndex(stimulus => stimulus.left !== stimulus.right);
    assert.ok(redScore(sequence, [...matchIndices, wrong]).points < 100);
    assert.equal(redScore(sequence, sequence.map((_, index) => index)).points, 0);
    assert.equal(redScore(sequence, [matchIndices[0], matchIndices[0]]).matchHits, 1);
    assert.equal(redScore(sequence, [matchIndices[0], matchIndices[0]]).misses, matchCount - 1);
  }
  for (let seed = 1; seed <= 100; seed++) {
    let value = seed;
    const rng = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
    const { sequence, matchCount } = makeRedSequence({ rng });
    assert.equal(sequence.length, 24);
    assert.ok(matchCount === 8 || matchCount === 9);
    assert.ok(sequence.every((stimulus, index) => index === 0 || stimulus.right !== sequence[index - 1].right));
  }
});

test('daily score normalization maps raw game maxima to one hundred', () => {
  assert.equal(getTotalRounds('red'), 24);
  assert.equal(getTotalRounds('ten'), 3);
  assert.equal(getMaxScore('ten'), 300);
  assert.equal(getMaxScore('count'), 96);
  assert.equal(normalizeGameScore('ten', 300), 100);
  assert.equal(normalizeGameScore('ten', 150), 50);
  assert.equal(normalizeGameScore('count', 96), 100);
  assert.equal(normalizeGameScore('quiz', -10), 0);
  assert.equal(normalizeGameScore('quiz', 200), 100);
});

test('quiz bank has forty normal choices, clear answers, and difficulty pools', () => {
  assert.ok(QUIZ.length >= 40);
  assert.equal(new Set(QUIZ.map(question => question.q)).size, QUIZ.length);
  assert.equal(getQuizPool('normal').length, 40);
  assert.equal(getQuizPool('slow').length, 24);
  assert.equal(getQuizPool('challenge').length, 16);
  for (const difficulty of ['slow', 'normal', 'challenge']) {
    const pool = getQuizPool(difficulty);
    assert.ok(pool.length >= 5);
    assert.equal(new Set(pool).size, pool.length);
    assert.ok(pool.every(index => index >= 0 && index < QUIZ.length));
    assert.ok(pool.every(index => difficulty === 'normal' ? QUIZ[index].difficulty !== 'slow' : QUIZ[index].difficulty === difficulty));
  }
  for (const question of QUIZ) {
    assert.equal(question.answers.length, 3);
    assert.equal(new Set(question.answers).size, 3);
    assert.ok(Number.isInteger(question.correct) && question.correct >= 0 && question.correct <= 2);
    assert.ok(question.explanation.length >= 6);
    assert.ok(['slow', 'normal', 'challenge'].includes(question.difficulty));
  }
});
