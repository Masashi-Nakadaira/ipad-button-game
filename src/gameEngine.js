import { QUIZ } from './gameData.js';

export const pick = (n, rng = Math.random) => Math.min(n - 1, Math.floor(rng() * n));
export const shuffle = (items, rng = Math.random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1, rng);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export const rpsAnswer = (opponent, instruction) => instruction === '勝って' ? (opponent + 2) % 3 : instruction === '負けて' ? (opponent + 1) % 3 : opponent;
export const rpsResult = (opponent, instruction, answer) => answer === rpsAnswer(opponent, instruction);
export const tenGrade = (milliseconds) => {
  const difference = Math.abs(milliseconds - 10000);
  return { seconds: (milliseconds / 1000).toFixed(2), difference: (difference / 1000).toFixed(2),
    points: Math.max(0, Math.round(100 - difference / 100)),
    phrase: difference <= 200 ? 'ぴったり！' : difference <= 1000 ? 'おしい！' : 'いい感覚！' };
};
export const reactionGrade = (milliseconds, limitMs = 3600) => {
  const elapsed = Math.max(0, Math.min(limitMs, milliseconds));
  const points = elapsed <= 200 ? 20 : Math.max(1, Math.ceil(20 - 19 * (elapsed - 200) / (limitMs - 200)));
  return { seconds: (elapsed / 1000).toFixed(2), points,
    phrase: elapsed <= 200 ? 'すばやい！' : elapsed <= 800 ? 'いい反応！' : 'よくできた！' };
};
export const teamScore = (presses, players) => {
  if (presses.length < players) return null;
  const raw = presses.slice(0, players).reduce((sum, x) => {
    const distance = Math.abs(x.position - 0.5);
    return sum + Math.max(0, 25 - Math.max(0, distance - 0.02) * 60);
  }, 0);
  return { points: Math.floor(raw * 4 / players + 1e-9), raw: Math.round(raw) };
};
export const uniqueEvent = (() => { let n = 0; return () => `${Date.now().toString(36)}-${(++n).toString(36)}-${Math.random().toString(36).slice(2, 8)}`; })();

const ROUND_COUNTS = { ten: 3, rps: 5, team: 3, light: 5, sound: 5, quiz: 5, red: 24, count: 6, bigger: 5, memory: 4 };
const RAW_MAX = { ten: 300, rps: 100, team: 100, light: 100, sound: 100, quiz: 100, red: 100, count: 96, bigger: 100, memory: 100 };
export const getTotalRounds = id => ROUND_COUNTS[id] ?? 0;
export const getMaxScore = id => RAW_MAX[id] ?? 100;
export const normalizeGameScore = (id, raw) => Math.max(0, Math.min(100, Math.round((Number(raw) || 0) / getMaxScore(id) * 100)));

export function makeRedSequence({ difficulty = 'normal', rng = Math.random } = {}) {
  const lefts = [pick(4, rng)];
  for (let period = 1; period < 3; period++) {
    lefts.push([0, 1, 2, 3].filter(color => color !== lefts[period - 1])[pick(3, rng)]);
  }
  const matchCounts = [3, 3, 2];
  if (pick(2, rng)) matchCounts[pick(3, rng)]++;
  const sequence = [];
  let previousRight = -1;
  for (let period = 0; period < 3; period++) {
    // The first card after a reference change is always different, so a new
    // reference cannot force two identical right-hand cards in succession.
    const layouts = [];
    for (let mask = 0; mask < 128; mask++) {
      const offsets = [1, 2, 3, 4, 5, 6, 7].filter((_, bit) => mask & (1 << bit));
      if (offsets.length === matchCounts[period] && offsets.every((value, index) => index === 0 || value > offsets[index - 1] + 1)) layouts.push(offsets);
    }
    const matches = new Set(layouts[pick(layouts.length, rng)]);
    for (let offset = 0; offset < 8; offset++) {
      const left = lefts[period];
      const choices = [0, 1, 2, 3].filter(color => color !== previousRight && (matches.has(offset) ? color === left : color !== left));
      const right = choices[pick(choices.length, rng)];
      previousRight = right;
    const base = difficulty === 'slow' ? 1900 : difficulty === 'challenge' ? 1200 : 1650;
    const variance = difficulty === 'slow' ? 800 : difficulty === 'challenge' ? 700 : 450;
      sequence.push({ left, right, durationMs: base + pick(variance, rng) });
    }
  }
  return { sequence, matchCount: sequence.filter(stimulus => stimulus.left === stimulus.right).length };
}

