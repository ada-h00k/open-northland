import {
  atPeace,
  endPeace,
  Owner,
  peaceHoldsUntilTick,
  peacePartnerBits,
  Settler,
  Vehicle,
} from '../../components/index.js';
import type { Command } from '../../core/commands/index.js';
import { TICKS_PER_MINUTE } from '../../core/loop.js';
import type { Entity, World } from '../../ecs/world.js';
import { hexDistanceBetween } from '../../nav/halfcell.js';
import { vehicleWeapon } from '../conflict/weapons.js';
import type { System, SystemContext } from '../context.js';
import { isFighterJob } from '../readviews/jobs.js';
import { forEachBuildingNear } from '../spatial/buildings.js';
import { commandedVehicleOf } from '../vehicles/commander.js';

/** The match minutes before the end of a peace at which a `peaceEnding` notice fires. Project choice. */
const PEACE_NOTICE_MINUTES = [5, 1] as const;

/**
 * How near a peace partner's building an armed unit may not be sent while the peace holds, in map points
 * (`hexDistance`) from the building's anchor: about ten cells. A project choice with no source, so an
 * army cannot camp at a partner's door to strike the tick the peace ends.
 */
export const PEACE_KEEP_OUT_RADIUS_NODES = 20;

/**
 * Ends the lobby peace at the head of its deadline tick, ahead of the commands, so no order or pass
 * of that tick still reads it, and announces the end in advance. One singleton read per tick.
 */
export const peaceSystem: System = (world, ctx) => {
  const until = peaceHoldsUntilTick(world);
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

/** A walk or drive order's unit and destination node; null for any other order. */
function orderedMove(
  command: Command,
): { readonly unit: Entity; readonly x: number; readonly y: number } | null {
  switch (command.kind) {
    case 'moveUnit':
    case 'attackMoveUnit':
      return { unit: command.entity, x: command.x, y: command.y };
    case 'moveVehicle':
      return { unit: command.vehicle, x: command.x, y: command.y };
    default:
      return null;
  }
}

/** Whether a move of `unit` sends arms: a soldier or hero walking, or a vehicle with a weapon driving, which
 *  its commander's walk order drives. A civilian, a cart and a transport ship carry none. */
function sendsArms(world: World, ctx: SystemContext, unit: Entity): boolean {
  const driven = world.has(unit, Vehicle) ? unit : commandedVehicleOf(world, unit);
  if (driven !== null) {
    const state = world.tryGet(driven, Vehicle);
    return state !== undefined && vehicleWeapon(ctx, state) !== null;
  }
  const settler = world.tryGet(unit, Settler);
  return settler !== undefined && isFighterJob(ctx.content, settler.jobType);
}

export interface PeaceRefusal {
  readonly player: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The seat whose order the peace refuses and where it was sent, or null when the order goes: arms
 * ({@link sendsArms}) sent within {@link PEACE_KEEP_OUT_RADIUS_NODES} of a building of a seat the peace
 * binds their owner to, foundations included, and nearer that building than every building of their own
 * seat. Own ground always wins, so a partner's foundation dropped inside a town never shuts its owner out.
 * Nobody is ever kept from building, and no route is blocked, only the order.
 * Cost per order: the buildings anchored in the region-index box of the radius around the destination,
 * at most nine regions, never a seat's whole roster.
 */
export function peaceRefusal(world: World, ctx: SystemContext, command: Command): PeaceRefusal | null {
  const move = orderedMove(command);
  if (move === null) return null;
  const owner = world.tryGet(move.unit, Owner);
  if (owner === undefined) return null;
  const partners = peacePartnerBits(world, owner.player);
  if (partners === 0 || !sendsArms(world, ctx, move.unit)) return null;
  const { x, y } = move;
  // A building outside the box lies past the radius, so it can neither bar the node nor beat a partner's
  // building that does.
  let nearestPartner = Infinity;
  let nearestOwn = Infinity;
  forEachBuildingNear(world, x, y, PEACE_KEEP_OUT_RADIUS_NODES, (building, hx, hy) => {
    const seat = world.tryGet(building, Owner)?.player;
    if (seat === undefined) return;
    const distance = hexDistanceBetween(hx, hy, x, y);
    if (seat === owner.player) nearestOwn = Math.min(nearestOwn, distance);
    else if ((partners & (1 << seat)) !== 0) nearestPartner = Math.min(nearestPartner, distance);
  });
  return nearestPartner <= PEACE_KEEP_OUT_RADIUS_NODES && nearestPartner < nearestOwn
    ? { player: owner.player, x, y }
    : null;
}
