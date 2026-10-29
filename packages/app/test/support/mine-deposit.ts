import type { ContentIr } from '../../src/content/ir/rows.js';
import { GOOD_GOLD, GOOD_STONE } from '../../src/game/sandbox/ids/index.js';

/** Mined goods against the `LogicMaximumValency` and `[landscapetype]` their real `ls_ground` records
 *  author: stone's 4-unit rock, and gold's 5-unit mine, a ladder that disagreed while a deposit was
 *  sized from the catalog instead. */
export const MINES = [
  { id: 'stone', good: GOOD_STONE, logicType: 15, states: 4 },
  { id: 'gold', good: GOOD_GOLD, logicType: 21, states: 5 },
];

/** One `[GfxLandscape]` mine record of `states` units: `GfxFrames` lists highest-first (the file order),
 *  one distinct bob per state, matching the real `ls_ground` deposit records. */
export function mineRecord(states: number) {
  return Array.from({ length: states }, (_, i) => ({ state: states - i, bobIds: [(states - i) * 10] }));
}

/** The record placed once per authored level 1..states, so placement ordinal i is level i + 1. */
export function mineFixture(id: string, logicType: number, states: number) {
  const levels = Array.from({ length: states }, (_, i) => i + 1);
  const editName = `${id} ladder node`;
  return {
    objects: { types: [editName], placements: levels.flatMap((_, i) => [2 * i + 2, 4, 0]), levels },
    ir: {
      landscapeGfx: [{ index: 50, editName, logicType, maxValency: states, frames: mineRecord(states) }],
      // `goodType` is the IR's own numbering, which this join ignores - it bridges on `goodId`.
      gatheringPipeline: [
        { goodType: 0, goodId: id, harvest: { landscapeType: logicType, gfxIndices: [50] } },
      ],
    } satisfies ContentIr,
  };
}
