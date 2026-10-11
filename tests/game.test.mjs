import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISON_KINDS, getMaxScore, getQuizPool, getTotalRounds, makeRedSequence,
  newRound, normalizeGameScore, reactionGrade, redScore, rpsAnswer, rpsResult,
  teamScore, tenGrade } from '../src/gameEngine.js';
import { GAMES, NATURE_ITEMS, QUIZ } from '../src/gameData.js';
import { getGamePacing, getMeterPosition } from '../src/gamePacing.js';

test('ten seconds and reaction time have bounded, monotone scores', () => {
  assert.deepEqual(tenGrade(10000), { seconds: '10.00', difference: '0.00', points: 100, phrase: 'ぴったり！' });
  assert.equal(tenGrade(9820).seconds, '9.82');
  assert.equal(reactionGrade(0).points, 20);
  assert.equal(reactionGrade(200).points, 20);
  assert.equal(reactionGrade(7000).points, 10);
  assert.equal(reactionGrade(8000).points, 10);
  let previous = 20;
  for (let ms = 0; ms <= 7000; ms += 25) {
    const grade = reactionGrade(ms);
    assert.ok(grade.points <= previous && grade.points >= 10);
    previous = grade.points;
  }
  assert.ok(tenGrade(8000).points >= 85);
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

test('gentle pacing keeps changing cues readable and holds the team meter at center', () => {
  for (const difficulty of ['slow', 'normal', 'challenge']) {
    const pacing = getGamePacing(difficulty);
    assert.ok(pacing.stimulusMs >= 2000);
    assert.ok(pacing.memoryFlashMs >= 2000);
    assert.ok(pacing.countStepMs >= 2000);
    assert.ok(pacing.tenDistractorChangeMs >= 2000);
    assert.equal(pacing.countdownBeatMs, 1000);
    assert.ok(pacing.reactionWindowMs >= 6000 && pacing.reactionWindowMs <= 8000);
    assert.equal(getMeterPosition(pacing.meterTravelMs, difficulty), 0.5);
    assert.equal(getMeterPosition(pacing.meterTravelMs + pacing.meterCenterHoldMs - 1, difficulty), 0.5);
    assert.ok(getMeterPosition(0, difficulty) >= 0 && getMeterPosition(0, difficulty) <= 1);
    assert.ok(reactionGrade(pacing.reactionWindowMs, pacing.reactionWindowMs).points >= 10);
    assert.equal(newRound('light', { difficulty, rng: () => 0 }).feintCount, 0);
    assert.ok(newRound('sound', { difficulty, rng: () => 0 }).delay >= pacing.stimulusMs * 2);
  }
  assert.equal(getGamePacing('unknown'), getGamePacing('normal'));
});

test('default rock paper scissors favors winning while explicit modes stay exact', () => {
  for (const difficulty of ['slow', 'normal']) {
    let wins = 0;
    for (let sample = 0; sample < 100; sample++) {
      const result = newRound('rps', { difficulty, rng: () => (sample + 0.5) / 100 });
      if (result.instruction === '勝って') wins++;
      assert.notEqual(result.instruction, 'あいこで');
    }
    assert.ok(wins >= 60);
    assert.equal(newRound('rps', { difficulty, rpsMode: 'lose', rng: () => 0 }).instruction, '負けて');
  }
});

test('team gives reachable center perfect and bounded edge score', () => {
  for (const players of [2, 3, 4]) {
    const center = Array.from({ length: players }, (_, button) => ({ button, position: button % 2 ? 0.48 : 0.52 }));
    assert.equal(teamScore(center, players).points, 100);
    assert.equal(teamScore(center.map(x => ({ ...x, position: 0 })), players).points, 0);
  }
  assert.equal(teamScore([{ position: 0.44 }, { position: 0.56 }], 2).points, 100);
  assert.ok(teamScore([{ position: 0.40 }, { position: 0.60 }], 2).points < 100);
  assert.equal(teamScore([{ position: 0.5 }], 2), null);
});

test('memory grows with difficulty, regenerates, and never repeats adjacent colors', () => {
  const lengths = { slow: [1, 2, 2, 3], normal: [1, 2, 3, 3], challenge: [2, 2, 3, 3] };
  for (const [difficulty, expectedLengths] of Object.entries(lengths)) {
    let previous;
    for (let index = 0; index < 4; index++) {
      const sequence = newRound('memory', { index, difficulty, previousSequence: previous, rng: () => 0 }).sequence;
      assert.equal(sequence.length, expectedLengths[index]);
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

test('comparison uses all five categories while keeping normal questions direct', () => {
  const usedKinds = [];
  for (let index = 0; index < 5; index++) {
    const { comparison } = newRound('bigger', { index, usedKinds, rng: () => 0 });
    usedKinds.push(comparison.kind);
  }
  assert.deepEqual(new Set(usedKinds), new Set(COMPARISON_KINDS));
  const slow = newRound('bigger', { kind: 'number', difficulty: 'slow', rng: () => 0 }).comparison;
  assert.ok(slow.choices.every(choice => /^\d+$/.test(choice.label)));
  const normal = newRound('bigger', { kind: 'number', difficulty: 'normal', rng: () => 0 }).comparison;
  assert.ok(normal.choices.every(choice => /^\d+$/.test(choice.label)));
  const challenge = newRound('bigger', { kind: 'number', difficulty: 'challenge', rng: () => 0 }).comparison;
  assert.equal(challenge.choices.filter(choice => /[＋－]/.test(choice.label)).length, 1);
  for (const difficulty of ['slow', 'normal']) {
    const bar = newRound('bigger', { kind: 'length', difficulty, rng: () => 0 }).comparison;
    assert.ok(bar.choices.every(choice => choice.visual.type === 'bar'));
    const weight = newRound('bigger', { kind: 'weight', difficulty, rng: () => 0 }).comparison;
    assert.ok(weight.choices.every(choice => /^\d+g$/.test(choice.label)));
  }
  const time = newRound('bigger', { kind: 'date', difficulty: 'normal', rng: () => 0 }).comparison;
  assert.ok(time.choices.every(choice => /^\d{2}:(00|15|30|45)$/.test(choice.label)));
  const normalEra = newRound('bigger', { kind: 'era', difficulty: 'normal', rng: () => 0 }).comparison;
  assert.ok(normalEra.choices.every(choice => /^(昭和|平成)\d+年$/.test(choice.label)));
  const mixedEra = newRound('bigger', { kind: 'era', difficulty: 'challenge', rng: () => 0 }).comparison;
  assert.ok(mixedEra.choices.some(choice => choice.label.startsWith('昭和')));
  assert.ok(mixedEra.choices.some(choice => choice.label.startsWith('西暦')));
  assert.notEqual(mixedEra.choices[0].magnitude, mixedEra.choices[1].magnitude);
});

function valueShownByChoice(kind, choice) {
  const label = choice.label;
  let match;
  if (kind === 'number') {
    if (/^\d+$/.test(label)) return Number(label);
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
    match = label.match(/^(昭和|平成)(\d+)年$/);
    if (match) return (match[1] === '昭和' ? 1925 : 1988) + Number(match[2]);
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
      if (difficulty === 'challenge' && (kind === 'length' || kind === 'weight')) {
        const decimal = comparison.choices.find(choice => /^\d+\.\d{2}(?:m|kg)$/.test(choice.label));
        if (decimal) (decimal.magnitude === Math.min(...actual) ? decimalOnLow : decimalOnHigh)[kind]++;
      }
      if (difficulty === 'challenge' && kind === 'era' && comparison.choices.some(choice => choice.label.startsWith('西暦'))) {
        const japanese = comparison.choices.find(choice => !choice.label.startsWith('西暦'));
        (japanese.magnitude === Math.min(...actual) ? japaneseOnLow : japaneseOnHigh).era++;
      }
    }
  }
  for (const kind of ['length', 'weight']) assert.ok(decimalOnLow[kind] > 0 && decimalOnHigh[kind] > 0);
  assert.ok(japaneseOnLow.era > 0 && japaneseOnHigh.era > 0);
});

test('count steps mix target and distractors and finish one target beyond goal', () => {
  const bounds = { slow: { target: [2, 3], dummy: [1, 2] }, normal: { target: [3, 4], dummy: [2, 3] }, challenge: { target: [4, 5], dummy: [3, 4] } };
  for (const difficulty of ['slow', 'normal', 'challenge']) for (const random of [0, 0.99]) {
    const round = newRound('count', { difficulty, rng: () => random });
    assert.ok(round.targetCount >= bounds[difficulty].target[0] && round.targetCount <= bounds[difficulty].target[1]);
    assert.ok(round.dummyCount >= bounds[difficulty].dummy[0] && round.dummyCount <= bounds[difficulty].dummy[1]);
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
    assert.ok(sequence.every((stimulus, index) => Number.isInteger(stimulus.durationMs) && stimulus.durationMs >= getGamePacing(difficulty).stimulusMs &&
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

test('nature zoom quiz uses distinct, answerable image pairs in every difficulty', () => {
  assert.equal(GAMES.find(game => game.id === 'quiz').title, 'しぜんクイズ');
  assert.ok(QUIZ.length >= 12 && QUIZ.length <= 16);
  assert.equal(new Set(QUIZ.map(question => question.q)).size, QUIZ.length);
  assert.equal(getTotalRounds('quiz'), 5);
  assert.equal(getMaxScore('quiz'), 100);
  const expectedPool = QUIZ.map((_, index) => index);
  for (const difficulty of ['slow', 'normal', 'challenge']) assert.deepEqual(getQuizPool(difficulty), expectedPool);
  assert.equal(new Set(Object.keys(NATURE_ITEMS)).size, Object.keys(NATURE_ITEMS).length);
  const usedAssets = new Set();
  const pairs = new Set();
  for (const question of QUIZ) {
    assert.equal(question.answers.length, 2);
    assert.ok(question.correct === 0 || question.correct === 1);
    const ids = question.answers.map(answer => answer.assetId);
    assert.equal(new Set(ids).size, 2);
    ids.forEach(id => usedAssets.add(id));
    pairs.add([...ids].sort().join('/'));
    for (const answer of question.answers) assert.equal(answer.label, NATURE_ITEMS[answer.assetId]);
    assert.equal(question.q, `どちらが${question.answers[question.correct].label}？`);
    assert.ok(question.explanation.length >= 10);
  }
  assert.deepEqual(usedAssets, new Set(Object.keys(NATURE_ITEMS)));
  assert.equal(pairs.size, QUIZ.length);
  assert.ok(QUIZ.some(question => question.answers.some(answer => answer.assetId === 'tomato') && question.answers.some(answer => answer.assetId === 'red-apple')));
  assert.ok(QUIZ.some(question => question.answers.some(answer => answer.assetId === 'carrot') && question.answers.some(answer => answer.assetId === 'mandarin')));
  assert.ok(QUIZ.some(question => question.answers.some(answer => answer.assetId === 'red-apple') && question.answers.some(answer => answer.assetId === 'cherry')));
  assert.ok(QUIZ.some(question => question.correct === 0));
  assert.ok(QUIZ.some(question => question.correct === 1));
});
