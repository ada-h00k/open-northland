import { type MapEscalationView, TICKS_PER_SECOND } from '@open-northland/sim';
import type { MissionInfoRow } from '../../game/map/info-lines.js';
import { formatMessage } from '../../i18n/index.js';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export interface CountdownCopy {
  /** Takes `{time}`. */
  readonly nextAttack: string;
  readonly attackRunning: string;
}

/** Game seconds as `mm:ss`, or `h:mm:ss` from an hour on; a part second counts as a whole one. */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const secs = whole % SECONDS_PER_MINUTE;
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const pad = (value: number): string => String(value).padStart(2, '0');
  if (minutes < MINUTES_PER_HOUR) return `${pad(minutes)}:${pad(secs)}`;
  return `${Math.floor(minutes / MINUTES_PER_HOUR)}:${pad(minutes % MINUTES_PER_HOUR)}:${pad(secs)}`;
}

/** The goal panel's siege lines at `tick`, on game time so they follow the speed and the pause: the
 *  countdown to the next launch, under the running-attack line while an attack runs; null on a map
 *  without a siege. */
export function siegeCountdownLines(
  view: MapEscalationView | null,
  tick: number,
  copy: CountdownCopy,
): readonly string[] | null {
  if (view === null) return null;
  const time = formatCountdown((view.nextAttackTick - tick) / TICKS_PER_SECOND);
  const next = formatMessage(copy.nextAttack, { time });
  return view.attackRunning ? [copy.attackRunning, next] : [next];
}

/** `rows` led by the siege lines, keeping the last answer while neither input changed so the goal
 *  panel sees the same list. */
export function createSiegeRows(): (
  rows: readonly MissionInfoRow[],
  lines: readonly string[] | null,
) => readonly MissionInfoRow[] {
  let lastRows: readonly MissionInfoRow[] | null = null;
  let lastLines: readonly string[] = [];
  let answer: readonly MissionInfoRow[] = [];
  return (rows, lines) => {
    if (lines === null) return rows;
    const same = lines.length === lastLines.length && lines.every((line, i) => line === lastLines[i]);
    if (rows !== lastRows || !same) {
      lastRows = rows;
      lastLines = lines;
      answer = [...lines.map((text): MissionInfoRow => ({ kind: 'text', text })), ...rows];
    }
    return answer;
  };
}
