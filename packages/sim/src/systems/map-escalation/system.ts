import type { MapEscalation } from '@open-northland/data';
import {
  Building,
  isPlayerDead,
  mapEscalationProgress,
  Position,
  writeMapEscalation,
} from '../../components/index.js';
import { TICKS_PER_SECOND } from '../../core/loop.js';
import type { Entity, World } from '../../ecs/world.js';
import { hexDistanceBetween, nodeOfPosition } from '../../nav/halfcell.js';
import { isBuilt, ownedBuildings, ownedSettlers, soldierCount } from '../ai-shared/seat-roster.js';
import type { System, SystemContext } from '../context.js';
import { spawnSettler } from '../spawn/index.js';
import { apportion, attackEndsTick, guardCap, launchTick, refillMen, waveSize } from './schedule.js';

/** Ticks between two checks of whether the running attack's men are all dead. */
const END_CHECK_TICKS = TICKS_PER_SECOND;

/**
 * A map's escalating siege (`ctx.mapEscalation`): on each scheduled launch the fortress spawns a fresh
 * band at its keep for every occupied target seat, owned by the raider seat that targets it, and the
 * raider's own `[AIData]` Attack task marches it; the garrison is never drawn in. On each refill beat
 * it tops its own soldiers up toward a cap that grows with game time and the occupied seats. Nothing
 * spawns while no finished keep stands.
 */
export const mapEscalationSystem: System = (world, ctx) => {
  const config = ctx.mapEscalation;
  if (config === undefined) return;
  const progress = mapEscalationProgress(world);
  if (progress.attack !== null && ctx.tick % END_CHECK_TICKS === 0) checkAttackEnd(world, ctx, config);
  if (ctx.tick >= launchTick(config, progress.launches)) launch(world, ctx, config, progress.launches);
  const refill = refillMen(config, ctx.tick);
  if (refill > 0) refillGuard(world, ctx, config, refill);
};

/**
 * A seat is occupied while it has people and the match has not counted it out: a lobby seat left
 * empty has none, and an idle computer seat's people count like any other's.
 */
function isOccupiedSeat(world: World, seat: number): boolean {
  return ownedSettlers(world, seat).length > 0 && !isPlayerDead(world, seat);
}

function occupiedTargets(world: World, config: MapEscalation) {
  return config.attacks.targets.filter((target) => isOccupiedSeat(world, target.seat));
}

function launch(world: World, ctx: SystemContext, config: MapEscalation, index: number): void {
  const wave = index + 1;
  writeMapEscalation(world, (progress) => {
    progress.launches = wave;
  });
  if (!keepStands(world, config)) return;
  const jobs = apportion(config.jobMix, waveSize(config, index).landMen);
  const seats: number[] = [];
  const men: Entity[] = [];
  for (const target of occupiedTargets(world, config)) {
    seats.push(target.seat);
    men.push(...spawnAtKeep(world, ctx, config, jobs, target.raider));
  }
  if (men.length === 0) return;
  // A schedule that launches before the last attack ran out ends that one first.
  if (mapEscalationProgress(world).attack !== null) endAttack(world, ctx, 'expired');
  writeMapEscalation(world, (progress) => {
    progress.attack = { wave, launchedTick: ctx.tick, men: men.sort((a, b) => a - b) };
  });
  ctx.events.emit({ kind: 'mapEscalationAttackLaunched', wave, seats });
}

function checkAttackEnd(world: World, ctx: SystemContext, config: MapEscalation): void {
  const attack = mapEscalationProgress(world).attack;
  if (attack === null) return;
  const living = attack.men.filter((e) => world.isAlive(e));
  if (living.length === 0) {
    endAttack(world, ctx, 'defeated');
    return;
  }
  if (ctx.tick >= attackEndsTick(config, attack.launchedTick)) {
    endAttack(world, ctx, 'expired');
    return;
  }
  if (living.length === attack.men.length) return;
  writeMapEscalation(world, (progress) => {
    if (progress.attack !== null) progress.attack.men = living;
  });
}

/** `defeated`: every man it sent died; `expired`: its time ran out, and any survivors fight on. */
function endAttack(world: World, ctx: SystemContext, cause: 'defeated' | 'expired'): void {
  const attack = mapEscalationProgress(world).attack;
  if (attack === null) return;
  const wave = attack.wave;
  writeMapEscalation(world, (progress) => {
    progress.attack = null;
  });
  ctx.events.emit({ kind: 'mapEscalationAttackEnded', wave, cause });
}

function refillGuard(world: World, ctx: SystemContext, config: MapEscalation, men: number): void {
  if (!keepStands(world, config)) return;
  const seat = config.keep.seat;
  const cap = guardCap(config, ctx.tick, occupiedTargets(world, config).length);
  const room = cap - soldierCount(world, ctx.content, seat);
  if (room <= 0) return;
  spawnAtKeep(world, ctx, config, apportion(config.jobMix, Math.min(men, room)), seat);
}

function spawnAtKeep(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  jobs: readonly number[],
  owner: number,
): Entity[] {
  const spawned: Entity[] = [];
  for (const jobType of jobs) {
    const e = spawnSettler(world, ctx, {
      kind: 'spawnSettler',
      jobType,
      tribe: config.tribe,
      x: config.keep.x,
      y: config.keep.y,
      owner,
    });
    if (e !== null) spawned.push(e);
  }
  return spawned;
}

/** A finished keep of the fortress seat stands within its range of the keep point. */
function keepStands(world: World, config: MapEscalation): boolean {
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
