import type { MapEscalation } from '@open-northland/data';
import { contentIndex } from '../../core/content-index.js';
import type { SystemContext } from '../context.js';

/** What a fallen character keeps with its bones: the listed good types, or everything. */
export type WithheldDeathDrops = ReadonlySet<number> | 'all';

const NONE: ReadonlySet<number> = new Set();
/** The withheld good types per config object, resolved once per content: both are immutable inputs. */
const resolved = new WeakMap<object, { readonly content: object; readonly goods: ReadonlySet<number> }>();

/** What a fallen character of `seat` leaves with its bones under the map escalation's
 *  `withheldDeathDrops`; nothing for every other seat and for a world without the rule. An unknown good
 *  slug withholds nothing. */
export function withheldDeathDropsOf(ctx: SystemContext, seat: number | undefined): WithheldDeathDrops {
  const rule: MapEscalation['withheldDeathDrops'] = ctx.mapEscalation?.withheldDeathDrops;
  if (rule === undefined || seat === undefined || !rule.seats.includes(seat)) return NONE;
  if (rule.goods === 'all') return 'all';
  const cached = resolved.get(rule);
  if (cached !== undefined && cached.content === ctx.content) return cached.goods;
  const bySlug = contentIndex(ctx.content).goodTypeBySlug;
  const goods = new Set(rule.goods.flatMap((slug) => bySlug.get(slug) ?? []));
  resolved.set(rule, { content: ctx.content, goods });
  return goods;
}
