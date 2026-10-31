import { components, type Entity, type Simulation } from '@open-northland/sim';
import { grassTerrain } from '../../catalog/buildings.js';
import { JOB_CIVILIST, JOB_SOLDIER_BROADSWORD } from '../../catalog/jobs.js';
import { HUMAN_PLAYER } from '../../game/rules.js';
import {
  BUILDING_BARRACKS,
  BUILDING_HEADQUARTERS,
  placeBuiltSandboxBuilding,
  placeSandboxBuilding,
  spawnSettlerDirect,
} from '../../game/sandbox/index.js';
import { buildingStock, goodBySlug } from '../sandbox-queries.js';
import type { SceneDefinition } from '../types.js';

const { Equipment, Settler, setStockAmount } = components;

const HEADQUARTERS = { x: 6, y: 12 } as const;
const BARRACKS = { x: 14, y: 10 } as const;
const RECRUIT_ROW_Y = 6;
const FIRST_RECRUIT_X = 10;
const RECRUITS = 2;
/** The second long sword lies by the headquarters, away from the barracks, so the one walk out shows. */
const ARMORY = { hx: 6, hy: 18 } as const;

const SWORD_SHORT = 'sword_shord'; // the content's own spelling
const SWORD_LONG = 'sword_long';
const ARMOR_CHAIN = 'armor_chain';

/** The drill (~400 ticks), then the second recruit's outing to the armory and back, with slack. */
const RUN_TICKS = 1400;

function build(sim: Simulation): void {
  placeSandboxBuilding(sim, BUILDING_HEADQUARTERS, HEADQUARTERS.x, HEADQUARTERS.y);
  const barracks = placeBuiltSandboxBuilding(sim, BUILDING_BARRACKS, BARRACKS.x, BARRACKS.y);
  // One long sword and armor for both: the first recruit out wears the barracks' long sword, the second
  // leaves its short sword for the long one in the armory.
  setStockAmount(sim.world, barracks, goodBySlug(sim, SWORD_LONG), 1);
  setStockAmount(sim.world, barracks, goodBySlug(sim, SWORD_SHORT), 1);
  setStockAmount(sim.world, barracks, goodBySlug(sim, ARMOR_CHAIN), RECRUITS);
  sim.enqueueSetup({
    kind: 'dropGood',
    good: goodBySlug(sim, SWORD_LONG),
    x: ARMORY.hx,
    y: ARMORY.hy,
    amount: 1,
  });
  for (let i = 0; i < RECRUITS; i++)
    spawnSettlerDirect(sim, JOB_CIVILIST, FIRST_RECRUIT_X + 2 * i, RECRUIT_ROW_Y);
  sim.enqueueSetup({
    kind: 'setAssistantCounter',
    player: HUMAN_PLAYER,
    counter: 'trainSword',
    value: RECRUITS,
    infinite: false,
  });
}

function recruits(sim: Simulation): Entity[] {
  return [...sim.world.query(Settler)];
}

export const barracksArmoryScene: SceneDefinition = {
  id: 'barracks-armory',
  seed: 12,
  terrain: grassTerrain(24, 16),
  build,
  runTicks: RUN_TICKS,
  checks: [
    {
      label: 'both sword recruits end long-swordsmen in chain armor',
      predicate: (sim) =>
        recruits(sim).every(
          (e) =>
            sim.world.get(e, Settler).jobType === JOB_SOLDIER_BROADSWORD &&
            sim.world.tryGet(e, Equipment)?.armor?.goodType === goodBySlug(sim, ARMOR_CHAIN),
        ),
    },
    {
      label: 'the barracks gave up its long sword and both armors, and kept the short sword',
      predicate: (sim) =>
        buildingStock(sim, BUILDING_BARRACKS, SWORD_LONG) === 0 &&
        buildingStock(sim, BUILDING_BARRACKS, ARMOR_CHAIN) === 0 &&
        buildingStock(sim, BUILDING_BARRACKS, SWORD_SHORT) === 1,
    },
    {
      label: 'the armory long sword was fetched too, paying the counter off',
      predicate: (sim) => sim.assistantCounters(HUMAN_PLAYER).trainSword.value === 0,
    },
  ],
};
