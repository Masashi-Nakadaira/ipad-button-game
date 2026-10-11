import test from 'node:test';
import assert from 'node:assert/strict';
import { changeTenDistractor, createTenDistractors } from '../src/tenDistraction.js';

test('distraction count grows with difficulty without real-clock numbers', () => {
  const expected = { slow: 1, normal: 2, challenge: 3 };
  for (const [difficulty, count] of Object.entries(expected)) {
    const cards = createTenDistractors(difficulty, () => 0.42);
    assert.equal(cards.length, count);
    assert.equal(new Set(cards.map(card => card.id)).size, count);
    assert.equal(new Set(cards.map(card => card.value)).size, count);
    cards.forEach(card => {
      assert.notEqual(card.value, 10);
      assert.ok(card.x >= 3 && card.x <= 76);
      assert.ok(card.y >= 1 && card.y <= 61);
      assert.ok(card.size >= 88 && card.duration >= 10);
    });
  }
});

test('irregular update changes one card and leaves the rest in place', () => {
  const cards = createTenDistractors('normal', () => 0.42);
  const changed = changeTenDistractor(cards, () => 0.5);
  assert.equal(changed.length, cards.length);
  assert.equal(changed.filter((card, index) => card !== cards[index]).length, 1);
  assert.ok(changed.some((card, index) => card.value !== cards[index].value));
  assert.deepEqual(changeTenDistractor([], () => 0), []);
});
