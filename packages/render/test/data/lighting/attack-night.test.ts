import { describe, expect, it } from 'vitest';
import {
  ATTACK_NIGHT_FADE_SECONDS,
  ATTACK_NIGHT_GRADE,
  darkenToAttackNight,
  fadeAttackNight,
} from '../../../src/data/lighting/attack-night.js';
import { nightLevel } from '../../../src/data/lighting/grade.js';
import type { LightGrade } from '../../../src/data/lighting/types.js';

/** A render frame at 60 fps, in game seconds. */
const FRAME = 1 / 60;
const DAY: LightGrade = [1, 1, 1];

function fadeFor(level: number, on: boolean, seconds: number): number {
  let next = level;
  for (let t = 0; t < seconds; t += FRAME) next = fadeAttackNight(next, on, FRAME);
  return next;
}

describe('fadeAttackNight', () => {
  it('falls over the fade time and lifts as long', () => {
    const half = fadeFor(0, true, ATTACK_NIGHT_FADE_SECONDS / 2);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
    expect(fadeFor(half, true, ATTACK_NIGHT_FADE_SECONDS)).toBe(1);
    expect(fadeFor(1, false, ATTACK_NIGHT_FADE_SECONDS + FRAME)).toBe(0);
  });

  it('holds while paused and snaps on a jump or a step back', () => {
    expect(fadeAttackNight(0.3, true, 0)).toBe(0.3);
    expect(fadeAttackNight(0.3, true, 60)).toBe(1);
    expect(fadeAttackNight(0.3, false, -1)).toBe(0);
  });
});

describe('darkenToAttackNight', () => {
  const out: [number, number, number] = [1, 1, 1];

  it('turns a day into a night that lights the lamps, and leaves it alone at rest', () => {
    expect(darkenToAttackNight(DAY, 0, out)).toEqual([1, 1, 1]);
    expect(darkenToAttackNight(DAY, 1, out)).toEqual([...ATTACK_NIGHT_GRADE]);
    expect(nightLevel(out)).toBe(1);
  });

  it('keeps a darker script night as it is', () => {
    const deep: LightGrade = [0.3, 0.32, 0.45];
    expect(darkenToAttackNight(deep, 1, out)).toEqual([0.3, 0.32, 0.45]);
  });
});
