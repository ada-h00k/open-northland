import { colonyHeldShips } from '../ai-shared/home-roster.js';
import {
  FerryPassenger,
  FerryVoyage,
  type FerryVoyageState,
  TradeShip,
  type VehicleStateView,
  VehicleDrive,
  hasFreeSeat,
  ownerOf,
  Position,
  Rider,
  Settler,
  Vehicle,
  vehicleCommander,
} from '../../components/index.js';
import { contentIndex } from '../../core/content-index.js';
import { type DeepReadonly, type Entity, type World } from '../../ecs/world.js';
import { hexDistanceBetween } from '../../nav/halfcell.js';
import { NO_COMPONENT, type NodeId, type TerrainGraph } from '../../nav/terrain/index.js';
import type { System, SystemContext } from '../context.js';
import { stopAtNextNode } from '../movement/nav-state.js';
import { isScoutJob } from '../readviews/jobs.js';
import { isShipVehicle } from '../readviews/vehicles.js';
import { markLostWay } from '../settlers/lost-way.js';
import { entityNode } from '../spatial/nodes.js';
import {
  attachToVehicle,
  boardVehicle,
  detachFromVehicle,
  doorReachable,
  landingOf,
} from './crew.js';
import { dockRoute, dockVehicle, mooringSpotsOf } from './dock.js';
import { nodeOf } from './movement.js';
import { vehicleIndex } from './registry.js';

// The ferryman: a move order whose goal lies across open water is no walk, so with the owner's idle
// ship lying at a shore of this island with a scout aboard, the settler sails instead. It walks to the
// door, boards, and the ship docks at a shore of the target island nearest the clicked spot, where the
// riders step off and walk on to their spots; the empty ship then sails back to the mooring the
// crossing booked it at. The pieces are the crew's attach and board, the dock order's sail and moor,
// and the rider rung's held leaving; this file only books the crossing, flips it from boarding to
// sailing, sails it home, and reads it over.

/**
 * Book `e`, standing on its island, the crossing to `goal` on another one: the nearest idle ship of
 * `e`'s owner moored at a shore of this island with a scout aboard takes the booking, `e` walks to its
 * door and boards, and the ship sails once every passenger is inside. False, leaving the order to the
 * caller's ordinary refusal, when the goal is no island away or no ship qualifies.
 */
export function tryFerryPassage(
  world: World,
  ctx: SystemContext,
  terrain: TerrainGraph,
  e: Entity,
  goal: NodeId,
): boolean {
  const start = entityNode(world, terrain, e);
  const home = terrain.componentOf(start);
  const target = terrain.componentOf(goal);
  if (home === NO_COMPONENT || target === NO_COMPONENT || home === target) return false;
  const owner = ownerOf(world, e);
  if (owner === undefined) return false;
  // A re-click while a crossing stands keeps its ship when it aims at the same island: only the walk on
  // from the far shore re-aims. An order to a rider detaches it first (the command pass), so the seat is
  // taken again and the walk to the door resumes where the detach left it.
  const booked = world.tryGet(e, FerryPassenger);
  if (booked !== undefined) {
    if (world.has(booked.ship, FerryVoyage) && terrain.componentOf(booked.goal) === target) {
      world.mut(e, FerryPassenger).goal = goal;
      retargetLeaving(world, terrain, e, goal);
      if (world.tryGet(e, Rider)?.vehicle === booked.ship) return true;
      if (attachToVehicle(world, ctx, { kind: 'attachToVehicle', entity: e, vehicle: booked.ship })) {
        boardVehicle(world, ctx, { kind: 'boardVehicle', entity: e });
        return true;
      }
    }
    world.remove(e, FerryPassenger); // its voyage is gone, or the re-click aims at another island
  }
  const ship = nearestFerry(world, ctx, terrain, e, owner, start, target);
  if (ship === null) return false;
  if (!attachToVehicle(world, ctx, { kind: 'attachToVehicle', entity: e, vehicle: ship })) return false;
  boardVehicle(world, ctx, { kind: 'boardVehicle', entity: e }); // step in on reaching the door
  const voyage = world.tryGet(ship, FerryVoyage);
  if (voyage === undefined) {
    const mooring = world.tryGet(ship, Vehicle)?.mooring ?? null;
    world.add(ship, FerryVoyage, {
      passengers: [e],
      shore: null,
      phase: 'board',
      since: ctx.tick,
      home: mooring === null ? null : { hx: mooring.hx, hy: mooring.hy },
    });
  } else if (!voyage.passengers.includes(e)) {
    world.mut(ship, FerryVoyage).passengers.push(e); // boarding continues: one more seat booked
  }
  world.add(e, FerryPassenger, { ship, goal });
  return true;
}