export function redScore(sequence, pressedIndices = []) {
  const pressed = new Set(pressedIndices.filter(index => Number.isInteger(index) && index >= 0 && index < sequence.length));
  const matchCount = sequence.filter(stimulus => stimulus.left === stimulus.right).length;
  let matchHits = 0, misses = 0, falsePresses = 0;
  sequence.forEach((stimulus, index) => {
    const match = stimulus.left === stimulus.right;
    if (match && pressed.has(index)) matchHits++;
    if (match && !pressed.has(index)) misses++;
    if (!match && pressed.has(index)) falsePresses++;
  });
  const points = matchCount ? Math.round(100 * (matchHits - falsePresses) / matchCount) : 0;
  return { points: Math.max(0, Math.min(100, points)), matchHits, matchCount, misses, falsePresses };
}

export function getQuizPool(difficulty = 'normal') {
  return QUIZ.flatMap((question, index) =>
    difficulty === 'slow' ? question.difficulty === 'slow' ? [index] : []
      : difficulty === 'challenge' ? question.difficulty === 'challenge' ? [index] : []
        : question.difficulty === 'slow' ? [] : [index]);
}

export const COMPARISON_KINDS = ['number', 'length', 'weight', 'era', 'date'];
const DIRECTIONS = {
  number: ['larger', 'smaller'], length: ['longer', 'shorter'], weight: ['heavier', 'lighter'],
  era: ['older', 'newer'], date: ['earlier', 'later']
};
const comparisonChoice = (label, magnitude, type = 'text', widthPercent) => ({
  label, magnitude, visual: { type, value: label, ...(widthPercent == null ? {} : { widthPercent }) }
});

