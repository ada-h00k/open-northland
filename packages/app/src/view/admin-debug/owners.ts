import { playerSwatchHex } from '../../catalog/roster.js';
import type { AdminOwner } from '../../hud/dom/admin-panel/model.js';

/** The slots the picker lists when the session names no roster, as in a scene or the sandbox. */
export const UNROSTERED_SEAT_COUNT = 8;

/** A seat's number as the lobby shows it: one-based slot order. */
export function seatSlotNumber(player: number): number {
  return player + 1;
}

/** One picker entry per seat in slot order, painted with the colour that seat wears in the game,
 *  which the lobby may have changed from its slot's default. */
export function adminOwners(
  players: readonly number[],
  colourOf: (player: number) => number,
  name: (player: number) => string,
): readonly AdminOwner[] {
  const seats =
    players.length > 0 ? players : Array.from({ length: UNROSTERED_SEAT_COUNT }, (_, slot) => slot);
  return [...new Set(seats)]
    .sort((a, b) => a - b)
    .map((player) => ({
      player,
      slot: seatSlotNumber(player),
      css: playerSwatchHex(colourOf(player)),
      name: name(player),
    }));
}
