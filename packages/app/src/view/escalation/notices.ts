import type { SimEvent } from '@open-northland/sim';
import type { Messages } from '../../i18n/en.js';

export type SiegeNoticeId = keyof Messages['hud']['escalation']['notices'];

/** The first attack is the one announced; later launches come as the countdown says. */
const FIRST_WAVE = 1;

/** A variant's notice keys (`packages/data/src/map-variants`) by the notice the app shows for them. */
const NOTICE_BY_KEY: Readonly<Record<string, SiegeNoticeId>> = {
  'ragnarok.landing': 'landing',
  'ragnarok.gear.lightArmor': 'lightArmor',
  'ragnarok.gear.heavyArmor': 'heavyArmor',
  'ragnarok.gear.amulets': 'amulets',
  'ragnarok.gear.healDraughts': 'healDraughts',
};

/** The centre-screen notices a batch of sim events raises, in order; a key the app has no text for
 *  is reported through `unknown` and shows nothing. */
export function siegeNoticesOf(
  events: readonly SimEvent[],
  unknown: (noticeKey: string) => void,
): SiegeNoticeId[] {
  const out: SiegeNoticeId[] = [];
  const byKey = (noticeKey: string): void => {
    const id = NOTICE_BY_KEY[noticeKey];
    if (id === undefined) unknown(noticeKey);
    else out.push(id);
  };
  for (const event of events) {
    switch (event.kind) {
      case 'mapEscalationAttackLaunched':
        if (event.wave === FIRST_WAVE) out.push('attack');
        break;
      case 'mapEscalationGearStep':
      case 'mapEscalationLanding':
        byKey(event.noticeKey);
        break;
      default:
        break;
    }
  }
  return out;
}

/** How long one notice stands, fade in and out included; foundation.css animates over the same. */
export const NOTICE_SHOWN_MS = 5000;

/** Notices shown one at a time, each for {@link NOTICE_SHOWN_MS}, the rest waiting in order. */
export class NoticeQueue<T> {
  private readonly waiting: T[] = [];
  private shown: { readonly notice: T; readonly sinceMs: number } | null = null;

  /** Queue `notice`, unless the same one already waits. */
  push(notice: T): void {
    if (!this.waiting.includes(notice)) this.waiting.push(notice);
  }

  /** The notice standing at `nowMs`, null while none waits. */
  current(nowMs: number): T | null {
    if (this.shown !== null && nowMs - this.shown.sinceMs >= NOTICE_SHOWN_MS) this.shown = null;
    if (this.shown === null) {
      const next = this.waiting.shift();
      if (next !== undefined) this.shown = { notice: next, sinceMs: nowMs };
    }
    return this.shown?.notice ?? null;
  }
}
