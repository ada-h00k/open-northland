import type { Entity, Simulation } from '@open-northland/sim';
import { components, systems } from '@open-northland/sim';
import { grassTerrain } from '../../catalog/buildings.js';
import { JOB_CHILD_MALE, JOB_CIVILIST, JOB_WOMAN } from '../../catalog/jobs.js';
import { PLAYER_COLOR_COUNT } from '../../catalog/roster.js';
import {
  BUILDING_BAKERY,
  BUILDING_HOME_02,
  placeBuiltSandboxBuilding,
  spawnSettlerDirect,
  staffBuildingFully,
} from '../../game/sandbox/index.js';
import type { SceneDefinition } from '../types.js';

const { Age, JobAssignment, MAX_PLAYERS, Marriage, Residence, ownerOf } = components;

/** One player per block: a couple's home, a single man's home, a home with a child, and a bakery with
 *  its baker and carrier. */
const COLUMN = { couple: 0, single: 1, family: 2, workshop: 3 } as const;
type Column = (typeof COLUMN)[keyof typeof COLUMN];
const COLUMNS = Object.keys(COLUMN).length;
/** Each resident's spawn, in whole tiles from the house anchor, clear of the home footprints. */
const RESIDENT_SPAWN = {
  wife: { dx: -3, dy: 2 },
  husband: { dx: -3, dy: 3 },
  child: { dx: -2, dy: 3 },
} as const;
/** Squarely inside the child stage, so the run ends long before he grows up. */
const CHILD_SPAWN_AGE_TICKS = systems.CHILD_AGE_TICKS + 100;

const COLUMN_STEP = 8;
const ROW_STEP = 12;
const BLOCKS_ACROSS = 2;
const BLOCK_STEP = COLUMN_STEP * COLUMNS + 2;
const FIRST = { x: 5, y: 8 } as const;
/** Long enough for the families to walk in and the bakery crew to settle. */
const RUN_TICKS = 600;

/** The whole-tile anchor of `column` in the block of `player`. */
function cellOf(player: number, column: Column): { x: number; y: number } {
  const across = player % BLOCKS_ACROSS;
  const down = Math.floor(player / BLOCKS_ACROSS);
  return { x: FIRST.x + across * BLOCK_STEP + column * COLUMN_STEP, y: FIRST.y + down * ROW_STEP };
}

function spawnResident(
  sim: Simulation,
  job: number,
  at: { x: number; y: number },
  offset: { dx: number; dy: number },
  player: number,
): Entity {
  return spawnSettlerDirect(sim, job, at.x + offset.dx, at.y + offset.dy, player);
}

function marry(sim: Simulation, wife: Entity, husband: Entity, child: Entity | null): void {
  sim.world.add(wife, Marriage, { spouse: husband, child });
  sim.world.add(husband, Marriage, { spouse: wife, child });
}

/** The block of `player`, who stands at the `player`-th place of the grid. */
function buildBlock(sim: Simulation, player: number): void {
  const home = (column: Column): { at: { x: number; y: number }; house: Entity } => {
    const at = cellOf(player, column);
    return { at, house: placeBuiltSandboxBuilding(sim, BUILDING_HOME_02, at.x, at.y, player) };
  };
  const { wife: w, husband: h, child: c } = RESIDENT_SPAWN;

  const couple = home(COLUMN.couple);
  const wife = spawnResident(sim, JOB_WOMAN, couple.at, w, player);
  marry(sim, wife, spawnResident(sim, JOB_CIVILIST, couple.at, h, player), null);
  sim.enqueueSetup({ kind: 'assignHouse', entity: wife, house: couple.house });

  const single = home(COLUMN.single);
  const bachelor = spawnResident(sim, JOB_CIVILIST, single.at, h, player);
  sim.enqueueSetup({ kind: 'assignHouse', entity: bachelor, house: single.house });

  const family = home(COLUMN.family);
  const mother = spawnResident(sim, JOB_WOMAN, family.at, w, player);
  const son = spawnResident(sim, JOB_CHILD_MALE, family.at, c, player);
  sim.world.add(son, Age, { ticks: CHILD_SPAWN_AGE_TICKS, asOf: null });
  marry(sim, mother, spawnResident(sim, JOB_CIVILIST, family.at, h, player), son);
  sim.enqueueSetup({ kind: 'assignHouse', entity: mother, house: family.house });

  const workshop = cellOf(player, COLUMN.workshop);
  const bakery = placeBuiltSandboxBuilding(sim, BUILDING_BAKERY, workshop.x, workshop.y, player, {
    fillStock: true,
  });
  staffBuildingFully(sim, bakery, player);
}

/** The scene's players are 0.. in order; player `i` wears colour `colours[i]`. */
function colourParadeScene(id: string, seed: number, colours: readonly number[]): SceneDefinition {
  const rows = Math.ceil(colours.length / BLOCKS_ACROSS);
  const players = colours.map((_, player) => player);
  return {
    id,
    seed,
    terrain: grassTerrain(FIRST.x + BLOCK_STEP * BLOCKS_ACROSS, FIRST.y + ROW_STEP * rows),
    build: (sim) => {
      for (const player of players) buildBlock(sim, player);
    },
    playerColours: colours,
    initialZoom: 0.5,
    runTicks: RUN_TICKS,
    checks: [
      {
        label: "every player's homes hold a couple, a single man, and a couple with their child",
        predicate: (sim) => players.every((player) => householdSizes(sim, player).join() === '1,2,3'),
      },
      {
        label: "every player's bakery has its baker and its carrier",
        predicate: (sim) => players.every((player) => bakeryCrew(sim, player) === 2),
      },
    ],
  };
}

/** Resident counts of `player`'s homes, ascending. */
function householdSizes(sim: Simulation, player: number): number[] {
  const byHome = new Map<Entity, number>();
  for (const e of sim.world.query(Residence)) {
    if (ownerOf(sim.world, e) !== player) continue;
    const home = sim.world.get(e, Residence).home;
    byHome.set(home, (byHome.get(home) ?? 0) + 1);
  }
  return [...byHome.values()].sort((a, b) => a - b);
}

function bakeryCrew(sim: Simulation, player: number): number {
  let crew = 0;
  for (const e of sim.world.query(JobAssignment)) {
    if (ownerOf(sim.world, e) === player) crew++;
  }
  return crew;
}

const ALL_COLOURS = Array.from({ length: PLAYER_COLOR_COUNT }, (_, colour) => colour);

/** The first {@link MAX_PLAYERS} colours, one player each. */
export const playerColoursScene = colourParadeScene('player-colours', 31, ALL_COLOURS.slice(0, MAX_PLAYERS));
/** The colours past {@link MAX_PLAYERS}, which a match reaches only through the lobby's colour pick. */
export const playerColoursExtraScene = colourParadeScene(
  'player-colours-extra',
  32,
  ALL_COLOURS.slice(MAX_PLAYERS),
);