function makeComparison(options, rng) {
  const difficulty = options.difficulty ?? 'normal';
  const unused = COMPARISON_KINDS.filter(kind => !(options.usedKinds ?? []).includes(kind));
  const candidates = unused.length ? unused : COMPARISON_KINDS;
  const kind = options.kind ?? candidates[pick(candidates.length, rng)];
  const remaining = DIRECTIONS[kind].filter(direction => !(options.usedDirections ?? []).includes(direction));
  const possible = remaining.length ? remaining : DIRECTIONS[kind];
  const direction = options.direction ?? possible[pick(possible.length, rng)];
  const correctIndex = pick(2, rng);
  let low, high, prompt, explanation;

  if (kind === 'number') {
    const base = difficulty === 'slow' ? 25 + pick(45, rng) : difficulty === 'challenge' ? 110 + pick(170, rng) : 65 + pick(90, rng);
    const gap = difficulty === 'slow' ? 5 + pick(9, rng) : difficulty === 'challenge' ? 1 + pick(4, rng) : 2 + pick(7, rng);
    const arithmetic = (value, mode) => {
      const amount = 8 + pick(18, rng);
      if (difficulty === 'challenge') {
        const second = 5 + pick(15, rng);
        return mode === 0 ? `${value - amount + second}＋${amount}－${second}` : `${value + amount - second}－${amount}＋${second}`;
      }
      return mode === 0 ? `${value - amount}＋${amount}` : `${value + amount}－${amount}`;
    };
    const lowMode = pick(2, rng);
    low = comparisonChoice(arithmetic(base, lowMode), base);
    high = comparisonChoice(arithmetic(base + gap, 1 - lowMode), base + gap);
    prompt = direction === 'larger' ? '計算した答えが大きいのは？' : '計算した答えが小さいのは？';
    explanation = `${low.label}＝${base}、${high.label}＝${base + gap}。`;
  } else if (kind === 'length') {
    const useBars = difficulty === 'slow' && pick(2, rng) === 0;
    if (useBars) {
      const short = 42 + pick(19, rng);
      const gap = 14 + pick(10, rng);
      low = comparisonChoice('棒', short, 'bar', short);
      high = comparisonChoice('棒', short + gap, 'bar', short + gap);
      prompt = direction === 'longer' ? '長い棒はどっち？' : '短い棒はどっち？';
      explanation = direction === 'longer' ? '端まで長く伸びている棒が正解。' : '先端が手前で止まる棒が正解。';
    } else {
      const short = 120 + pick(difficulty === 'challenge' ? 180 : 100, rng);
      const gap = difficulty === 'slow' ? 10 + pick(12, rng) : difficulty === 'challenge' ? 1 + pick(5, rng) : 3 + pick(9, rng);
      const format = (cm, style) => {
        if (style === 0) return `${(cm / 100).toFixed(2)}m`;
        if (style === 1) return `${cm}cm`;
        if (style === 2) return `${Math.floor(cm / 100)}m${cm % 100}cm`;
        const add = 8 + pick(15, rng);
        const first = cm - add;
        return `${Math.floor(first / 100)}m${first % 100}cm＋${add}cm`;
      };
      const expressionSide = pick(2, rng);
      const ordinaryStyle = pick(3, rng);
      const lowStyle = difficulty === 'challenge' && expressionSide === 0 ? 3 : ordinaryStyle;
      const highStyle = difficulty === 'challenge' && expressionSide === 1 ? 3 : difficulty === 'normal' ? (ordinaryStyle + 1 + pick(2, rng)) % 3 : pick(3, rng);
      low = comparisonChoice(format(short, lowStyle), short);
      high = comparisonChoice(format(short + gap, highStyle), short + gap);
      prompt = direction === 'longer' ? '長さをcmに直して、長いのは？' : '長さをcmに直して、短いのは？';
      explanation = `${low.label}＝${short}cm、${high.label}＝${short + gap}cm。`;
    }
  } else if (kind === 'weight') {
    const light = difficulty === 'slow' ? 400 + pick(45, rng) * 10 : 1100 + pick(140, rng) * 10;
    const gap = difficulty === 'slow' ? (8 + pick(10, rng)) * 10 : difficulty === 'challenge' ? (1 + pick(3, rng)) * 10 : (2 + pick(7, rng)) * 10;
    const format = (grams, style) => {
      if (style === 0) return `${(grams / 1000).toFixed(2)}kg`;
      if (style === 1) return `${grams}g`;
      if (style === 2) return `${Math.floor(grams / 1000)}kg${grams % 1000}g`;
      const add = (8 + pick(15, rng)) * 10;
      const first = grams - add;
      return `${Math.floor(first / 1000)}kg${first % 1000}g＋${add}g`;
    };
    const expressionSide = pick(2, rng);
    const ordinaryStyle = difficulty === 'slow' ? pick(2, rng) + 1 : pick(3, rng);
    const lowStyle = difficulty === 'challenge' && expressionSide === 0 ? 3 : ordinaryStyle;
    const highStyle = difficulty === 'challenge' && expressionSide === 1 ? 3 : difficulty === 'normal' ? (ordinaryStyle + 1 + pick(2, rng)) % 3 : difficulty === 'slow' ? pick(2, rng) + 1 : pick(3, rng);
    low = comparisonChoice(format(light, lowStyle), light);
    high = comparisonChoice(format(light + gap, highStyle), light + gap);
    prompt = direction === 'heavier' ? '重さをgに直して、重いのは？' : '重さをgに直して、軽いのは？';
    explanation = `${low.label}＝${light}g、${high.label}＝${light + gap}g。`;
  } else if (kind === 'era') {
    const sameEra = difficulty === 'slow' || difficulty === 'normal' && pick(3, rng) === 0;
    if (sameEra) {
      const heisei = pick(2, rng) === 1;
      const era = heisei ? '平成' : '昭和';
      const firstYear = heisei ? 5 + pick(15, rng) : 25 + pick(22, rng);
      const gap = difficulty === 'slow' ? 3 + pick(7, rng) : 1 + pick(4, rng);
      const offset = heisei ? 1988 : 1925;
      low = comparisonChoice(`${era}${firstYear}年`, offset + firstYear);
      high = comparisonChoice(`${era}${firstYear + gap}年`, offset + firstYear + gap);
      explanation = `${low.label}は${offset + firstYear}年、${high.label}は${offset + firstYear + gap}年。`;
    } else {
      const heisei = pick(2, rng) === 1;
      const era = heisei ? '平成' : '昭和';
      const year = heisei ? 6 + pick(17, rng) : 27 + pick(28, rng);
      const converted = year + (heisei ? 1988 : 1925);
      const added = difficulty === 'challenge' ? 2 + pick(4, rng) : 0;
      const japaneseYear = converted + added;
      const gap = 1 + pick(difficulty === 'challenge' ? 3 : 6, rng);
      const westernYear = japaneseYear + (pick(2, rng) ? gap : -gap);
      const japanese = comparisonChoice(added ? `${era}${year}年の${added}年後` : `${era}${year}年`, japaneseYear);
      const western = comparisonChoice(`西暦${westernYear}年`, westernYear);
      [low, high] = japaneseYear < westernYear ? [japanese, western] : [western, japanese];
      explanation = `${japanese.label}＝西暦${japaneseYear}年、${western.label}＝${westernYear}年。`;
    }
    prompt = direction === 'older' ? 'より古い年はどっち？' : 'より新しい年はどっち？';
  } else {
    const useTime = difficulty !== 'slow' || pick(2, rng) === 0;
    if (useTime) {
      const hour = 8 + pick(9, rng), minute = 5 + pick(36, rng);
      const gap = difficulty === 'slow' ? 12 + pick(14, rng) : difficulty === 'challenge' ? 1 + pick(5, rng) : 3 + pick(9, rng);
      const format = total => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      const first = hour * 60 + minute;
      const timeExpression = (total, mode) => {
        const amount = difficulty === 'challenge' ? 60 + (10 + pick(36, rng)) : 10 + pick(31, rng);
        const starting = mode === 0 ? total - amount : total + amount;
        const interval = amount >= 60 ? `1時間${amount - 60}分` : `${amount}分`;
        return `${format(starting)}から${interval}${mode === 0 ? '後' : '前'}`;
      };
      if (difficulty === 'slow') {
        low = comparisonChoice(format(first), first);
        high = comparisonChoice(format(first + gap), first + gap);
      } else if (difficulty === 'challenge') {
        const lowMode = pick(2, rng);
        low = comparisonChoice(timeExpression(first, lowMode), first);
        high = comparisonChoice(timeExpression(first + gap, 1 - lowMode), first + gap);
      } else {
        const expressionSide = pick(2, rng);
        const mode = pick(2, rng);
        low = comparisonChoice(expressionSide === 0 ? timeExpression(first, mode) : format(first), first);
        high = comparisonChoice(expressionSide === 1 ? timeExpression(first + gap, mode) : format(first + gap), first + gap);
      }
      prompt = direction === 'earlier' ? '計算して早い時刻は？' : '計算して遅い時刻は？';
      explanation = `${low.label}＝${format(first)}、${high.label}＝${format(first + gap)}。`;
    } else {
      const month = 1 + pick(10, rng), day = 3 + pick(17, rng);
      const laterDay = day + 3 + pick(8, rng);
      low = comparisonChoice(`${month}月${day}日`, month * 32 + day);
      high = comparisonChoice(`${month}月${laterDay}日`, month * 32 + laterDay);
      prompt = direction === 'earlier' ? '1年の中で先に来る日は？' : '1年の中で後に来る日は？';
      explanation = `${month}月${day}日が先、${month}月${laterDay}日が後。`;
    }
  }
  const answer = ['smaller', 'shorter', 'lighter', 'older', 'earlier'].includes(direction) ? low : high;
  const other = answer === low ? high : low;
  const choices = correctIndex === 0 ? [answer, other] : [other, answer];
  if (kind === 'length' && choices[0].visual.type === 'bar') choices.forEach((choice, index) => { choice.label = index === 0 ? '左の棒' : '右の棒'; });
  return { kind, direction, prompt, choices, correctIndex, explanation };
}

