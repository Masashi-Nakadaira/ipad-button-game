const ANCHORS = {
  slow: [[15, 13], [63, 53]],
  normal: [[7, 12], [61, 8], [21, 54], [73, 55]],
  challenge: [[5, 4], [39, 5], [73, 6], [7, 55], [40, 54], [74, 54]],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (min, max, rng) => min + Math.floor(clamp(rng(), 0, 0.999999) * (max - min + 1));
const fakeNumber = (rng, excluded = []) => {
  let value;
  for (let attempt = 0; attempt < 16; attempt++) {
    value = integer(2, 98, rng);
    if (value !== 10 && !excluded.includes(value)) return value;
  }
  for (let candidate = 2; candidate <= 98; candidate++) if (candidate !== 10 && !excluded.includes(candidate)) return candidate;
  return 42;
};

function move(card, rng, otherValues) {
  return {
    ...card,
    value: fakeNumber(rng, otherValues),
    x: clamp(card.anchorX + integer(-7, 7, rng), 3, 76),
    y: clamp(card.anchorY + integer(-6, 6, rng), 1, 61),
    size: integer(68, 112, rng),
    driftX: integer(-16, 16, rng),
    driftY: integer(-10, 10, rng),
    duration: integer(5, 9, rng),
  };
}

export function createTenDistractors(difficulty = 'normal', rng = Math.random) {
  const anchors = ANCHORS[difficulty] ?? ANCHORS.normal;
  const cards = [];
  anchors.forEach(([anchorX, anchorY], id) => {
    const otherValues = cards.map(card => card.value);
    cards.push(move({ id, anchorX, anchorY, tone: id % 4 }, rng, otherValues));
  });
  return cards;
}

export function changeTenDistractor(cards, rng = Math.random) {
  if (!cards?.length) return cards || [];
  const index = integer(0, cards.length - 1, rng);
  const otherValues = cards.filter((_, i) => i !== index).map(card => card.value);
  const updated = move(cards[index], rng, [...otherValues, cards[index].value]);
  return cards.map((card, i) => i === index ? updated : card);
}
