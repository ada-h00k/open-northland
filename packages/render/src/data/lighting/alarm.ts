import { clamp01, lerp, smoothstep } from '../math.js';
import { WEATHER_SNAP_SECONDS } from '../weather/climate.js';
import type { LightGrade } from './types.js';

/**
 * The alarm grade: the slight red the world takes on while a siege attack runs, an Open Northland
 * look tuned by eye, multiplied over whatever grade the day or night draws.
 */

/** The multiply a full alarm adds: red kept, green and blue lowered. */
export const ALARM_GRADE: LightGrade = [1, 0.72, 0.66];
/** Game seconds the alarm takes to come up or die away. */
export const ALARM_FADE_SECONDS = 2;

/**
 * The alarm's linear level after `dt` game seconds toward on (1) or off (0). A pause (`dt` 0) holds it;
 * a step back or longer than {@link WEATHER_SNAP_SECONDS} snaps, like the scene grade.
 */
export function fadeAlarm(level: number, on: boolean, dt: number): number {
  const target = on ? 1 : 0;
  if (dt < 0 || dt > WEATHER_SNAP_SECONDS) return target;
  const step = dt / ALARM_FADE_SECONDS;
  return on ? clamp01(level + step) : clamp01(level - step);
}

/** Multiply `grade` in place by the alarm at linear `level`, eased so the fade starts and ends softly. */
export function applyAlarm(grade: [number, number, number], level: number): void {
  const strength = smoothstep(0, 1, level);
  for (let c = 0; c < 3; c++) grade[c] = (grade[c] ?? 1) * lerp(1, ALARM_GRADE[c] ?? 1, strength);
}
