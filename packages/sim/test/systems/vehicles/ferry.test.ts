import { describe, expect, it } from 'vitest';
import {
  FerryPassenger,
  FerryVoyage,
  LostWay,
  Position,
  Rider,
  Settler,
  Vehicle,
  vehicleCommander,
  vehiclePassengers,
} from '../../../src/components/index.js';
import type { Entity } from '../../../src/ecs/world.js';
import {
  halfCellMapFromCells,
  hexDistanceBetween,
  nodeOfPosition,
  playerCommand,
  Simulation,
  type TerrainMap,
} from '../../../src/index.js';
import { createVehicle } from '../../../src/systems/vehicles/index.js';
import { testContent } from '../../fixtures/content.js';
import { ctxOf } from '../../fixtures/context.js';

/**
 * The ferryman: a move order whose goal lies across open water takes the owner's idle ship with a scout
 * aboard, moored at a shore of the settler's island. The settler boards, the ship docks at a shore of the
 * target island and the passenger walks on from there to the spot the order named. Without such a ship
 * the order refuses lost, as any unreachable walk does.
 */

const VIKING = 1;
const P0 = 0;
const SHIP_SMALL = 3;
const SCOUT = 27;
const CARRIER = 24;
const CIVILIST = 6;
const MAP_CELLS = 24;
const GRASS = 0;
const WATER = 1;
/** The sea's first and past-last cell columns: four cells of open water, both banks a walkable coast. */
const SEA_FROM = 10;
const SEA_TO = 14;
/** The ship's berth mid-sea, close enough to the west bank for its spawn mooring. */
const SHIP_HX = 22;
/** A home spot and a far spot, one island apart. */
const HOME = { hx: 14, hy: 12 } as const;
const FAR = { hx: 40, hy: 12 } as const;
/** A settler's few nodes to the door, with margin. */
const BOARD_TICKS = 240;
/** The crossing, and the walk on from the far shore, each with margin. */
const SAIL_TICKS = 400;
const WALK_ON_TICKS = 400;
/** A refused walk finds no way within a few planner passes. */
const LOST_TICKS = 60;

/** Two grass banks split by a sea no walk crosses and a ship of the fixture sails. */
function twoIslandMap(): TerrainMap {
  const typeIds = new Array<number>(MAP_CELLS * MAP_CELLS).fill(GRASS);
  for (let row = 0; row < MAP_CELLS; row++) {
    for (let col = SEA_FROM; col < SEA_TO; col++) typeIds[row * MAP_CELLS + col] = WATER;
  }
  return halfCellMapFromCells({ width: MAP_CELLS, height: MAP_CELLS, typeIds });
}

function sim(): Simulation {
  const s = new Simulation({ seed: 5, content: testContent(), map: twoIslandMap() });
  s.enqueueSetup({ kind: 'setNeedsEnabled', enabled: false });
  return s;
}

function spawnShip(s: Simulation, x = SHIP_HX, y = HOME.hy): Entity {
  const ship = createVehicle(s.world, ctxOf(s), {
    vehicleType: SHIP_SMALL,
    x,
    y,
    tribe: VIKING,
    owner: P0,
  });
  if (ship === null) throw new Error('ship missing from the fixture');
  return ship;
}

function spawnSettler(s: Simulation, x: number, y: number, jobType = CIVILIST): Entity {
  s.enqueueSetup({ kind: 'spawnSettler', jobType, x, y, tribe: VIKING, owner: P0 });
  s.step();
  const settlers = [...s.world.query(Settler)];
  const settler = settlers[settlers.length - 1];
  if (settler === undefined) throw new Error('settler missing');
  return settler;
}

/** Put a crew member of the ship's owner aboard and inside: it walks to the door and is asked in. */
function crewAboard(
  s: Simulation,
  ship: Entity,
  jobType: number,
  x = 16,
  y = HOME.hy,
): Entity {
  const member = spawnSettler(s, x, y, jobType);
  s.enqueue(playerCommand(P0, { kind: 'attachToVehicle', entity: member, vehicle: ship }));
  s.step();
  s.enqueue(playerCommand(P0, { kind: 'boardVehicle', entity: member }));
  s.step();
  boardOut(s, ship, member);
  return member;
}

/** The crossing's ferryman: a scout at the helm. */
function crewScout(s: Simulation, ship: Entity, x = 16, y = HOME.hy): Entity {
  return crewAboard(s, ship, SCOUT, x, y);
}

function nodeOf(s: Simulation, e: Entity): { hx: number; hy: number } | null {
  const p = s.world.tryGet(e, Position);
  return p === undefined ? null : nodeOfPosition(p.x, p.y);
}

