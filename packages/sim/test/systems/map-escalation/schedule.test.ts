import { MapEscalation } from '@open-northland/data';
import { describe, expect, it } from 'vitest';
import { TICKS_PER_SECOND } from '../../../src/core/loop.js';
import { apportion, launchTick, refillMen, waveSize } from '../../../src/systems/map-escalation/schedule.js';

const SWORD = 35;
const SHORT = 34;
const BOW = 41;
const MIX = [
  { job: SWORD, weight: 2 },
  { job: SHORT, weight: 1 },
  { job: BOW, weight: 2 },
];

const CONFIG = MapEscalation.parse({
  keep: { seat: 6, houseType: 39, x: 1, y: 1, range: 1 },
  tribe: 2,
  jobMix: MIX,
  attacks: {
    launches: [
      { atSeconds: 100, landMen: 10, seaMen: 0 },
      { atSeconds: 200, landMen: 20, seaMen: 5 },
    ],
    repeat: {
      everySeconds: 50,
      waves: [
        { landMen: 1, seaMen: 0 },
        { landMen: 2, seaMen: 3 },
      ],
    },
    endAfterSeconds: 10,
    targets: [{ seat: 0, raider: 7, x: 1, y: 1 }],
  },
  guard: {
    base: 1,
    perSeatStep: 1,
    stepSeconds: 10,
    perSeatMax: 1,
    refill: [
      { fromSeconds: 0, everySeconds: 65, men: 3 },
      { fromSeconds: 100, everySeconds: 40, men: 4 },
    ],
  },
});

const at = (seconds: number) => seconds * TICKS_PER_SECOND;

describe('map escalation schedule', () => {
  it('splits a spawn by weight, the larger remainders and then the earlier trade taking the rest', () => {
    expect(apportion(MIX, 10)).toEqual([SWORD, SWORD, SWORD, SWORD, SHORT, SHORT, BOW, BOW, BOW, BOW]);
    expect(apportion(MIX, 3)).toEqual([SWORD, SHORT, BOW]);
    expect(apportion(MIX, 4)).toEqual([SWORD, SWORD, SHORT, BOW]);
  });

  it('repeats past the scheduled launches on its interval, cycling the repeat waves', () => {
    expect([0, 1, 2, 3, 4].map((i) => launchTick(CONFIG, i))).toEqual([100, 200, 250, 300, 350].map(at));
    expect([1, 2, 3, 4].map((i) => waveSize(CONFIG, i).seaMen)).toEqual([5, 0, 3, 0]);
  });

  it('beats the opening refill one interval in and a later row from its first tick', () => {
    expect([65, 99, 100, 140].map((s) => refillMen(CONFIG, at(s)))).toEqual([3, 0, 4, 4]);
    expect(refillMen(CONFIG, at(130))).toBe(0);
  });
});
