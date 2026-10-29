import type { ContentSet, MapAiSeat, MapEscalationInput } from '@open-northland/data';
import { MapEscalation, parseContentSet } from '@open-northland/data';
import { describe, expect, it } from 'vitest';
import {
  AttackOrder,
  Building,
  mapEscalationProgress,
  Owner,
  Position,
  Rider,
  Settler,
  Vehicle,
} from '../../../src/components/index.js';
import { TICKS_PER_SECOND } from '../../../src/core/loop.js';
import type { Entity } from '../../../src/ecs/world.js';
import {
  exportSaveGame,
  halfCellMapFromCells,
  parseSaveGame,
  restoreSimulation,
  Simulation,
  serializeSaveGame,
  type TerrainMap,
} from '../../../src/index.js';
import { hexDistanceBetween, nodeOfPosition } from '../../../src/nav/halfcell.js';
import { CONDITION_ALWAYS } from '../../../src/systems/map-ai/index.js';
import { aiContent } from '../../fixtures/ai-content.js';

/**
 * A wave's sea landing on a synthetic coast, and the aim of a seat's attack once its headquarters
 * falls: the ship appears at sea with the fresh men aboard, docks at the landing point, sets them
 * ashore to join the raider's attack, and sails back off the map; a seat that lost its headquarters is
 * attacked at another building, then at its people.
 */

const VIKING = 1;
const HQ_TYPE = 1;
const SPEARMAN = 32;
const BOWMAN = 40;
const SHIP = 3;
/** The ship's seats besides the commander's: the landing carries one more man than this. */
const SHIP_SEATS = 3;
const SEA_MEN = 6;

const FORTRESS = 6;
const PLAYER = 0;
const RAIDER = 7;

/** Cells: open sea in the west columns, land from {@link SHORE_CELL} east. */
const MAP_CELLS = { width: 50, height: 30 };
const SHORE_CELL = 10;
const KEEP = { x: 90, y: 30 };
const TARGET = { x: 60, y: 30 };
const SECOND_HOUSE = { x: 60, y: 46 };
const VILLAGER = { x: 66, y: 36 };
const LANDING = { spawnX: 4, spawnY: 30, x: 21, y: 30 };

const LAUNCH_SECONDS = 10;
const NOTICE = 'landing';

/** {@link aiContent} with a small ship that admits the attack's trades. */
function landingContent(): ContentSet {
  const base = aiContent();
  return parseContentSet({
    ...base,
    vehicles: [
      {
        typeId: SHIP,
        id: 'ship_small',
        jobId: 52,
        stockSlots: 0,
        passengerSlots: SHIP_SEATS,
        logicSize: 2,
        passengerJobs: [SPEARMAN, BOWMAN],
        commanderJob: 24,
        passengerVector: { direction: 2, distance: 4 },
        hitpoints: 5000,
      },
    ],
  });
}

function coast(): TerrainMap {
  const GRASS = 0;
  const WATER = 1;
  const { width, height } = MAP_CELLS;
  const typeIds = new Array<number>(width * height).fill(GRASS);
  for (let row = 0; row < height; row++)
    for (let col = 0; col < SHORE_CELL; col++) typeIds[row * width + col] = WATER;
  return halfCellMapFromCells({ width, height, typeIds });
}

const ESCALATION: MapEscalationInput = {
  keep: { seat: FORTRESS, houseType: HQ_TYPE, ...KEEP, range: 4 },
  tribe: VIKING,
  jobMix: [
    { job: SPEARMAN, weight: 2 },
    { job: BOWMAN, weight: 1 },
  ],
  attacks: {
    launches: [{ atSeconds: LAUNCH_SECONDS, landMen: 1, seaMen: SEA_MEN }],
    repeat: { everySeconds: 600, waves: [{ landMen: 0, seaMen: 0 }] },
    endAfterSeconds: 300,
    targets: [{ seat: PLAYER, raider: RAIDER, ...TARGET, landing: LANDING }],
  },
  guard: {
    base: 0,
    perSeatStep: 0,
    stepSeconds: 60,
    perSeatMax: 0,
    refill: [{ fromSeconds: 0, everySeconds: 60, men: 0 }],
  },
  landings: { vehicle: 'ship_small', noticeKey: NOTICE },
};

const SCRIPT: MapAiSeat[] = [
  {
    player: RAIDER,
    allDisabled: false,
    computerDisabled: true,
    disabledComputerModules: [],
    conditions: [],
    tasks: [
      {
        kind: 'attack',
        priority: 100,
        condition: CONDITION_ALWAYS,
        ...TARGET,
        range: 20,
        min: 0,
        max: 0,
        rallyX: 75,
        rallyY: 30,
        stance: 1,
      },
    ],
  },
];

function setup(): Simulation {
  const sim = new Simulation({
    seed: 5,
    content: landingContent(),
    map: coast(),
    mapAiScript: SCRIPT,
    mapEscalation: MapEscalation.parse(ESCALATION),
  });
  for (const player of [FORTRESS, RAIDER]) {
    sim.enqueueSetup({ kind: 'setAiControl', player, enabled: true, modules: { military: false } });
  }
  sim.enqueueSetup({ kind: 'setDiplomacy', from: FORTRESS, to: RAIDER, state: 'friend' });
  sim.enqueueSetup({ kind: 'setDiplomacy', from: RAIDER, to: FORTRESS, state: 'friend' });
  const house = (owner: number, at: { x: number; y: number }) =>
    sim.enqueueSetup({
      kind: 'placeBuilding',
      buildingType: HQ_TYPE,
      ...at,
      tribe: VIKING,
      owner,
      force: true,
      underConstruction: false,
    });
  house(FORTRESS, KEEP);
  house(PLAYER, TARGET);
  house(PLAYER, SECOND_HOUSE);
  sim.enqueueSetup({ kind: 'spawnSettler', jobType: 0, ...VILLAGER, tribe: VIKING, owner: PLAYER });
  sim.step();
  return sim;
}