function landOf(s: Simulation, at: { readonly hx: number; readonly hy: number }): number {
  const terrain = s.terrain;
  if (terrain === undefined) throw new Error('the sim runs mapless');
  return terrain.componentOf(terrain.nodeAt(at.hx, at.hy));
}

function seatOf(s: Simulation, vehicle: Entity, rider: Entity): { inside: boolean } | undefined {
  return vehiclePassengers(s.world.get(vehicle, Vehicle)).find((seat) => seat.entity === rider);
}

/** Step until `rider` is inside `vehicle`. */
function boardOut(s: Simulation, vehicle: Entity, rider: Entity, limit = BOARD_TICKS): void {
  for (let ticks = 0; ticks < limit; ticks++) {
    if (seatOf(s, vehicle, rider)?.inside === true) return;
    s.step();
  }
  throw new Error('rider never boarded');
}

/** Step until `rider` stands on the map, off its ship, on the far island's ground. */
function stepAshore(s: Simulation, rider: Entity, far: { readonly hx: number; readonly hy: number }): void {
  const farLand = landOf(s, far);
  for (let ticks = 0; ticks < SAIL_TICKS; ticks++) {
    s.step();
    const at = nodeOf(s, rider);
    if (at !== null && !s.world.has(rider, Rider) && landOf(s, at) === farLand) return;
  }
  throw new Error('rider never stepped ashore on the far island');
}

/** Step until `e` stands within `reach` nodes of `spot`. */
function stepOnto(
  s: Simulation,
  e: Entity,
  spot: { readonly hx: number; readonly hy: number },
  reach = 2,
  limit = WALK_ON_TICKS,
): void {
  for (let ticks = 0; ticks < limit; ticks++) {
    const at = nodeOf(s, e);
    if (at !== null && hexDistanceBetween(at.hx, at.hy, spot.hx, spot.hy) <= reach) return;
    s.step();
  }
  const at = nodeOf(s, e);
  throw new Error(`never reached the spot: at ${JSON.stringify(at)}`);
}

