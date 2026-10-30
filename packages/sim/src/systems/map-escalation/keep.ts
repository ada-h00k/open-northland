import type { MapEscalation } from '@open-northland/data';
import { Building, isPlayerDead, JobAssignment, Position } from '../../components/index.js';
import type { Entity, World } from '../../ecs/world.js';
import { type HalfCellNode, hexDistanceBetween, nodeOfPosition } from '../../nav/halfcell.js';
import { isBuilt, ownedBuildings, ownedSettlers } from '../ai-shared/seat-roster.js';
import type { SystemContext } from '../context.js';
import { removeSettlerSilently } from '../lifecycle/death.js';
import { spawnSettler } from '../spawn/index.js';

/** Make a man of the variant's tribe at the keep point for `owner`. */
export function spawnAtKeep(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  jobType: number,
  owner: number,
): Entity | null {
  return spawnSettler(world, ctx, {
    kind: 'spawnSettler',
    jobType,
    tribe: config.tribe,
    x: config.keep.x,
    y: config.keep.y,
    owner,
  });
}

/**
 * Make a man of the fortress seat at the keep point, posted to `workplace` (anchored on `anchor`). A man
 * the workplace will not take is removed again, so a refused post leaves nobody for the next beat to
 * add to. Null when nobody was posted.
 */
export function spawnPostedAtKeep(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  jobType: number,
  workplace: Entity,
  anchor: HalfCellNode,
): Entity | null {
  const e = spawnSettler(world, ctx, {
    kind: 'spawnSettler',
    jobType,
    tribe: config.tribe,
    x: config.keep.x,
    y: config.keep.y,
    owner: config.keep.seat,
    workplace: { x: anchor.hx, y: anchor.hy },
  });
  if (e === null) return null;
  if (world.tryGet(e, JobAssignment)?.workplace === workplace) return e;
  removeSettlerSilently(world, e);
  return null;
}

/** The fortress seat is still in the match and its keep stands. The raider seats launch on regardless:
 *  they never die, so a fallen fortress seat with its keep standing still sends its scheduled attacks. */
export function fortressHolds(world: World, config: MapEscalation): boolean {
  return !isPlayerDead(world, config.keep.seat) && keepStands(world, config);
}

/** A finished keep of the fortress seat stands within its range of the keep point. */
export function keepStands(world: World, config: MapEscalation): boolean {
  const { seat, houseType, x, y, range } = config.keep;
  for (const e of ownedBuildings(world, seat)) {
    if (world.get(e, Building).buildingType !== houseType || !isBuilt(world, e)) continue;
    const at = world.tryGet(e, Position);
    if (at === undefined) continue;
    const node = nodeOfPosition(at.x, at.y);
    if (hexDistanceBetween(node.hx, node.hy, x, y) < range) return true;
  }
  return false;
}

/**
 * The targets whose seat is occupied: it has people and the match has not counted it out. A lobby seat
 * left empty has none, and an idle computer seat's people count like any other's.
 */
export function occupiedTargets(world: World, config: MapEscalation): MapEscalation['attacks']['targets'] {
  return config.attacks.targets.filter(
    (target) => ownedSettlers(world, target.seat).length > 0 && !isPlayerDead(world, target.seat),
  );
}
