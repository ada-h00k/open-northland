import {
  buildSpriteScene,
  type DrawItem,
  type ResourceTypeBinding,
  resolveResourceDraw,
} from '@open-northland/render';
import { components, type Entity, Simulation } from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import { MINE_LEVELS, STONE_DEPOSIT_UNITS } from '../../../src/catalog/mining.js';
import { stateIndexForLevel } from '../../../src/content/object-gfx/objects.js';
import { sandboxContent } from '../../../src/game/sandbox/content/index.js';
import { spawnMapResources } from '../../../src/game/sandbox/map-spawn.js';
import { MINES, mineFixture, mineRecord } from '../../support/mine-deposit.js';

/**
 * A mined placement's deposit is sized by its own `[GfxLandscape]` record's `LogicMaximumValency`, and
 * that same count is its shrink ladder. Two things must hold, and this file pins both over one fixture:
 *
 *  - level L spawns exactly L units, so no authored level collapses onto a 1-unit deposit that is
 *    destroyed by its first mined ore before it can ever draw a shrink frame;
 *  - the ladder draws the same bob whichever layer owns the sprite. The static object layer picks a
 *    placement's `GfxFrames` state list by its authored `lmlv` level ({@link stateIndexForLevel}); once a
 *    settler first works the node the sprite pool takes over and picks from the sim's `MineDeposit` fill
 *    instead. A disagreement is a deposit visibly jumping state at the handover.
 *
 * The drawn-frame half crosses app and render, so neither package can pin it alone: spawn (app) →
 * snapshot (sim) → draw item (render) → frame (render), against the static layer's index (app).
 */

const { Resource, MineDeposit } = components;

/** The same record as a sprite-pool binding: per-good frames ordered empty→full (`state 1` first). */
function mineBinding(good: number, states: number): ResourceTypeBinding {
  return { byGood: { [good]: Array.from({ length: states }, (_, i) => (i + 1) * 10) }, default: 0 };
}

describe('a mined placement is sized by its own record', () => {
  it.each(MINES)('spawns a $states-state $id level L with exactly L units', ({ id, logicType, states }) => {
    const sim = new Simulation({ seed: 1, content: sandboxContent() });
    const { objects, ir } = mineFixture(id, logicType, states);

    spawnMapResources(sim, objects, ir);

    const spawned = [...sim.world.query(Resource)].map((e) => ({
      remaining: sim.world.get(e, Resource).remaining,
      initial: sim.world.get(e, MineDeposit).initial,
      levels: sim.world.get(e, MineDeposit).levels,
    }));
    expect(spawned).toEqual(
      Array.from({ length: states }, (_, i) => ({ remaining: i + 1, initial: states, levels: states })),
    );
  });

  it('keeps the catalog size for a record with no authored valency', () => {
    const sim = new Simulation({ seed: 1, content: sandboxContent() });
    const { objects, ir } = mineFixture('stone', 15, 4);
    const record = ir.landscapeGfx?.[0];
    if (record === undefined) throw new Error('missing fixture record');
    const { maxValency: _dropped, ...noValency } = record;

    spawnMapResources(sim, objects, { ...ir, landscapeGfx: [noValency] });

    const entity = [...sim.world.query(Resource)][0];
    if (entity === undefined) throw new Error('missing mined resource');
    expect(sim.world.get(entity, MineDeposit).initial).toBe(STONE_DEPOSIT_UNITS);
    expect(sim.world.get(entity, MineDeposit).levels).toBe(MINE_LEVELS);
  });
});

describe('the shrink ladder agrees between the static object layer and the sprite pool', () => {
  it.each(MINES)('draws the same frame at every level of a $states-state $id record', (mine) => {
    const sim = new Simulation({ seed: 1, content: sandboxContent() });
    const { objects, ir } = mineFixture(mine.id, mine.logicType, mine.states);
    const { placementByEntity } = spawnMapResources(sim, objects, ir);

    const record = mineRecord(mine.states);
    const binding = mineBinding(mine.good, mine.states);
    const drawn = new Map<number, DrawItem>();
    for (const item of buildSpriteScene(sim.snapshot())) {
      const placement = placementByEntity.get(item.ref as Entity);
      if (placement !== undefined) drawn.set(placement + 1, item);
    }

    expect(drawn.size).toBe(mine.states);
    for (const [level, item] of drawn) {
      const staticBob = record[stateIndexForLevel(level, mine.states)]?.bobIds[0];
      expect(resolveResourceDraw(binding, item)?.bob).toBe(staticBob);
    }
  });
});
