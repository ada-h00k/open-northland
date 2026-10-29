import type { MapEscalation, MapEscalationJobShare, MapEscalationWaveSize } from '@open-northland/data';
import { TICKS_PER_SECOND } from '../../core/loop.js';

// The escalation's timetable as sim ticks: when each attack launches, how large it is, and the
// guard's cap and refill beats. Pure functions of the schedule and the tick.

/** The tick the attack at 0-based `index` launches on. */
export function launchTick(config: MapEscalation, index: number): number {
  const { launches, repeat } = config.attacks;
  const scheduled = launches[index];
  if (scheduled !== undefined) return scheduled.atSeconds * TICKS_PER_SECOND;
  const last = launches[launches.length - 1]?.atSeconds ?? 0;
  const later = index - launches.length + 1;
  return (last + later * repeat.everySeconds) * TICKS_PER_SECOND;
}

/** The men the attack at 0-based `index` sends against each targeted seat. */
export function waveSize(config: MapEscalation, index: number): MapEscalationWaveSize {
  const { launches, repeat } = config.attacks;
  const scheduled = launches[index];
  if (scheduled !== undefined) return scheduled;
  const cycle = repeat.waves;
  return cycle[(index - launches.length) % cycle.length] ?? { landMen: 0, ships: 0 };
}

/** Whether an attack that sent `sent` men, `living` of them alive, lost enough of them to end. */
export function attackBeaten(config: MapEscalation, sent: number, living: number): boolean {
  return (sent - living) * 100 >= sent * config.attacks.endDeadPct;
}

export function attackEndsTick(config: MapEscalation, launchedTick: number): number {
  return launchedTick + config.attacks.endAfterSeconds * TICKS_PER_SECOND;
}

/** The guard's soldier cap at `tick` with `occupied` targeted seats in play. */
export function guardCap(config: MapEscalation, tick: number, occupied: number): number {
  const { base, perSeatStep, stepSeconds, perSeatMax } = config.guard;
  const steps = Math.floor(tick / (stepSeconds * TICKS_PER_SECOND));
  return base + occupied * Math.min(perSeatStep * steps, perSeatMax);
}

/** The men the guard's refill pulse brings on `tick`, 0 off the beat; the first beat falls one
 *  interval in, like the map's own pulse. The pulse grows by a step for each completed step of time. */
export function refillMen(config: MapEscalation, tick: number): number {
  const { everySeconds, baseMen, stepMen, stepSeconds, maxMen } = config.guard.refill;
  if (tick <= 0 || tick % (everySeconds * TICKS_PER_SECOND) !== 0) return 0;
  const steps = Math.floor(tick / (stepSeconds * TICKS_PER_SECOND));
  return Math.min(baseMen + stepMen * steps, maxMen);
}

/** `count` men split over the mix by weight: each trade its whole share, the rest one each to the
 *  largest remainders, the earlier trade on a tie. In mix order. */
export function apportion(mix: readonly MapEscalationJobShare[], count: number): number[] {
  const total = mix.reduce((sum, share) => sum + share.weight, 0);
  if (total === 0 || count <= 0) return [];
  const counts = mix.map((share) => Math.floor((share.weight * count) / total));
  let left = count - counts.reduce((sum, n) => sum + n, 0);
  const byRemainder = mix
    .map((share, i) => ({ i, remainder: (share.weight * count) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left === 0) break;
    counts[i] = (counts[i] ?? 0) + 1;
    left--;
  }
  return mix.flatMap((share, i) => Array.from({ length: counts[i] ?? 0 }, () => share.job));
}
