import { Building, Owner, StorePriority, UnderConstruction } from '../../components/index.js';
import type { Command } from '../../core/commands/index.js';
import type { World } from '../../ecs/world.js';
import type { SystemContext } from '../context.js';
import { keepsStorePriority, stockCapacity } from '../stores/index.js';

/** Mark or unmark one good as priority in a store - see the command doc. Marking needs a finished owned
 *  store whose type keeps porters and a shelf for the good; unmarking is never refused. */
export function setStorePriority(
  world: World,
  ctx: SystemContext,
  command: Extract<Command, { kind: 'setStorePriority' }>,
): void {
  const { building, goodType } = command;
  if (!world.isAlive(building)) return;
  const current = world.tryGet(building, StorePriority)?.goods;
  const marked = current?.includes(goodType) === true;
  if (marked === command.priority) return;
  if (!command.priority) {
    if (current === undefined) return;
    if (current.length === 1) world.remove(building, StorePriority);
    else {
      const goods = world.mut(building, StorePriority).goods;
      goods.splice(goods.indexOf(goodType), 1);
    }
    return;
  }
  const type = world.tryGet(building, Building)?.buildingType;
  if (type === undefined || !world.has(building, Owner) || world.has(building, UnderConstruction)) return;
  if (!keepsStorePriority(ctx.content, type) || stockCapacity(world, ctx, building, goodType) <= 0) return;
  if (current === undefined) {
    world.add(building, StorePriority, { goods: [goodType] });
    return;
  }
  const goods = world.mut(building, StorePriority).goods;
  goods.push(goodType);
  goods.sort((a, b) => a - b);
}
