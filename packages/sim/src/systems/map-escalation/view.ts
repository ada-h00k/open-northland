import type { MapEscalation } from '@open-northland/data';
import { mapEscalationProgress } from '../../components/index.js';
import type { World } from '../../ecs/world.js';
import { attackEndsTick, launchTick } from './schedule.js';

/** What the HUD and render read of a map escalation. */
export interface MapEscalationView {
  /** The running attack's number, else the last launch that fell due; 0 before the first. */
  readonly wave: number;
  readonly attackRunning: boolean;
  /** The tick the running attack ends by at the latest; null between attacks. */
  readonly attackEndsByTick: number | null;
  /** The tick the next attack launches on. */
  readonly nextAttackTick: number;
}

export function mapEscalationView(world: World, config: MapEscalation): MapEscalationView {
  const { launches, attack } = mapEscalationProgress(world);
  return {
    wave: attack?.wave ?? launches,
    attackRunning: attack !== null,
    attackEndsByTick: attack === null ? null : attackEndsTick(config, attack.launchedTick),
    nextAttackTick: launchTick(config, launches),
  };
}
