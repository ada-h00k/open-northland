import type { MapEscalation } from '@open-northland/data';
import {
  AttackOrder,
  Building,
  Engagement,
  type MapEscalationFocusRecord,
  mapEscalationProgress,
  Owner,
  Person,
  Position,
  Rider,
  writeMapEscalation,
} from '../../components/index.js';
import { aiCommand } from '../../core/commands/index.js';
import type { DeepReadonly, Entity, World } from '../../ecs/world.js';
import { type HalfCellNode, hexDistanceBetween, nodeOfPosition } from '../../nav/halfcell.js';
import { isBuilt, ownedBuildings, ownedSettlers } from '../ai-shared/seat-roster.js';
import type { SystemContext } from '../context.js';
import { houseFootprintOf, translatedCells } from '../footprint/geometry.js';

type Target = MapEscalation['attacks']['targets'][number];
type Focus = Pick<MapEscalationFocusRecord, 'kind' | 'entity'>;

// Each targeted seat's aim. While its headquarters stands the raider's own Attack task marches the men
// on it. Once it falls the aim moves to a random other building of the seat, re-drawn when that one
// falls, and once none stands to one of its people nearest the attack's men; the escalation orders
// those men onto it itself. The aim costs its seat's rosters only when it moves.

/**
 * Re-aim every seat whose aim fell and order the attack's men of every seat aimed past its headquarters
 * onto the aim. `men` are the running attack's living men. A man already fighting is left to it.
 */
export function focusTurn(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  men: readonly Entity[],
): void {
  const bySeat = menByTarget(world, config, men);
  if (bySeat.size === 0) return;
  const held = mapEscalationProgress(world).focus;
  const next: MapEscalationFocusRecord[] = [];
  let changed = false;
  for (const target of config.attacks.targets) {
    const own = held.find((record) => record.seat === target.seat);
    const band = bySeat.get(target.seat);
    if (band === undefined) {
      if (own !== undefined) next.push({ ...own });
      continue;
    }
    const aim =
      own !== undefined && stands(world, target.seat, own) ? own : pickFocus(world, ctx, target, own, band);
    if (aim !== (own ?? null)) changed = true;
    if (aim === null) continue;
    next.push({ seat: target.seat, kind: aim.kind, entity: aim.entity });
    if (aim.kind !== 'headquarters') orderOnto(world, ctx, target.raider, band, aim.entity);
  }
  if (!changed) return;
  writeMapEscalation(world, (progress) => {
    progress.focus = next;
  });
}

/** The living men standing on the map, by the seat their raider targets. */
function menByTarget(world: World, config: MapEscalation, men: readonly Entity[]): Map<number, Entity[]> {
  const seatOf = new Map(config.attacks.targets.map((target) => [target.raider, target.seat]));
  const out = new Map<number, Entity[]>();
  for (const e of men) {
    if (!world.has(e, Position) || world.has(e, Rider)) continue;
    const raider = world.tryGet(e, Owner)?.player;
    const seat = raider === undefined ? undefined : seatOf.get(raider);
    if (seat === undefined) continue;
    const band = out.get(seat);
    if (band === undefined) out.set(seat, [e]);
    else band.push(e);
  }
  return out;
}

/** Whether the aim is still the seat's: its building, or its living person. */
function stands(world: World, seat: number, aim: DeepReadonly<Focus>): boolean {
  if (!world.isAlive(aim.entity) || world.tryGet(aim.entity, Owner)?.player !== seat) return false;
  return aim.kind === 'person' ? world.has(aim.entity, Person) : world.has(aim.entity, Building);
}

/**
 * The seat's next aim: its headquarters, the building on the target point, on the first look; then a
 * random finished building, else a random site; else the seat's person nearest the band. Null for a
 * seat with nothing left.
 */
function pickFocus(
  world: World,
  ctx: SystemContext,
  target: Target,
  previous: DeepReadonly<Focus> | undefined,
  band: readonly Entity[],
): Focus | null {
  const buildings = ownedBuildings(world, target.seat).filter((e) => world.has(e, Position));
  if (previous === undefined) {
    const headquarters = buildingOnPoint(world, ctx, buildings, target);
    if (headquarters !== null) return { kind: 'headquarters', entity: headquarters };
  }
  const finished = buildings.filter((e) => isBuilt(world, e));
  const pool = finished.length > 0 ? finished : buildings;
  const drawn = pool.length === 0 ? undefined : pool[ctx.rng.int(pool.length)];
  if (drawn !== undefined) return { kind: 'building', entity: drawn };
  const person = nearestPerson(world, target.seat, bandCentre(world, band));
  return person === null ? null : { kind: 'person', entity: person };
}

/** The seat's building whose body covers the target point or whose anchor is on it, the way the
 *  raider's Attack task finds the house it attacks. */
function buildingOnPoint(
  world: World,
  ctx: SystemContext,
  buildings: readonly Entity[],
  point: { x: number; y: number },
): Entity | null {
  const terrain = ctx.terrain;
  if (terrain === undefined || !terrain.inBounds(point.x, point.y)) return null;
  const node = terrain.nodeAt(point.x, point.y);
  for (const e of buildings) {
    const at = pointOf(world, e);
    if (at.hx === point.x && at.hy === point.y) return e;
    const cells = houseFootprintOf(ctx.content, world.get(e, Building))?.blocked ?? [];
    if (translatedCells(terrain, cells, at.hx, at.hy).includes(node)) return e;
  }
  return null;
}

function bandCentre(world: World, band: readonly Entity[]): HalfCellNode {
  let hx = 0;
  let hy = 0;
  for (const e of band) {
    const at = pointOf(world, e);
    hx += at.hx;
    hy += at.hy;
  }
  return { hx: Math.trunc(hx / band.length), hy: Math.trunc(hy / band.length) };
}

/** The seat's person standing nearest `from`, the lower id on a tie. */
function nearestPerson(world: World, seat: number, from: HalfCellNode): Entity | null {
  let best: Entity | null = null;
  let closest = Number.POSITIVE_INFINITY;
  for (const e of ownedSettlers(world, seat)) {
    if (!world.has(e, Position)) continue;
    const at = pointOf(world, e);
    const d = hexDistanceBetween(from.hx, from.hy, at.hx, at.hy);
    if (d < closest) {
      closest = d;
      best = e;
    }
  }
  return best;
}

/** An attack order onto the aim for every man not fighting and not already on it, issued as the
 *  raider's map-AI order, so its own turn leaves a man on it to the attack. */
function orderOnto(
  world: World,
  ctx: SystemContext,
  raider: number,
  band: readonly Entity[],
  aim: Entity,
): void {
  for (const e of band) {
    if (world.has(e, Engagement) || world.tryGet(e, AttackOrder)?.target === aim) continue;
    ctx.commands.enqueue(aiCommand(raider, { kind: 'attackUnit', entity: e, target: aim }, 'map-ai'));
  }
}

function pointOf(world: World, e: Entity): HalfCellNode {
  const at = world.get(e, Position);
  return nodeOfPosition(at.x, at.y);
}