/**
 * The nearest ship that takes the booking: owned, a ship, lying moored at a shore of the settler's
 * island under no order and no pin, held by no colony's plan or trade route, commanded, with a free
 * seat and a scout aboard, its door on this island's ground. One already booked takes another
 * passenger only while it still boards at this shore for the same target island. Nearest by the
 * door's hex distance, ties broken by the ascending entity id the vehicle index lists.
 */
function nearestFerry(
  world: World,
  ctx: SystemContext,
  terrain: TerrainGraph,
  e: Entity,
  owner: number,
  start: NodeId,
  target: number,
): Entity | null {
  const held = colonyHeldShips(world, owner);
  const heldSet = held.length === 0 ? null : new Set(held);
  const from = terrain.coordsOf(start);
  let best: Entity | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ship of vehicleIndex(world).ownedBy(owner)) {
    const state = world.get(ship, Vehicle);
    const type = contentIndex(ctx.content).vehicles.get(state.vehicleType);
    if (type === undefined || !isShipVehicle(type)) continue;
    if (!state.moored || state.mooring === null) continue; // under way or adrift: nobody boards it
    if (state.task !== 'none') continue; // no held goto or dock: the crossing waits for no one else's
    if (state.carrier !== null || state.hauler !== null) continue; // riding or pinned out of service
    if (world.has(ship, TradeShip)) continue;
    const voyage = world.tryGet(ship, FerryVoyage);
    if (voyage !== undefined) {
      if (voyage.phase !== 'board') continue; // a sailing crossing takes no more bookings
      const first = world.tryGet(voyage.passengers[0] as Entity, FerryPassenger);
      if (first === undefined || terrain.componentOf(first.goal) !== target) continue;
    }
    if (heldSet?.has(ship) === true) continue;
    if (vehicleCommander(state) === null) continue; // a sail needs somebody at the helm
    if (!hasFreeSeat(state)) continue;
    if (!hasScoutAboard(world, ctx, state)) continue;
    if (!doorReachable(world, ctx, e, ship)) continue;
    const door = landingOf(world, ctx, ship);
    if (door === null) continue;
    const distance = hexDistanceBetween(from.x, from.y, door.hx, door.hy);
    if (distance < bestDistance) {
      best = ship;
      bestDistance = distance;
    }
  }
  return best;
}

/** Whether a living scout's seat is booked on `state`: the trade that crews the crossing. */
function hasScoutAboard(world: World, ctx: SystemContext, state: VehicleStateView): boolean {
  for (const seat of state.passengers) {
    if (seat === null || !world.isAlive(seat.entity)) continue;
    if (isScoutJob(ctx.content, world.tryGet(seat.entity, Settler)?.jobType ?? null)) return true;
  }
  return false;
}

/**
 * Advance every booked crossing one tick. Boarding ends, and the dock order goes out, the tick every
 * passenger is inside; the sail re-aims each rider's held leaving at its spot and the next rider pass
 * walks it on from the shore the ship moors at. A delivered crossing sails the empty ship back to the
 * mooring the crossing booked it at before the watcher ends. A ship the player sailed off, a dock no
 * shore took or a sail that lost its way lapses the booking, the passengers left where the ship last
 * lay moored.
 */
export const ferrySystem: System = (world, ctx) => {
  const terrain = ctx.terrain;
  if (terrain === undefined) return; // mapless sim: no crossings were bookable
  for (const ship of world.canonicalQuery(FerryVoyage)) {
    advanceVoyage(world, ctx, terrain, ship);
  }
};

