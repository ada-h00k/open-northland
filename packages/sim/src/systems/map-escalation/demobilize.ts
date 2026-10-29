import {
  computerModuleRuns,
  isMachinePlayer,
  MAX_PLAYERS,
  mapEscalationProgress,
  Settler,
  writeMapEscalation,
} from '../../components/index.js';
import type { World } from '../../ecs/world.js';
import { ownedSettlers } from '../ai-shared/seat-roster.js';
import type { SystemContext } from '../context.js';
import { CIVILIST_JOB } from '../lifecycle/ageclass.js';
// The module, not `orders/index.js`, whose barrel pulls in the command handlers.
import { mayChangeTrade } from '../orders/guards.js';
import { takeUpTrade } from '../orders/work/employment.js';
import { isSoldierJob } from '../readviews/index.js';

/**
 * Once, on the first turn after the session setup named its machine seats (the setup names them all in
 * one command pass, the escalation's own fortress side included): every soldier of a seat the computer
 * player runs takes up the plain civilian trade, the way a profession order retrains one, so its arms go
 * to a store and the seat's economy employs it. Human and idle seats, and a seat whose economy the map AI
 * holds, keep their soldiers; a seat handed to the computer later keeps its own too.
 */
export function demobilizeTurn(world: World, ctx: SystemContext): void {
  if (mapEscalationProgress(world).demobilized) return;
  const seats = Array.from({ length: MAX_PLAYERS }, (_, seat) => seat);
  if (!seats.some((seat) => isMachinePlayer(world, seat))) return;
  writeMapEscalation(world, (progress) => {
    progress.demobilized = true;
  });
  for (const seat of seats) {
    if (!computerModuleRuns(world, seat, 'collectResources')) continue;
    for (const e of [...ownedSettlers(world, seat)]) {
      if (!isSoldierJob(ctx.content, world.get(e, Settler).jobType)) continue;
      if (mayChangeTrade(world, ctx.content, e)) takeUpTrade(world, ctx, e, CIVILIST_JOB);
    }
  }
}
