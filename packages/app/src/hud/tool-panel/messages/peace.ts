import { type HalfCellNode, TICKS_PER_MINUTE } from '@open-northland/sim';
import type { MessageNaming, RaisedMessage } from './raise.js';
import { type PeaceRefusedOrder, USER_MESSAGE_TYPE } from './types.js';

/** The lobby peace's note: it holds `minutesLeft` more minutes, or, with null, it has ended. About the
 *  minutes, so the start note and each warning stand as their own cards. */
export function peaceNote(minutesLeft: number | null, naming: Pick<MessageNaming, 'text'>): RaisedMessage {
  const type = minutesLeft === null ? USER_MESSAGE_TYPE.peaceEnded : USER_MESSAGE_TYPE.peaceEnding;
  return {
    pending: {
      type,
      subject: null,
      at: null,
      about: minutesLeft,
      goodType: null,
      technologies: null,
      jobType: null,
    },
    compose: () =>
      naming.text(type, {
        subjectName: null,
        jobLabel: null,
        goodName: null,
        stanceName: null,
        ...(minutesLeft === null ? {} : { minutesLeft }),
      }),
  };
}

/** The note that the peace held back the player's order to send someone to `at`, or to build there, by a
 *  peace partner's settlement. One card per kind of order stands for every such refusal while it shows,
 *  wherever the order went. */
export function peaceRefusalNote(
  at: HalfCellNode | null,
  what: PeaceRefusedOrder,
  naming: Pick<MessageNaming, 'text'>,
): RaisedMessage {
  const type = USER_MESSAGE_TYPE.peaceRefused;
  return {
    pending: { type, subject: null, at, about: null, goodType: null, technologies: null, jobType: null },
    compose: () =>
      naming.text(type, {
        subjectName: null,
        jobLabel: null,
        goodName: null,
        stanceName: null,
        peaceOrder: what,
      }),
  };
}

/** The whole minutes a peace ending at `endsAt` still holds at `tick`, a started minute counted. */
export function peaceMinutesLeft(endsAt: number, tick: number): number {
  return Math.ceil((endsAt - tick) / TICKS_PER_MINUTE);
}