describe('ferryPassage', () => {
  it('sails a move order across the water and walks the passenger on to its spot', () => {
    const s = sim();
    const ship = spawnShip(s);
    const scout = crewScout(s, ship);
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);

    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: passenger, x: FAR.hx, y: FAR.hy }));
    s.step();
    // The order became a crossing, not a walk.
    expect(s.world.tryGet(passenger, FerryPassenger)?.ship).toBe(ship);
    expect(s.world.tryGet(ship, FerryVoyage)?.phase).toBe('board');
    boardOut(s, ship, passenger);
    expect(s.world.tryGet(ship, FerryVoyage)?.phase).toBe('sail');

    // The ship moors at the target island and the passenger walks on to the ordered spot.
    stepAshore(s, passenger, FAR);
    stepOnto(s, passenger, FAR);
    expect(s.world.has(passenger, LostWay)).toBe(false);
    expect(s.world.has(passenger, FerryPassenger)).toBe(false);
    // The voyage is over, the ship lies moored at the far shore, its scout still at the helm.
    expect(s.world.has(ship, FerryVoyage)).toBe(false);
    const state = s.world.get(ship, Vehicle);
    expect(state.moored).toBe(true);
    const mooring = state.mooring;
    if (mooring === null) throw new Error('the ferry never moored');
    expect(landOf(s, mooring)).toBe(landOf(s, FAR));
    expect(vehicleCommander(state)).toBe(scout);
  });

  it('refuses the crossing lost when no ship with a scout at the helm lies at this island', () => {
    const s = sim();
    const ship = spawnShip(s); // moored at the west shore, but nobody aboard
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);

    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: passenger, x: FAR.hx, y: FAR.hy }));
    s.step();
    expect(s.world.has(passenger, FerryPassenger)).toBe(false);
    expect(s.world.has(ship, FerryVoyage)).toBe(false);
    let lost = false;
    for (let ticks = 0; ticks < LOST_TICKS && !lost; ticks++) {
      s.step();
      lost = s.world.has(passenger, LostWay);
    }
    expect(lost).toBe(true);
  });

  it('takes no crossing from a ship whose crew holds no scout', () => {
    const s = sim();
    const ship = spawnShip(s);
    crewAboard(s, ship, CARRIER); // a carrier at the helm commands the sail, but is no scout
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);

    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: passenger, x: FAR.hx, y: FAR.hy }));
    s.step();
    expect(s.world.has(passenger, FerryPassenger)).toBe(false);
    expect(s.world.has(ship, FerryVoyage)).toBe(false);
    let lost = false;
    for (let ticks = 0; ticks < LOST_TICKS && !lost; ticks++) {
      s.step();
      lost = s.world.has(passenger, LostWay);
    }
    expect(lost).toBe(true);
  });

  it('takes the nearest ship with a scout at the helm', () => {
    const s = sim();
    const near = spawnShip(s, SHIP_HX, HOME.hy);
    crewScout(s, near, 16, HOME.hy);
    const far = spawnShip(s, SHIP_HX, 24);
    crewScout(s, far, 16, 24);
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);

    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: passenger, x: FAR.hx, y: FAR.hy }));
    s.step();
    expect(s.world.tryGet(passenger, FerryPassenger)?.ship).toBe(near);
    expect(s.world.has(far, FerryVoyage)).toBe(false);
  });

  it('shares the waiting ship with a second island-crossing click', () => {
    const s = sim();
    const ship = spawnShip(s);
    crewScout(s, ship);
    const first = spawnSettler(s, HOME.hx, 10);
    const second = spawnSettler(s, HOME.hx, 14);
    const firstFar = { hx: FAR.hx, hy: 10 } as const;
    const secondFar = { hx: FAR.hx, hy: 14 } as const;

    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: first, x: firstFar.hx, y: firstFar.hy }));
    s.step();
    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: second, x: secondFar.hx, y: secondFar.hy }));
    s.step();
    const voyage = s.world.get(ship, FerryVoyage);
    expect(voyage.passengers).toContain(first);
    expect(voyage.passengers).toContain(second);

    // Both land, each on the walk to its own spot, and the voyage ends with the last one ashore.
    stepAshore(s, first, firstFar);
    stepAshore(s, second, secondFar);
    stepOnto(s, first, firstFar);
    stepOnto(s, second, secondFar);
    expect(s.world.has(ship, FerryVoyage)).toBe(false);
    expect(s.world.has(first, LostWay)).toBe(false);
    expect(s.world.has(second, LostWay)).toBe(false);
  });

  it('a re-click while the crossing stands re-aims the walk on from the far shore', () => {
    const s = sim();
    const ship = spawnShip(s);
    crewScout(s, ship);
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);
    const retarget = { hx: 42, hy: 16 } as const;

    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: passenger, x: FAR.hx, y: FAR.hy }));
    s.step();
    s.enqueue(playerCommand(P0, { kind: 'moveUnit', entity: passenger, x: retarget.hx, y: retarget.hy }));
    s.step();
    const terrain = s.terrain;
    if (terrain === undefined) throw new Error('the sim runs mapless');
    expect(s.world.tryGet(passenger, FerryPassenger)?.ship).toBe(ship);
    expect(s.world.get(passenger, FerryPassenger).goal).toBe(terrain.nodeAt(retarget.hx, retarget.hy));

    // The crossing still carries the passenger, and the walk on aims at the new spot.
    stepAshore(s, passenger, retarget);
    stepOnto(s, passenger, retarget);
    expect(s.world.has(ship, FerryVoyage)).toBe(false);
    expect(s.world.has(passenger, LostWay)).toBe(false);
  });

  it('a group move order onto another island ferries its member, as the click dispatch issues it', () => {
    const s = sim();
    const ship = spawnShip(s);
    crewScout(s, ship);
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);

    // The app's ground click always arrives as a group order with per-member destinations.
    s.enqueue(
      playerCommand(P0, {
        kind: 'moveUnitGroup',
        members: [{ entity: passenger, x: FAR.hx, y: FAR.hy }],
      }),
    );
    s.step();
    expect(s.world.tryGet(passenger, FerryPassenger)?.ship).toBe(ship);
    boardOut(s, ship, passenger);
    stepAshore(s, passenger, FAR);
    stepOnto(s, passenger, FAR);
    expect(s.world.has(passenger, LostWay)).toBe(false);
    expect(s.world.has(ship, FerryVoyage)).toBe(false);
  });

  it('the order fan keeps a cross-island click as the member\u2019s own raw slot', () => {
    const s = sim();
    const passenger = spawnSettler(s, HOME.hx, HOME.hy);

    // The click on the other island is the member's own crossing, not a fan seat on its own coast.
    const groups = s.formationSlots({ hx: FAR.hx, hy: FAR.hy }, [passenger], 1, 'move');
    expect(groups).not.toBeNull();
    const cross = groups?.find((group) => group.members.includes(passenger));
    expect(cross?.slots).toEqual([{ hx: FAR.hx, hy: FAR.hy }]);

    // A same-island click still fans a seat around itself.
    const near = s.formationSlots({ hx: 16, hy: 12 }, [passenger], 1, 'move');
    const seat = near?.find((group) => group.members.includes(passenger))?.slots[0];
    expect(seat).toBeDefined();
    expect(hexDistanceBetween(seat?.hx ?? 0, seat?.hy ?? 0, 16, 12)).toBeLessThanOrEqual(8);
  });
});
