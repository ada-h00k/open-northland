import { components, type Entity, playerCommand, type Simulation } from '@open-northland/sim';
import { grassTerrain } from '../../catalog/buildings.js';
import { JOB_CARRIER } from '../../catalog/jobs.js';
import { HUMAN_PLAYER } from '../../game/rules.js';
import {
  BUILDING_HEADQUARTERS,
  BUILDING_WAREHOUSE_00,
  placeBuiltSandboxBuilding,
  spawnVehicleDirect,
  spawnWorkersAtDoor,
  VEHICLE_HANDCART,
} from '../../game/sandbox/index.js';
import { buildingOfType, goodBySlug } from '../sandbox-queries.js';
import type { SceneDefinition } from '../types.js';

/**
 * Store priority: a storehouse marks long swords, big healing potions, mead and an amulet as priority,
 * and its three porters, one pulling a handcart, bring them over from the headquarters across the
 * meadow while the wood stays where it is. The fallback catalog's barracks shelve nothing, so a
 * storehouse stands in for them.
 */

const MAP_W = 30;
const MAP_H = 14;
const HQ_AT = { x: 5, y: 7 } as const;
const STORE_AT = { x: 21, y: 7 } as const;
/** The handcart stands on the meadow west of the storehouse. */
const CART_AT = { x: 17, y: 9 } as const;
const PORTERS = 3;
/** Good slug -> units the headquarters start with; each is marked priority in the storehouse. */
const PRIORITY_STOCK = [
  ['sword_long', 8],
  ['potion_heal_big', 4],
  ['mead', 6],
  ['amulet_strength', 2],
] as const;
const WOOD_STOCKED = 10;
const RUN_TICKS = 4000;

const { JobAssignment, setStockAmount, Stockpile } = components;

function stockOf(sim: Simulation, buildingType: number, slug: string): number {
  const store = buildingOfType(sim, buildingType);
  return store === null ? 0 : (sim.world.get(store, Stockpile).amounts.get(goodBySlug(sim, slug)) ?? 0);
}

function build(sim: Simulation): void {
  const hq = placeBuiltSandboxBuilding(sim, BUILDING_HEADQUARTERS, HQ_AT.x, HQ_AT.y);
  const store = placeBuiltSandboxBuilding(sim, BUILDING_WAREHOUSE_00, STORE_AT.x, STORE_AT.y);
  setStockAmount(sim.world, hq, goodBySlug(sim, 'wood'), WOOD_STOCKED);
  for (const [slug, units] of PRIORITY_STOCK) {
    const goodType = goodBySlug(sim, slug);
    setStockAmount(sim.world, hq, goodType, units);
    sim.enqueue(
      playerCommand(HUMAN_PLAYER, { kind: 'setStorePriority', building: store, goodType, priority: true }),
    );
  }
  spawnWorkersAtDoor(sim, store, PORTERS, { jobType: JOB_CARRIER });
  const porter = firstPorterOf(sim, store);
  if (porter === null) return;
  const cart = spawnVehicleDirect(sim, VEHICLE_HANDCART, CART_AT.x, CART_AT.y);
  sim.enqueue(playerCommand(HUMAN_PLAYER, { kind: 'attachToVehicle', entity: porter, vehicle: cart }));
}

function firstPorterOf(sim: Simulation, store: Entity): Entity | null {
  for (const e of sim.world.query(JobAssignment)) {
    if (sim.world.get(e, JobAssignment).workplace === store) return e;
  }
  return null;
}

export const storePriorityScene: SceneDefinition = {
  id: 'store-priority',
  seed: 25,
  terrain: grassTerrain(MAP_W, MAP_H),
  build,
  runTicks: RUN_TICKS,
  initialZoom: 0.8,
  needs: false,
  progression: false,
  checks: PRIORITY_STOCK.map(([slug, units]) => ({
    label: `the storehouse holds every ${slug}`,
    predicate: (sim: Simulation) => stockOf(sim, BUILDING_WAREHOUSE_00, slug) === units,
  })).concat([
    {
      label: 'the wood stays in the headquarters',
      predicate: (sim) => stockOf(sim, BUILDING_HEADQUARTERS, 'wood') === WOOD_STOCKED,
    },
  ]),
};
