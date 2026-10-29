import type { ContentSet, MapAiSeat, MapEscalationInput } from '@open-northland/data';
import { MapEscalation, parseContentSet } from '@open-northland/data';
import { Owner, Position, Settler, Vehicle } from '../../../src/components/index.js';
import { TICKS_PER_SECOND } from '../../../src/core/loop.js';
import type { Entity } from '../../../src/ecs/world.js';
import { halfCellMapFromCells, Simulation, type TerrainMap } from '../../../src/index.js';
import { hexDistanceBetween, nodeOfPosition } from '../../../src/nav/halfcell.js';
import { CONDITION_ALWAYS } from '../../../src/systems/map-ai/index.js';
import { aiContent } from '../ai-content.js';

/**
 * A synthetic coast for an escalation: open sea in the west, a fortress keep and one player seat with
 * two houses and a villager on land, and a raider whose wave brings a sea landing.
 */

const VIKING = 1;
const HQ_TYPE = 1;
const SPEARMAN = 32;
const BOWMAN = 40;
const SHIP = 3;
/** The ship's seats besides the commander's: the landing carries one more man than this. */
export const SHIP_SEATS = 3;
const SEA_MEN = 6;

const FORTRESS = 6;
export const PLAYER = 0;
const RAIDER = 7;

/** Cells: open sea in the west columns, land from {@link SHORE_CELL} east. */
const MAP_CELLS = { width: 50, height: 30 };
const SHORE_CELL = 10;
const KEEP = { x: 90, y: 30 };
export const TARGET = { x: 60, y: 30 };
export const SECOND_HOUSE = { x: 60, y: 46 };
const VILLAGER = { x: 66, y: 36 };
export const LANDING = { spawnX: 4, spawnY: 30, x: 21, y: 30 };

export const LAUNCH_SECONDS = 10;
export const NOTICE = 'landing';

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

export function coast(): TerrainMap {
  const GRASS = 0;
  const WATER = 1;
  const { width, height } = MAP_CELLS;
  const typeIds = new Array<number>(width * height).fill(GRASS);
  for (let row = 0; row < height; row++)
    for (let col = 0; col < SHORE_CELL; col++) typeIds[row * width + col] = WATER;
  return halfCellMapFromCells({ width, height, typeIds });
}

export const ESCALATION: MapEscalationInput = {
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

export const SCRIPT: MapAiSeat[] = [
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

/** The coast world after its setup tick. */
export function coastWorld(): Simulation {
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

export function raiderShips(sim: Simulation): Entity[] {
  return [...sim.world.query(Vehicle, Owner)].filter((e) => sim.world.get(e, Owner).player === RAIDER);
}

export function raiderMen(sim: Simulation): Entity[] {
  return [...sim.world.query(Settler, Owner)].filter((e) => sim.world.get(e, Owner).player === RAIDER);
}

export function distance(sim: Simulation, e: Entity, to: { x: number; y: number }): number {
  const at = sim.world.get(e, Position);
  const node = nodeOfPosition(at.x, at.y);
  return hexDistanceBetween(node.hx, node.hy, to.x, to.y);
}

/** Step until `done` holds, at most `seconds`; false when it never did. */
export function runUntil(sim: Simulation, seconds: number, done: () => boolean): boolean {
  const end = sim.tick + seconds * TICKS_PER_SECOND;
  while (sim.tick < end) {
    sim.step();
    if (done()) return true;
  }
  return false;
}
