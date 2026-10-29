import {
  atPeace,
  endPeace,
  Owner,
  Position,
  peaceEndsAtTick,
  peacePartnerBits,
  playersOfBits,
  Settler,
} from '../../components/index.js';
import type { Command } from '../../core/commands/index.js';
import { TICKS_PER_SECOND } from '../../core/loop.js';
import type { Entity, World } from '../../ecs/world.js';
import { hexDistanceBetween, nodeOfPosition } from '../../nav/halfcell.js';
import { ownedBuildings } from '../ai-shared/seat-roster.js';
import type { System, SystemContext } from '../context.js';
import { isFighterJob } from '../readviews/jobs.js';

const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;

/** The match minutes before the end of a peace at which a `peaceEnding` notice fires. Project choice. */
const PEACE_NOTICE_MINUTES = [5, 1] as const;

/**
 * How near a peace partner's building a soldier may not be sent while the peace holds, in map points
 * (`hexDistance`) from the building's anchor: about ten cells. A project choice with no source, so an
 * army cannot camp at a partner's door to strike the tick the peace ends.
 */
export const PEACE_KEEP_OUT_RADIUS_NODES = 20;

/**
 * Ends the lobby peace at the head of its deadline tick, ahead of the commands, so no order or pass
 * of that tick still reads it, and announces the end in advance. One singleton read per tick.
 */
export const peaceSystem: System = (world, ctx) => {
  const until = peaceEndsAtTick(world);
  if (until === null) return;
  if (ctx.tick >= until) {
    endPeace(world);
    ctx.events.emit({ kind: 'peaceEnded' });
    return;
  }
  const left = until - ctx.tick;
  for (const minutesLeft of PEACE_NOTICE_MINUTES) {
    if (left === minutesLeft * TICKS_PER_MINUTE) ctx.events.emit({ kind: 'peaceEnding', minutesLeft });
  }
};

/** Whether a peace binds the owners of `a` and `b`; false when either has none. */
export function ownersAtPeace(world: World, a: Entity, b: Entity): boolean {
  const first = world.tryGet(a, Owner);
  const second = world.tryGet(b, Owner);
  return first !== undefined && second !== undefined && atPeace(world, first.player, second.player);
}

/**
 * Whether the peace refuses a walk order: a soldier or hero sent within {@link PEACE_KEEP_OUT_RADIUS_NODES}
 * of a building of a seat the peace binds its owner to. A civilian is never refused, and nobody is ever
 * kept from building. Scans the partners' building rosters, per order.
 */
export function peaceBarsWalk(world: World, ctx: SystemContext, command: Command): boolean {
  if (command.kind !== 'moveUnit' && command.kind !== 'attackMoveUnit') return false;
  const owner = world.tryGet(command.entity, Owner);
  if (owner === undefined) return false;
  const partners = peacePartnerBits(world, owner.player);
  if (partners === 0) return false;
  const settler = world.tryGet(command.entity, Settler);
  if (settler === undefined || !isFighterJob(ctx.content, settler.jobType)) return false;
  for (const partner of playersOfBits(partners)) {
    for (const building of ownedBuildings(world, partner)) {
      const at = world.tryGet(building, Position);
      if (at === undefined) continue;
      const { hx, hy } = nodeOfPosition(at.x, at.y);
      if (hexDistanceBetween(hx, hy, command.x, command.y) <= PEACE_KEEP_OUT_RADIUS_NODES) return true;
    }
  }
  return false;
}