/** One ship's voyage step: prune the passenger list, then run the leg the voyage stands in. */
function advanceVoyage(world: World, ctx: SystemContext, terrain: TerrainGraph, ship: Entity): void {
  const voyage = world.tryGet(ship, FerryVoyage);
  if (voyage === undefined) return;
  const state = world.tryGet(ship, Vehicle);
  if (state === undefined) {
    dropBooking(world, ship, voyage); // the ship is gone: whatever boarded it died with it
    return;
  }
  const remaining: Entity[] = [];
  for (const passenger of voyage.passengers) {
    const marker = world.tryGet(passenger, FerryPassenger);
    if (
      marker === undefined ||
      marker.ship !== ship ||
      !world.isAlive(passenger) ||
      world.tryGet(passenger, Rider)?.vehicle !== ship
    ) {
      if (marker?.ship === ship) world.remove(passenger, FerryPassenger);
      continue; // dead, released or re-attached elsewhere: the crossing is over for it
    }
    remaining.push(passenger);
  }
  if (remaining.length !== voyage.passengers.length) {
    world.mut(ship, FerryVoyage).passengers = remaining;
  }
  if (remaining.length === 0) {
    // Delivered: the taxi sails back to the mooring the crossing booked it at, watched until it lies
    // there again, so the next booking finds it home. A return the player takes over ends the watcher
    // wherever the ship last moored; a boarding that never sailed just ends.
    if (voyage.phase === 'return') {
      if (world.has(ship, VehicleDrive)) return; // the sail home is under way
      world.remove(ship, FerryVoyage);
      return;
    }
    if (voyage.phase === 'sail' && startReturnVoyage(world, ctx, terrain, ship, voyage)) return;
    world.remove(ship, FerryVoyage);
    return;
  }
  if (voyage.phase === 'board') {
    // The player ordered the ship off mid-boarding: the booking lapses, its riders stay ordinary ones.
    if (state.task !== 'none' || !state.moored) {
      cancelVoyage(world, ctx, ship, voyage, remaining, false);
      return;
    }
    if (remaining.every((passenger) => !world.has(passenger, Position))) {
      // All aboard: pick the shore of the target island nearest the first booking's spot and sail.
      if (!sailVoyage(world, ctx, terrain, ship, state, remaining[0] as Entity)) {
        cancelVoyage(world, ctx, ship, voyage, remaining, true);
      }
    }
    return;
  }
  const arrived =
    state.moored &&
    state.mooring !== null &&
    voyage.shore !== null &&
    state.mooring.hx === voyage.shore.hx &&
    state.mooring.hy === voyage.shore.hy;
  if (arrived) {
    holdLeaving(world, terrain, remaining); // the next rider pass steps them ashore
    return;
  }
  if (state.moored) {
    // Moored off the booked shore: the dock lapsed or the player re-docked it. The way across is lost.
    cancelVoyage(world, ctx, ship, voyage, remaining, true);
    return;
  }
  if (!world.has(ship, VehicleDrive)) {
    dropBooking(world, ship, voyage); // adrift: the sail gave up or the player stopped it
    return;
  }
  holdLeaving(world, terrain, remaining);
}

/**
 * Sail the boarding-complete voyage for its target island: the mooring spots the ship's sea reaches
 * that lie on the goal's land, the nearest the first booking's goal first, each judged by the route a
 * dock order would take. False when the ship's sea reaches no shore of that island; the booking is
 * then refused and the passengers put ashore where the ship lies.
 */
function sailVoyage(
  world: World,
  ctx: SystemContext,
  terrain: TerrainGraph,
  ship: Entity,
  state: VehicleStateView,
  passenger: Entity,
): boolean {
  const type = contentIndex(ctx.content).vehicles.get(state.vehicleType);
  const first = world.tryGet(passenger, FerryPassenger);
  if (type === undefined || first === undefined) return false;
  const spots = mooringSpotsOf(world, ctx, terrain, ship);
  if (spots === null) return false;
  const target = terrain.componentOf(first.goal);
  const goal = terrain.coordsOf(first.goal);
  const candidates: NodeId[] = [];
  for (const spot of spots.spots) {
    if (terrain.componentOf(spot) === target) candidates.push(spot);
  }
  // Nearest the goal first, ties in ascending node id: the passengers land as close to their spots as
  // the coast lets them.
  candidates.sort(
    (a, b) =>
      hexDistanceBetween(terrain.xOf(a), terrain.yOf(a), goal.x, goal.y) -
        hexDistanceBetween(terrain.xOf(b), terrain.yOf(b), goal.x, goal.y) ||
      a - b,
  );
  for (const spot of candidates) {
    const at = nodeOf(terrain, spot);
    if (dockRoute(world, ctx, terrain, ship, at) === null) continue;
    if (dockVehicle(world, ctx, { kind: 'dockVehicle', vehicle: ship, x: at.hx, y: at.hy })) {
      const live = world.mut(ship, FerryVoyage);
      live.phase = 'sail';
      live.shore = { hx: at.hx, hy: at.hy };
      return true;
    }
  }
  return false;
}