function raiderShips(sim: Simulation): Entity[] {
  return [...sim.world.query(Vehicle, Owner)].filter((e) => sim.world.get(e, Owner).player === RAIDER);
}

function raiderMen(sim: Simulation): Entity[] {
  return [...sim.world.query(Settler, Owner)].filter((e) => sim.world.get(e, Owner).player === RAIDER);
}

function distance(sim: Simulation, e: Entity, to: { x: number; y: number }): number {
  const at = sim.world.get(e, Position);
  const node = nodeOfPosition(at.x, at.y);
  return hexDistanceBetween(node.hx, node.hy, to.x, to.y);
}

/** Step until `done` holds, at most `seconds`; false when it never did. */
function runUntil(sim: Simulation, seconds: number, done: () => boolean): boolean {
  const end = sim.tick + seconds * TICKS_PER_SECOND;
  while (sim.tick < end) {
    sim.step();
    if (done()) return true;
  }
  return false;
}

function playerHouseAt(sim: Simulation, at: { x: number; y: number }): Entity {
  const house = [...sim.world.query(Building, Owner, Position)].find(
    (e) => sim.world.get(e, Owner).player === PLAYER && distance(sim, e, at) === 0,
  );
  if (house === undefined) throw new Error('no house there');
  return house;
}

describe('map escalation - a sea landing', () => {
  it('sails one full ship to the landing point, sets its men ashore in the attack and leaves the map', () => {
    const sim = setup();
    let landing: { wave: number; seats: readonly number[]; noticeKey: string } | null = null;
    runUntil(sim, LAUNCH_SECONDS + 1, () => {
      for (const ev of sim.events.current())
        if (ev.kind === 'mapEscalationLanding')
          landing = { wave: ev.wave, seats: ev.seats, noticeKey: ev.noticeKey };
      return landing !== null;
    });
    expect(landing).toEqual({ wave: 1, seats: [PLAYER], noticeKey: NOTICE });
    const [ship, ...others] = raiderShips(sim);
    if (ship === undefined) throw new Error('no ship');
    expect(others).toEqual([]);
    expect(distance(sim, ship, { x: LANDING.spawnX, y: LANDING.spawnY })).toBeLessThan(4);
    // One ship only: its seats and the commander's, every man aboard and counted in the attack.
    const aboard = raiderMen(sim).filter((e) => sim.world.has(e, Rider));
    expect(aboard).toHaveLength(SHIP_SEATS + 1);
    for (const e of aboard) expect(sim.world.has(e, Position)).toBe(false);
    expect(mapEscalationProgress(sim.world).attack?.men).toEqual(expect.arrayContaining(aboard));

    expect(runUntil(sim, 60, () => aboard.every((e) => sim.world.has(e, Position)))).toBe(true);
    for (const e of aboard) {
      expect(sim.world.has(e, Rider)).toBe(false);
      expect(distance(sim, e, LANDING)).toBeLessThan(6);
    }
    expect(runUntil(sim, 60, () => raiderShips(sim).length === 0)).toBe(true);
    expect(mapEscalationProgress(sim.world).landings).toEqual([]);

    // Ashore they are the raider's soldiers like the land band, and its Attack task takes them on.
    const ashore = distance(sim, aboard[0] as Entity, TARGET);
    sim.run(20 * TICKS_PER_SECOND);
    expect(distance(sim, aboard[0] as Entity, TARGET)).toBeLessThan(ashore);
    expect(sim.checkInvariants()).toEqual([]);
  });

  it('keeps a ship under way through a save', () => {
    const sim = setup();
    runUntil(sim, LAUNCH_SECONDS + 2, () => false);
    expect(mapEscalationProgress(sim.world).landings).toHaveLength(1);
    const save = parseSaveGame(JSON.parse(serializeSaveGame(exportSaveGame(sim))));
    const restored = restoreSimulation(save, {
      content: sim.content,
      map: coast(),
      mapAiScript: SCRIPT,
      mapEscalation: MapEscalation.parse(ESCALATION),
    });
    expect(restored.hashState()).toBe(sim.hashState());
  });
});

describe('map escalation - the aim', () => {
  it('moves to another building once the headquarters falls, then to the seat’s people', () => {
    const sim = setup();
    runUntil(sim, LAUNCH_SECONDS + 1, () => false);
    expect(mapEscalationProgress(sim.world).focus).toMatchObject([{ seat: PLAYER, kind: 'headquarters' }]);

    sim.world.destroy(playerHouseAt(sim, TARGET));
    const second = playerHouseAt(sim, SECOND_HOUSE);
    const band = () => raiderMen(sim).filter((e) => sim.world.has(e, Position));
    const aimedAt = (target: Entity) => () =>
      band().length > 0 && band().every((e) => sim.world.tryGet(e, AttackOrder)?.target === target);
    expect(runUntil(sim, 3, aimedAt(second))).toBe(true);
    expect(mapEscalationProgress(sim.world).focus).toEqual([
      { seat: PLAYER, kind: 'building', entity: second },
    ]);

    sim.world.destroy(second);
    const villager = [...sim.world.query(Settler, Owner)].find(
      (e) => sim.world.get(e, Owner).player === PLAYER,
    );
    if (villager === undefined) throw new Error('no villager');
    expect(runUntil(sim, 3, aimedAt(villager))).toBe(true);
    expect(mapEscalationProgress(sim.world).focus).toEqual([
      { seat: PLAYER, kind: 'person', entity: villager },
    ]);
  });
});
