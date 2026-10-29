import { describe, expect, it } from 'vitest';
import { ALARM_FADE_SECONDS, ALARM_GRADE, applyAlarm, fadeAlarm } from '../../../src/data/lighting/alarm.js';

/** A render frame at 60 fps, in game seconds. */
const FRAME = 1 / 60;

function fadeFor(level: number, on: boolean, seconds: number): number {
  let next = level;
  for (let t = 0; t < seconds; t += FRAME) next = fadeAlarm(next, on, FRAME);
  return next;
}

describe('fadeAlarm', () => {
  it('comes up over the fade time and dies away as long', () => {
    const half = fadeFor(0, true, ALARM_FADE_SECONDS / 2);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
    expect(fadeFor(half, true, ALARM_FADE_SECONDS)).toBe(1);
    expect(fadeFor(1, false, ALARM_FADE_SECONDS + FRAME)).toBe(0);
  });

  it('holds while paused and snaps on a jump or a step back', () => {
    expect(fadeAlarm(0.3, true, 0)).toBe(0.3);
    expect(fadeAlarm(0.3, true, 60)).toBe(1);
    expect(fadeAlarm(0.3, false, -1)).toBe(0);
  });
});

describe('applyAlarm', () => {
  it('leaves the grade alone at rest and multiplies the full alarm over it', () => {
    const night: [number, number, number] = [0.5, 0.5, 0.6];
    applyAlarm(night, 0);
    expect(night).toEqual([0.5, 0.5, 0.6]);
    applyAlarm(night, 1);
    expect(night[0]).toBeCloseTo(0.5 * ALARM_GRADE[0]);
    expect(night[1]).toBeCloseTo(0.5 * ALARM_GRADE[1]);
    expect(night[2]).toBeCloseTo(0.6 * ALARM_GRADE[2]);
  });
});