function memorySequence(options, rng) {
  const index = Math.max(0, Math.min(3, options.index ?? 0));
  const base = options.difficulty === 'slow' ? 1 : options.difficulty === 'challenge' ? 3 : 2;
  const sequence = [pick(4, rng)];
  while (sequence.length < base + index) sequence.push((sequence.at(-1) + 1 + pick(3, rng)) % 4);
  const previous = options.sequence ?? options.previousSequence;
  if (previous?.length && previous.every((color, i) => sequence[i] === color)) {
    const alternatives = [0, 1, 2, 3].filter(color => color !== previous[0] && color !== sequence[1]);
    sequence[0] = alternatives[pick(alternatives.length, rng)];
  }
  return sequence;
}

const COUNT_OBJECTS = [
  { name: 'りんご', emoji: '🍎' }, { name: '星', emoji: '⭐' },
  { name: '花', emoji: '🌼' }, { name: '鳥', emoji: '🐦' }
];
function makeCountRound(difficulty, rng) {
  const targetCount = difficulty === 'slow' ? 4 + pick(2, rng) : difficulty === 'challenge' ? 5 + pick(3, rng) : 4 + pick(4, rng);
  const dummyCount = difficulty === 'slow' ? 4 : difficulty === 'challenge' ? 6 + pick(2, rng) : 4 + pick(4, rng);
  const target = pick(COUNT_OBJECTS.length, rng);
  const distractors = COUNT_OBJECTS.filter((_, index) => index !== target);
  const events = shuffle([
    ...Array.from({ length: targetCount - 1 }, () => 'target'),
    ...Array.from({ length: dummyCount }, () => 'distractor')
  ], rng).concat('target', 'target');
  const items = [];
  let count = 0;
  const steps = events.map((kind, index) => {
    if (kind === 'target') count++;
    const emoji = kind === 'target' ? COUNT_OBJECTS[target].emoji : distractors[pick(distractors.length, rng)].emoji;
    items.push({ id: index, kind, emoji });
    return { items: [...items], targetCount: count };
  });
  return { count: 0, targetCount, item: COUNT_OBJECTS[target].name, targetEmoji: COUNT_OBJECTS[target].emoji,
    dummyCount, steps };
}

