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

/** The goal panel's siege line at `tick`, on game time so it follows the speed and the pause; null
 *  on a map without a siege. */
export function siegeCountdownText(
  view: MapEscalationView | null,
  tick: number,
  copy: CountdownCopy,
): string | null {
  if (view === null) return null;
  if (view.attackRunning) return copy.attackRunning;
  const time = formatCountdown((view.nextAttackTick - tick) / TICKS_PER_SECOND);
  return formatMessage(copy.nextAttack, { time });
}

/** `rows` led by the siege line, keeping the last answer while neither input changed so the goal
 *  panel sees the same list. */
export function createSiegeRows(): (
  rows: readonly MissionInfoRow[],
  line: string | null,
) => readonly MissionInfoRow[] {
  let lastRows: readonly MissionInfoRow[] | null = null;
  let lastLine: string | null = null;
  let answer: readonly MissionInfoRow[] = [];
  return (rows, line) => {
    if (line === null) return rows;
    if (rows !== lastRows || line !== lastLine) {
      lastRows = rows;
      lastLine = line;
      answer = [{ kind: 'text', text: line }, ...rows];
    }
    return answer;
  };
}
