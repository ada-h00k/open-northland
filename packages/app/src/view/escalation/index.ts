import type { SimEvent } from '@open-northland/sim';
import { diag } from '../../diag/index.js';
import type { MissionInfoRow } from '../../game/map/info-lines.js';
import { createCentreNotice } from '../../hud/dom/centre-notice.js';
import { messages } from '../../i18n/index.js';
import type { SessionHost } from '../../session/index.js';
import { createSiegeRows, siegeCountdownText } from './countdown.js';
import { NOTICE_SHOWN_MS, NoticeQueue, type SiegeNoticeId, siegeNoticesOf } from './notices.js';

const DIAG_CHANNEL = 'escalation';

const warnUnknown = (noticeKey: string): void => diag.warn(DIAG_CHANNEL, `no notice text for ${noticeKey}`);

export interface SiegePresentationDeps {
  readonly host: Pick<SessionHost, 'mapEscalation'>;
  readonly plane: HTMLElement;
  /** The world renderer's alarm grade. */
  readonly setAlarm: (on: boolean) => void;
  readonly now: () => number;
}

/** How a map variant's siege shows: its centre-screen notices, the red alarm grade while an attack
 *  runs, and the countdown line at the head of the goal panel's rows. */
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
  let alarm = false;
  return {
    onEvents(events) {
      for (const id of siegeNoticesOf(events, warnUnknown)) queue.push(id);
    },
    frame() {
      const running = deps.host.mapEscalation()?.attackRunning === true;
      if (running !== alarm) {
        alarm = running;
        deps.setAlarm(running);
      }
      const id = queue.current(deps.now());
      banner.show(id === null ? null : messages().hud.escalation.notices[id]);
    },
    infoRows(rows, tick) {
      const line = siegeCountdownText(deps.host.mapEscalation(), tick, messages().hud.escalation);
      return siegeRows(rows, line);
    },
    dispose() {
      banner.dispose();
      deps.setAlarm(false);
    },
  };
}
