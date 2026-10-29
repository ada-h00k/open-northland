import type { MapEscalation } from '@open-northland/data';
import {
  Equipment,
  ensureEquipment,
  mapEscalationProgress,
  Owner,
  Settler,
  writeEquipSlot,
  writeMapEscalation,
} from '../../components/index.js';
import { contentIndex } from '../../core/content-index.js';
import { ZERO } from '../../core/fixed.js';
import { TICKS_PER_SECOND } from '../../core/loop.js';
import type { Entity, World } from '../../ecs/world.js';
import { ownedSettlers } from '../ai-shared/seat-roster.js';
import type { SystemContext } from '../context.js';
import { isSoldierJob, mayChangeEquipment } from '../readviews/index.js';

type GearConfig = NonNullable<MapEscalation['gear']>;
type GearStep = GearConfig['steps'][number];

const PERCENT = 100;
/** Ticks between two looks at the entities created since the last one. */
const NEWCOMER_CHECK_TICKS = TICKS_PER_SECOND;

/**
 * The fortress side's gear: when a step falls due every soldier of the gear seats gets it, and every
 * soldier created for those seats later (a refill, a band, a script spawn) gets each step already passed,
 * within a second. Newcomers are found by entity id above a watermark, so the look costs the entities
 * created since the last one. A settler that becomes a gear seat's soldier by a trade or owner change is
 * not seen: a gear seat is a scripted camp that neither trains nor is handed people.
 */
export function gearTurn(world: World, ctx: SystemContext, gear: GearConfig): void {
  const passed = mapEscalationProgress(world).gearSteps;
  const due = gear.steps[passed];
  const stepDue = due !== undefined && ctx.tick >= due.atSeconds * TICKS_PER_SECOND;
  // Before a step pass, so a soldier it reaches is not counted a newcomer again later.
  if (passed > 0 && (stepDue || ctx.tick % NEWCOMER_CHECK_TICKS === 0))
    gearNewcomers(world, ctx, gear, passed);
  if (!stepDue) return;
  const seats = new Set(gear.seats);
  for (const seat of seats) {
    for (const e of ownedSettlers(world, seat))
      if (isGearedSoldier(world, ctx, e)) grantStep(world, ctx, e, due);
  }
  const step = passed + 1;
  const below = world.nextEntityId;
  writeMapEscalation(world, (progress) => {
    progress.gearSteps = step;
    progress.gearedBelow = below;
  });
  ctx.events.emit({ kind: 'mapEscalationGearStep', step, noticeKey: due.noticeKey });
}

function gearNewcomers(world: World, ctx: SystemContext, gear: GearConfig, passed: number): void {
  const from = mapEscalationProgress(world).gearedBelow;
  const below = world.nextEntityId;
  if (below <= from) return;
  const seats = new Set(gear.seats);
  for (let id = from; id < below; id++) {
    const e = id as Entity;
    if (!world.isAlive(e)) continue;
    const owner = world.tryGet(e, Owner)?.player;
    if (owner === undefined || !seats.has(owner) || !isGearedSoldier(world, ctx, e)) continue;
    for (const step of gear.steps.slice(0, passed)) grantStep(world, ctx, e, step);
  }
  writeMapEscalation(world, (progress) => {
    progress.gearedBelow = below;
  });
}

function isGearedSoldier(world: World, ctx: SystemContext, e: Entity): boolean {
  const settler = world.tryGet(e, Settler);
  return (
    settler !== undefined &&
    isSoldierJob(ctx.content, settler.jobType) &&
    mayChangeEquipment(world, ctx.content, e)
  );
}

/** Each grant draws its chance, then one of its goods; the good's equip category names the slot. A misc
 *  good takes the first free misc slot and is lost when none is free; a good without one is skipped. */
function grantStep(world: World, ctx: SystemContext, e: Entity, step: GearStep): void {
  const index = contentIndex(ctx.content);
  for (const grant of step.grants) {
    if (grant.chancePct < PERCENT && ctx.rng.int(PERCENT) >= grant.chancePct) continue;
    const slug = grant.goods.length === 1 ? grant.goods[0] : grant.goods[ctx.rng.int(grant.goods.length)];
    const goodType = slug === undefined ? undefined : index.goodTypeBySlug.get(slug);
    const category = goodType === undefined ? undefined : index.goods.get(goodType)?.equip?.category;
    if (goodType === undefined || category === undefined) continue;
    ensureEquipment(world, e);
    const slot = category === 'misc' ? world.get(e, Equipment).misc.indexOf(null) : 0;
    if (slot < 0) continue;
    writeEquipSlot(world, e, category, slot, { goodType, degreeOfUse: ZERO });
  }
}
