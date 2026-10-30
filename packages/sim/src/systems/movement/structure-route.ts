import type { World } from '../../ecs/world.js';
import type { BlockOverlay } from '../../nav/block-overlay.js';
import { findPath } from '../../nav/pathfinding/index.js';
import { type NodeId, StepBuffer, type TerrainGraph } from '../../nav/terrain/index.js';
import type { ContentContext } from '../context.js';
import { routeRegions } from '../footprint/route-regions.js';
import { walkBlockMask } from '../footprint/walk-block-mask.js';
import { GroupReachability } from './group-reachability.js';

/** Overlays the shared regions keep per walk-block version: every answer here is exact whatever is held. */
const MAX_HELD_OVERLAYS = 8;

const regions = new WeakMap<World, { terrain: TerrainGraph; reachability: GroupReachability }>();

function regionsOf(world: World, terrain: TerrainGraph): GroupReachability {
  let held = regions.get(world);
  if (held === undefined || held.terrain !== terrain) {
    held = { terrain, reachability: new GroupReachability(terrain, MAX_HELD_OVERLAYS) };
    regions.set(world, held);
  }
  return held.reachability;
}

/** Whether a combat queue may occupy `node`: walkable ground outside closed gates and other structural
 * blocks. */
export function structureStandable(
  world: World,
  ctx: ContentContext,
  terrain: TerrainGraph,
  node: NodeId,
  blocked?: BlockOverlay,
): boolean {
  blocked ??= walkBlockMask(world, ctx, terrain).levelled();
  return regionsOf(world, terrain).standable(blocked, node);
}

/** Whether `a` and `b` are both {@link structureStandable} and joined by connected ground around
 * structures. */
export function structureSameRegion(
  world: World,
  ctx: ContentContext,
  terrain: TerrainGraph,
  a: NodeId,
  b: NodeId,
  blocked?: BlockOverlay,
): boolean {
  const mask = walkBlockMask(world, ctx, terrain);
  blocked ??= mask.levelled();
  return regionsOf(world, terrain).sameRegion(mask, blocked, a, b);
}

/** Exact structural refusals shared by chasers and wall breakers. A closed gate's region is exhausted
 * once for the army, and forgotten as soon as any walk block changes. Unit bodies are not part of it. */
export function structureRouteSealed(
  world: World,
  ctx: ContentContext,
  terrain: TerrainGraph,
  start: NodeId,
  goal: NodeId,
  blocked?: BlockOverlay,
): boolean {
  const mask = walkBlockMask(world, ctx, terrain);
  blocked ??= mask.levelled();
  const reachability = regionsOf(world, terrain);
  if (reachability.unreachable(mask, blocked, start, goal)) return true;
  if (findPath(terrain, start, goal, blocked) !== null) return false;
  reachability.rememberFailure(mask, blocked, start, goal);
  return true;
}

/** Default half-width, in nodes, of the box around a click whose walls {@link clickSides} looks for.
 *  Authored: wider than the ring a single walker's goal search covers around its click. */
export const CLICK_SIDES_RADIUS = 16;

/** The sides structures cut around one clicked node, for picking a walker's goal on its own side. */
export interface ClickSides {
  /** Whether structures part the box into sides some walker may not reach. */
  readonly split: boolean;
  /** Whether `node` lies inside the box, where {@link reaches} judges it. */
  contains(node: NodeId): boolean;
  /** Whether `node` lies on a side of the box joined to `from` around structures. True for a node outside
   *  the box or off standable ground, and for every node when no structure splits the box. */
  reaches(from: NodeId, node: NodeId): boolean;
  /** One string per set of box sides `from` reaches, so walkers keyed alike take goals alike. */
  keyOf(from: NodeId): string;
}

