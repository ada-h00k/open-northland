import type { MapEscalation, MapEscalationHero } from '@open-northland/data';
import {
  MISSION_BEHAVIOUR,
  mapEscalationProgress,
  setMissionBehaviour,
  writeMapEscalation,
} from '../../components/index.js';
import type { SettlerEquipment, SettlerEquipmentSlot } from '../../core/commands/spawn.js';
import { contentIndex } from '../../core/content-index.js';
import type { Entity, World } from '../../ecs/world.js';
import type { SystemContext } from '../context.js';
// The module, not `orders/index.js`, whose barrel pulls in the command handlers.
import { setStance } from '../orders/combat.js';
import { MILITARY_MODE } from '../readviews/index.js';
import { spawnSettler } from '../spawn/index.js';

/**
 * Place the variant's defenders once, on the escalation's first turn. Each stands outside every scripted
 * handler's list, so no task draws him off, and holds his ground in the defend stance where he was put.
 */
export function placeHeroes(world: World, ctx: SystemContext, config: MapEscalation): void {
  if (mapEscalationProgress(world).heroes !== null) return;
  const placed: Entity[] = [];
  for (const hero of config.heroes) {
    const e = spawnSettler(world, ctx, {
      kind: 'spawnSettler',
      jobType: hero.job,
      tribe: config.tribe,
      x: hero.x,
      y: hero.y,
      owner: hero.seat,
      hitpoints: hero.hitpoints,
      equipment: heroEquipment(ctx, hero),
      nameStringId: hero.nameStringId,
    });
    if (e === null) continue;
    setMissionBehaviour(world, e, MISSION_BEHAVIOUR.NOT_CONTROLLABLE, true);
    if (hero.hero)
      setMissionBehaviour(world, e, MISSION_BEHAVIOUR.GLOWS | MISSION_BEHAVIOUR.NEEDS_FROZEN, true);
    setStance(world, ctx, { kind: 'setStance', entity: e, mode: MILITARY_MODE.DEFEND });
    placed.push(e);
  }
  writeMapEscalation(world, (progress) => {
    progress.heroes = placed;
  });
}

/** Whether `e` is one of the placed defenders, whom the gear steps leave as placed. */
export function isEscalationHero(world: World, e: Entity): boolean {
  return mapEscalationProgress(world).heroes?.includes(e) ?? false;
}

/** The hero's goods by slot: each good's equip category names it, misc goods in order. */
function heroEquipment(ctx: SystemContext, hero: MapEscalationHero): SettlerEquipment {
  const index = contentIndex(ctx.content);
  const slots: {
    boots?: SettlerEquipmentSlot;
    tool?: SettlerEquipmentSlot;
    weapon?: SettlerEquipmentSlot;
    armor?: SettlerEquipmentSlot;
  } = {};
  const misc: SettlerEquipmentSlot[] = [];
  for (const slug of hero.equipment) {
    const goodType = index.goodTypeBySlug.get(slug);
    const category = goodType === undefined ? undefined : index.goods.get(goodType)?.equip?.category;
    if (goodType === undefined || category === undefined) continue;
    if (category === 'misc') misc.push({ goodType });
    else slots[category] = { goodType };
  }
  return { ...slots, misc };
}
