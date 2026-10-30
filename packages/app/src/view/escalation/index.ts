import type { SimEvent } from '@open-northland/sim';
import { diag } from '../../diag/index.js';
import type { MissionInfoRow } from '../../game/map/info-lines.js';
import { createCentreNotice } from '../../hud/dom/centre-notice.js';
import { messages } from '../../i18n/index.js';
import type { SessionHost } from '../../session/index.js';
import { createSiegeRows, siegeCountdownLines } from './countdown.js';
import { NOTICE_SHOWN_MS, NoticeQueue, type SiegeNoticeId, siegeNoticesOf } from './notices.js';

const DIAG_CHANNEL = 'escalation';

const warnUnknown = (noticeKey: string): void => diag.warn(DIAG_CHANNEL, `no notice text for ${noticeKey}`);

export interface SiegePresentationDeps {
  readonly host: Pick<SessionHost, 'mapEscalation'>;
  readonly plane: HTMLElement;
  /** The world renderer's attack night. */
  readonly setAttackNight: (on: boolean) => void;
  /** The goal slip's mode mark. */
  readonly setModeMark: (text: string | null) => void;
  /** Plays the attack's music once, unless it is still playing. */
  readonly playAttackMusic: () => void;
  readonly now: () => number;
}

/** How a map variant's siege shows: the mode mark on the goal slip, its centre-screen notices, the music and the night of an
 *  attack, and the countdown lines at the head of the goal panel's rows. */
export interface SiegePresentation {
  onEvents(events: readonly SimEvent[]): void;
  /** Once a frame. */
  frame(): void;
  /** The goal panel's `rows` at `tick`, led by the countdown on a map with a siege. */
  infoRows(rows: readonly MissionInfoRow[], tick: number): readonly MissionInfoRow[];
  dispose(): void;
}

export function mountSiegePresentation(deps: SiegePresentationDeps): SiegePresentation {
  const queue = new NoticeQueue<SiegeNoticeId>();
  const banner = createCentreNotice(deps.plane, NOTICE_SHOWN_MS);
  const siegeRows = createSiegeRows();
  let night = false;
  let marked = false;
  return {
    onEvents(events) {
      for (const id of siegeNoticesOf(events, warnUnknown)) queue.push(id);
      if (events.some((event) => event.kind === 'mapEscalationAttackLaunched')) deps.playAttackMusic();
    },
    frame() {
      const view = deps.host.mapEscalation();
      if ((view !== null) !== marked) {
        marked = view !== null;
        deps.setModeMark(marked ? messages().hud.escalation.modeMark : null);
      }
      const running = view?.attackRunning === true;
      if (running !== night) {
        night = running;
        deps.setAttackNight(running);
      }
      const id = queue.current(deps.now());
      banner.show(id === null ? null : messages().hud.escalation.notices[id]);
    },
    infoRows(rows, tick) {
      const lines = siegeCountdownLines(deps.host.mapEscalation(), tick, messages().hud.escalation);
      return siegeRows(rows, lines);
    },
    dispose() {
      banner.dispose();
      deps.setAttackNight(false);
    },
  };
}
