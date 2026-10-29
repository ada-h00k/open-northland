import { clamp01, lerp, smoothstep } from '../math.js';
import { WEATHER_SNAP_SECONDS } from '../weather/climate.js';
import type { LightGrade } from './types.js';

/**
 * The attack night: while a siege attack runs the world darkens into a night, an Open Northland look
 * tuned by eye. It darkens the script's grade toward {@link ATTACK_NIGHT_GRADE} and never brightens
 * it, so a map that is already night stays as dark as its script made it.
 */

/** The script grade the attack night reaches, as dark as the North Guard night. */
export const ATTACK_NIGHT_GRADE: LightGrade = [0.56, 0.56, 0.56];
/** Game seconds the night takes to fall or lift. */
export const ATTACK_NIGHT_FADE_SECONDS = 3;

/**
 * The attack night's linear level after `dt` game seconds toward on (1) or off (0). A pause (`dt` 0)
 * holds it; a step back or longer than {@link WEATHER_SNAP_SECONDS} snaps, like the scene grade.
 */
export function fadeAttackNight(level: number, on: boolean, dt: number): number {
  const target = on ? 1 : 0;
  if (dt < 0 || dt > WEATHER_SNAP_SECONDS) return target;
  const step = dt / ATTACK_NIGHT_FADE_SECONDS;
  return on ? clamp01(level + step) : clamp01(level - step);
}

/** `script` darkened toward the attack night at linear `level`, eased so the fade starts and ends
 *  softly, written into `out`. A channel already darker than the night keeps its own value. */
export function darkenToAttackNight(
  script: LightGrade,
  level: number,
  out: [number, number, number],
): [number, number, number] {
  const strength = smoothstep(0, 1, level);
  for (let c = 0; c < 3; c++) {
    const own = script[c] ?? 1;
    out[c] = Math.min(own, lerp(own, ATTACK_NIGHT_GRADE[c] ?? 1, strength));
  }
  return out;
}