/**
 * Sail the delivered voyage back to the mooring the crossing booked it at: the mooring spots the
 * ship's sea reaches that lie on the booked home point's land, the booked spot itself first, each
 * judged by the route a dock order would take. False when no spot takes the ship; the watcher then
 * ends and the taxi stays at the far shore.
 */
function startReturnVoyage(
  world: World,
  ctx: SystemContext,
  terrain: TerrainGraph,
  ship: Entity,
  voyage: VehicleVoyageView,
): boolean {
  const home = voyage.home;
  if (home === null || home === undefined) return false;
  const spots = mooringSpotsOf(world, ctx, terrain, ship);
  if (spots === null) return false;
  const homeComponent = terrain.componentOf(terrain.nodeAtClamped(home.hx, home.hy));
  if (homeComponent === NO_COMPONENT) return false;
  const candidates: NodeId[] = [];
  for (const spot of spots.spots) {
    if (terrain.componentOf(spot) === homeComponent) candidates.push(spot);
  }
  // The booked home spot first, then the shore nearest it, ties in ascending node id: the taxi comes
  // back to where it started, or as close as the coast lets it.
  candidates.sort(
    (a, b) =>
      hexDistanceBetween(terrain.xOf(a), terrain.yOf(a), home.hx, home.hy) -
        hexDistanceBetween(terrain.xOf(b), terrain.yOf(b), home.hx, home.hy) ||
      a - b,
  );
  for (const spot of candidates) {
    const at = nodeOf(terrain, spot);
    if (dockRoute(world, ctx, terrain, ship, at) === null) continue;
    if (dockVehicle(world, ctx, { kind: 'dockVehicle', vehicle: ship, x: at.hx, y: at.hy })) {
      const live = world.mut(ship, FerryVoyage);
      live.phase = 'return';
      live.shore = { hx: at.hx, hy: at.hy };
      return true;
    }
  }
  return false;
}

/** Point every aboard passenger's held leaving at its walk-on spot, once each. */
function holdLeaving(world: World, terrain: TerrainGraph, passengers: readonly Entity[]): void {
  for (const passenger of passengers) {
    if (world.has(passenger, Position)) continue; // still walking to the door
    const rider = world.tryGet(passenger, Rider);
    if (rider === undefined || rider.leaving !== null) continue;
    const goal = world.tryGet(passenger, FerryPassenger)?.goal;
    if (goal === undefined) continue;
    world.mut(passenger, Rider).leaving = { to: nodeOf(terrain, goal) };
  }
}

/** A re-clicked spot replaces a aboard passenger's held leaving, so the walk on aims there. */
function retargetLeaving(world: World, terrain: TerrainGraph, e: Entity, goal: NodeId): void {
  if (world.has(e, Position)) return;
  const rider = world.tryGet(e, Rider);
  if (rider === undefined || rider.leaving === null) return;
  world.mut(e, Rider).leaving = { to: nodeOf(terrain, goal) };
}

/**
 * Lapse a voyage with a note: the passengers step ashore where the ship lies moored, each stamped
 * lost over the spot it never reached, and the booking is dropped. A passenger the ship cannot land
 * (it lies at sea) stays aboard, an ordinary rider now.
 */
function cancelVoyage(
  world: World,
  ctx: SystemContext,
  ship: Entity,
  voyage: VehicleVoyageView,
  passengers: readonly Entity[],
  note: boolean,
): void {
  for (const passenger of passengers) {
    const goal = world.tryGet(passenger, FerryPassenger)?.goal;
    world.remove(passenger, FerryPassenger);
    if (world.tryGet(passenger, Rider)?.vehicle !== ship) continue;
    if (!detachFromVehicle(world, ctx, { kind: 'detachFromVehicle', entity: passenger })) continue;
    if (note && goal !== undefined) {
      markLostWay(world, ctx, passenger, goal);
      if (world.has(passenger, Position)) stopAtNextNode(world, passenger);
    }
  }
  world.remove(ship, FerryVoyage);
}

/** Drop a voyage nobody can carry out: the passengers keep their seats as ordinary riders. */
function dropBooking(world: World, ship: Entity, voyage: VehicleVoyageView): void {
  for (const passenger of voyage.passengers) world.remove(passenger, FerryPassenger);
  world.remove(ship, FerryVoyage);
}

/** The read view a voyage step works from. */
type VehicleVoyageView = DeepReadonly<FerryVoyageState>;