/**
 * Label the standable ground in a box around `center` by local connection, then sort the pieces into
 * classes joined around structures. A proven sealed pocket stays apart, judged by the route-region proof;
 * every other piece joins the first class it meets, searched from its neighbours in the box, so clutter
 * that joins just outside the box costs short searches. Only a box split into two or more classes, as by
 * a wall or closed gate, asks {@link structureSameRegion} from each walker, once per class.
 */
export function clickSides(
  world: World,
  ctx: ContentContext,
  terrain: TerrainGraph,
  center: NodeId,
  blocked?: BlockOverlay,
  radius = CLICK_SIDES_RADIUS,
): ClickSides {
  blocked ??= walkBlockMask(world, ctx, terrain).levelled();
  const cx = terrain.xOf(center);
  const cy = terrain.yOf(center);
  const inBox = (node: NodeId): boolean =>
    Math.abs(terrain.xOf(node) - cx) <= radius && Math.abs(terrain.yOf(node) - cy) <= radius;
  const pieceOf = new Map<NodeId, number>();
  const seeds: NodeId[] = [];
  const queue: NodeId[] = [];
  const steps = new StepBuffer();
  const reg = regionsOf(world, terrain);
  for (let y = Math.max(0, cy - radius); y <= Math.min(terrain.height - 1, cy + radius); y++)
    for (let x = Math.max(0, cx - radius); x <= Math.min(terrain.width - 1, cx + radius); x++) {
      const seed = terrain.nodeAt(x, y);
      if (pieceOf.has(seed) || !reg.standable(blocked, seed)) continue;
      const piece = seeds.length;
      seeds.push(seed);
      pieceOf.set(seed, piece);
      queue.length = 0;
      queue.push(seed);
      for (let head = 0; head < queue.length; head++) {
        terrain.stepsInto(queue[head] as NodeId, blocked, steps);
        for (let i = 0; i < steps.length; i++) {
          const next = steps.at(i).node;
          if (pieceOf.has(next) || !inBox(next)) continue;
          pieceOf.set(next, piece);
          queue.push(next);
        }
      }
    }
  if (seeds.length <= 1) return { split: false, contains: inBox, reaches: () => true, keyOf: () => '' };
  const pockets = routeRegions(world, ctx, terrain);
  /** classOf[piece]: the piece's class, or -1 for a proven sealed pocket. */
  const classOf: number[] = [];
  const classSeeds: NodeId[] = [];
  for (const seed of seeds) {
    if (pockets.pocketed(seed)) {
      classOf.push(-1);
      continue;
    }
    let joined = classSeeds.findIndex((rep) => structureSameRegion(world, ctx, terrain, rep, seed, blocked));
    if (joined < 0) {
      joined = classSeeds.length;
      classSeeds.push(seed);
    }
    classOf.push(joined);
  }
  const verdicts = new Map<NodeId, readonly boolean[]>();
  const verdictsOf = (from: NodeId): readonly boolean[] => {
    let held = verdicts.get(from);
    if (held === undefined) {
      const own = pieceOf.get(from);
      const ownClass = own === undefined ? -1 : (classOf[own] ?? -1);
      // One class needs no long search: the pocket proof alone tells a walker sealed elsewhere apart.
      const classReached = classSeeds.map((rep, c) =>
        c === ownClass || classSeeds.length === 1
          ? !pockets.unroutable(from, rep)
          : structureSameRegion(world, ctx, terrain, from, rep, blocked),
      );
      held = seeds.map((seed, piece) => {
        if (piece === own) return true;
        const c = classOf[piece] ?? -1;
        return c < 0 ? !pockets.unroutable(from, seed) : classReached[c] === true;
      });
      verdicts.set(from, held);
    }
    return held;
  };
  return {
    split: classSeeds.length > 1 || classOf.includes(-1),
    contains: inBox,
    reaches: (from, node) => {
      const piece = pieceOf.get(node);
      return piece === undefined || verdictsOf(from)[piece] === true;
    },
    keyOf: (from) =>
      verdictsOf(from)
        .map((joined) => (joined ? '1' : '0'))
        .join(''),
  };
}
