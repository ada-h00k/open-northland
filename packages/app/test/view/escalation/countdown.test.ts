import { TICKS_PER_SECOND } from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import type { MissionInfoRow } from '../../../src/game/map/info-lines.js';
import {
  createSiegeRows,
  formatCountdown,
  siegeCountdownText,
} from '../../../src/view/escalation/countdown.js';

const COPY = { nextAttack: 'Next attack in {time}', attackRunning: 'Attack under way' };
const between = (nextAttackTick: number) =>
  ({ wave: 1, attackRunning: false, attackEndsByTick: null, nextAttackTick }) as const;

describe('formatCountdown', () => {
  it('prints minutes and seconds, rounding a part second up, and hours past an hour', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-3)).toBe('00:00');
    expect(formatCountdown(64.2)).toBe('01:05');
    expect(formatCountdown(40 * 60)).toBe('40:00');
    expect(formatCountdown(3600 + 61)).toBe('1:01:01');
  });
});

describe('siegeCountdownText', () => {
  it('counts down to the next launch on game ticks and says when an attack runs', () => {
    const tick = 100 * TICKS_PER_SECOND;
    expect(siegeCountdownText(between(tick + 90 * TICKS_PER_SECOND), tick, COPY)).toBe(
      'Next attack in 01:30',
    );
    expect(
      siegeCountdownText({ ...between(tick), attackRunning: true, attackEndsByTick: tick }, tick, COPY),
    ).toBe('Attack under way');
    expect(siegeCountdownText(null, tick, COPY)).toBeNull();
  });
});

describe('createSiegeRows', () => {
  it('leads the rows with the line and keeps the same list while nothing changed', () => {
    const lead = createSiegeRows();
    const rows: readonly MissionInfoRow[] = [{ kind: 'text', text: 'goal' }];
    const first = lead(rows, 'Next attack in 01:30');
    expect(first).toEqual([{ kind: 'text', text: 'Next attack in 01:30' }, ...rows]);
    expect(lead(rows, 'Next attack in 01:30')).toBe(first);
    expect(lead(rows, 'Next attack in 01:29')).not.toBe(first);
    expect(lead(rows, null)).toBe(rows);
  });
});
