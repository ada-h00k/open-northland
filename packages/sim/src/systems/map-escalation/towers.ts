import type { MapEscalation } from '@open-northland/data';
import { JobAssignment, Settler } from '../../components/index.js';
import type { World } from '../../ecs/world.js';
import { garrisonSlots } from '../ai-shared/military/defence/posts.js';
import { anchorNodeOf } from '../ai-shared/node-geometry.js';
import { isBuilt, ownedBuildings } from '../ai-shared/seat-roster.js';
import type { SystemContext } from '../context.js';
import { spawnSettler } from '../spawn/index.js';
import { assignedWorkers } from '../stores/assigned-workers.js';

type TowerGarrison = NonNullable<MapEscalation['towerGarrison']>;

/**
 * Make each finished fortress tower's missing archers at the keep, posted to it, so they walk up and man
 * it. A tower raised again since is one of the seat's buildings like the first, so it is manned again.
 */
export function keepTowerGarrison(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  garrison: TowerGarrison,
): void {
  const seat = config.keep.seat;
  for (const tower of ownedBuildings(world, seat)) {
    const posts = garrisonSlots(world, ctx, tower);
    if (posts.size === 0 || !isBuilt(world, tower)) continue;
    const anchor = anchorNodeOf(world, tower);
    if (anchor === null) continue;
    const held = new Map<number, number>();
    for (const e of assignedWorkers(world, tower)) {
      const job = world.tryGet(e, Settler)?.jobType;
      if (job != null) held.set(job, (held.get(job) ?? 0) + 1);
    }
    for (const slot of garrison.slots) {
      const missing = Math.min(slot.count, posts.get(slot.job) ?? 0) - (held.get(slot.job) ?? 0);
      for (let i = 0; i < missing; i++) {
        const e = spawnSettler(world, ctx, {
          kind: 'spawnSettler',
          jobType: slot.job,
          tribe: config.tribe,
          x: config.keep.x,
          y: config.keep.y,
          owner: seat,
          workplace: { x: anchor.hx, y: anchor.hy },
        });
        // A man the tower would not take joins the guard; the next beat tries again.
        if (e === null || world.tryGet(e, JobAssignment)?.workplace !== tower) break;
      }
    }
  }
}