export const newRound = (id, options = {}) => {
  const rng = options.rng ?? Math.random;
  const difficulty = options.difficulty ?? 'normal';
  if (id === 'rps') {
    const mode = options.rpsMode ?? 'random';
    const prompts = difficulty === 'challenge' ? ['勝って', '負けて', 'あいこで'] : ['勝って', '負けて'];
    return { opponent: pick(3, rng), instruction: mode === 'win' ? '勝って' : mode === 'lose' ? '負けて' : prompts[pick(prompts.length, rng)] };
  }
  if (id === 'light') {
    const delay = difficulty === 'slow' ? 2200 + pick(1700, rng) : difficulty === 'challenge' ? 1100 + pick(2100, rng) : 1500 + pick(1800, rng);
    return { target: 3, delay, feintCount: difficulty === 'slow' ? 1 : difficulty === 'challenge' ? 2 + pick(2, rng) : 1 + pick(2, rng) };
  }
  if (id === 'sound') return { delay: (difficulty === 'slow' ? 3300 : difficulty === 'challenge' ? 1800 : 2600) + pick(1800, rng) };
  if (id === 'red') return makeRedSequence({ difficulty, rng });
  if (id === 'count') return makeCountRound(difficulty, rng);
  if (id === 'bigger') {
    const comparison = makeComparison(options, rng);
    return { comparison, correctIndex: comparison.correctIndex, left: comparison.choices[0].label, right: comparison.choices[1].label };
  }
  if (id === 'memory') return { sequence: memorySequence(options, rng) };
  if (id === 'quiz') return { question: options.question ?? pick(QUIZ.length, rng) };
  return {};
};
