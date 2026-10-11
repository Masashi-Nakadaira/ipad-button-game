// Changing game stimuli stay visible for at least two seconds. The familiar
// 3-2-1 start countdown is separate and advances once per second.
const PACING = {
  slow: { stimulusMs: 2600, memoryFlashMs: 2600, countStepMs: 2700, tenDistractorChangeMs: 3000, reactionWindowMs: 8000, meterTravelMs: 2200, meterCenterHoldMs: 2200, countdownBeatMs: 1000 },
  normal: { stimulusMs: 2300, memoryFlashMs: 2300, countStepMs: 2400, tenDistractorChangeMs: 2700, reactionWindowMs: 7000, meterTravelMs: 2000, meterCenterHoldMs: 1800, countdownBeatMs: 1000 },
  challenge: { stimulusMs: 2000, memoryFlashMs: 2000, countStepMs: 2100, tenDistractorChangeMs: 2300, reactionWindowMs: 6000, meterTravelMs: 1800, meterCenterHoldMs: 1600, countdownBeatMs: 1000 },
};

export const getGamePacing = (difficulty = 'normal') => PACING[difficulty] ?? PACING.normal;

export function getMeterPosition(elapsedMs, difficulty = 'normal') {
  const { meterTravelMs: travel, meterCenterHoldMs: hold } = getGamePacing(difficulty);
  const cycle = travel * 4 + hold * 2;
  let time = Math.max(0, Number(elapsedMs) || 0) % cycle;
  if (time < travel) return time / travel / 2;
  time -= travel;
  if (time < hold) return 0.5;
  time -= hold;
  if (time < travel) return 0.5 + time / travel / 2;
  time -= travel;
  if (time < travel) return 1 - time / travel / 2;
  time -= travel;
  if (time < hold) return 0.5;
  time -= hold;
  return 0.5 - time / travel / 2;
}
