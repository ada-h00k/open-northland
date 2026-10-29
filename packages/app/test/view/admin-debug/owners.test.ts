import { describe, expect, it } from 'vitest';
import { playerSwatchHex } from '../../../src/catalog/roster.js';
import { adminOwners, UNROSTERED_SEAT_COUNT } from '../../../src/view/admin-debug/owners.js';

const RED = 1;
const ORANGE = 7;
const NEON = 8;
/** Seat to colour as a lobby roster can leave it: no seat wears its own slot's colour. */
const WORN: ReadonlyMap<number, number> = new Map([
  [0, ORANGE],
  [2, RED],
  [5, NEON],
]);
const colourOf = (player: number): number => WORN.get(player) ?? player;

describe('adminOwners', () => {
  it('paints each seat with the colour it wears, in slot order with lobby slot numbers', () => {
    const owners = adminOwners([5, 0, 2], colourOf, (player) => `seat ${player}`);
    expect(owners).toEqual([
      { player: 0, slot: 1, css: playerSwatchHex(ORANGE), name: 'seat 0' },
      { player: 2, slot: 3, css: playerSwatchHex(RED), name: 'seat 2' },
      { player: 5, slot: 6, css: playerSwatchHex(NEON), name: 'seat 5' },
    ]);
  });

  it('lists the first slots in their own colours without a roster', () => {
    const owners = adminOwners([], (player) => player, String);
    expect(owners.map((owner) => owner.player)).toEqual([...Array(UNROSTERED_SEAT_COUNT).keys()]);
    expect(owners[RED]?.css).toBe(playerSwatchHex(RED));
  });
});
