import { Building } from '../../components/index.js';
import type { Entity, World } from '../../ecs/world.js';
import { createRegionIndex, NO_REGION_EXTRA } from './region.js';

/**
 * The per-world building spatial index, foundations included, so a radius question reads only the
 * buildings near a point instead of a seat's whole roster. A building never moves while it stands, so the
 * index updates only on placement and removal; it holds no owner, which a capture can change, so a caller
 * reads that live.
 */
const index = createRegionIndex(
  Building,
  { verifier: 'buildingRegionIndex', plural: 'buildings', component: 'Building', singular: 'building' },
  NO_REGION_EXTRA,
);

/** Every building whose anchor node lies within the box `reach` nodes around `(hx, hy)`, handed to `visit`
 *  with that anchor in no particular order. A candidate superset of any radius up to `reach`. */
export function forEachBuildingNear(
  world: World,
  hx: number,
  hy: number,
  reach: number,
  visit: (e: Entity, hx: number, hy: number) => void,
): void {
  index.visitNear(world, hx, hy, reach, visit);
}
