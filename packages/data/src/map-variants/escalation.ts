import { z } from 'zod';

const count = z.number().int().nonnegative();
const seconds = z.number().int().nonnegative();
const seat = z.number().int().nonnegative();
/** A half-cell node of the map, as the map's own AI rows name points. */
const mapPoint = z.number().int().nonnegative();

/** One trade of a spawn mix and its share; the mix splits a spawn by weight, larger remainders first. */
export const MapEscalationJobShare = z.strictObject({
  job: z.number().int().nonnegative(),
  weight: z.number().int().positive(),
});
export type MapEscalationJobShare = z.infer<typeof MapEscalationJobShare>;

/** The men one attack sends against each targeted seat: on foot from the keep, and by ship. */
export const MapEscalationWaveSize = z.strictObject({ landMen: count, seaMen: count });
export type MapEscalationWaveSize = z.infer<typeof MapEscalationWaveSize>;

/** Where a seat's sea landing comes from and where it puts its men ashore: a sea node the ship
 *  appears on, and the shore node it docks at and lands them on. */
const MapEscalationLandingPoints = z.strictObject({
  spawnX: mapPoint,
  spawnY: mapPoint,
  x: mapPoint,
  y: mapPoint,
});

/** A targeted player seat, the raider seat that attacks it and the point its men march on: the
 *  seat's headquarters, which the attack holds to while it stands. */
const MapEscalationTarget = z.strictObject({
  seat,
  raider: seat,
  x: mapPoint,
  y: mapPoint,
  landing: MapEscalationLandingPoints.optional(),
});

/** A refill beat of the guard: from `fromSeconds` on, `men` every `everySeconds`. */
const MapEscalationRefill = z.strictObject({
  fromSeconds: seconds,
  everySeconds: z.number().int().positive(),
  men: count,
});

/** One piece of a gear step: each soldier draws `chancePct` for it, then one of `goods` (content good
 *  slugs) at random; the good's own equip category names the slot, a misc good the first free one. */
const MapEscalationGearGrant = z.strictObject({
  goods: z.array(z.string().min(1)).min(1),
  chancePct: z.number().int().min(1).max(100).default(100),
});

/** At `atSeconds` every soldier of the gear seats gets the step's grants, and so does every soldier
 *  they create later; `noticeKey` names the notice the app shows. */
const MapEscalationGearStep = z.strictObject({
  atSeconds: seconds,
  noticeKey: z.string().min(1),
  grants: z.array(MapEscalationGearGrant).min(1),
});

const ascending = (values: readonly number[]) => values.every((v, i) => i === 0 || (values[i - 1] ?? v) < v);

/**
 * A map's escalating siege: a fortress seat that keeps its garrison growing and sends a fresh attack
 * from its keep against every occupied player seat on a fixed schedule. Times count from match start.
 */
export const MapEscalation = z
  .strictObject({
    /** The fortress seat, its keep house (type and the range of the point it stands on) and where its
     *  men spawn. Nothing spawns once no finished keep stands there. */
    keep: z.strictObject({
      seat,
      houseType: z.number().int().positive(),
      x: mapPoint,
      y: mapPoint,
      range: count,
    }),
    /** The script's tribe number the spawned men belong to, as `CreateCreatures` names it. */
    tribe: z.number().int().nonnegative(),
    jobMix: z.array(MapEscalationJobShare).min(1),
    attacks: z.strictObject({
      /** The scheduled launches, ascending. */
      launches: z.array(MapEscalationWaveSize.extend({ atSeconds: seconds })).min(1),
      /** After the last launch, one more every `everySeconds`, cycling through `waves`. */
      repeat: z.strictObject({
        everySeconds: z.number().int().positive(),
        waves: z.array(MapEscalationWaveSize).min(1),
      }),
      /** An attack ends when every man it sent is dead, or this long after its launch. */
      endAfterSeconds: z.number().int().positive(),
      targets: z.array(MapEscalationTarget).min(1),
    }),
    /** The fortress's own guard: a soldier cap of `base` plus, per occupied target seat,
     *  `perSeatStep` for each completed `stepSeconds`, at most `perSeatMax`; filled by the refill beats. */
    guard: z.strictObject({
      base: count,
      perSeatStep: count,
      stepSeconds: z.number().int().positive(),
      perSeatMax: count,
      /** Ascending by `fromSeconds`, the first from 0. */
      refill: z.array(MapEscalationRefill).min(1),
    }),
    /** The fortress side's gear over time: the seats whose soldiers get it, and the steps, ascending. */
    gear: z
      .strictObject({
        seats: z.array(seat).min(1),
        steps: z.array(MapEscalationGearStep).min(1),
      })
      .optional(),
    /** The sea landings a wave with `seaMen` brings: one ship of `vehicle` (a content vehicle slug) per
     *  targeted seat with landing points, carrying at most its seats, commander's included. `noticeKey`
     *  names the notice the app shows when the ships set out. */
    landings: z.strictObject({ vehicle: z.string().min(1), noticeKey: z.string().min(1) }).optional(),
    /** The fortress seat's catapults standing at the first turn come back at their spot this long
     *  after one is lost, one per guard refill beat, while the keep stands. */
    catapults: z.strictObject({ respawnSeconds: z.number().int().positive() }).optional(),
    /** At match start every soldier of a seat the computer player runs becomes a civilian, so the
     *  seat builds up with them; human, idle and map-scripted seats keep theirs. */
    demobilizeComputerSeats: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!ascending(value.attacks.launches.map((row) => row.atSeconds)))
      ctx.addIssue({ code: 'custom', path: ['attacks', 'launches'], message: 'launches must ascend' });
    const refill = value.guard.refill.map((row) => row.fromSeconds);
    if (refill[0] !== 0 || !ascending(refill))
      ctx.addIssue({ code: 'custom', path: ['guard', 'refill'], message: 'refill beats must ascend from 0' });
    if (value.gear !== undefined && !ascending(value.gear.steps.map((row) => row.atSeconds)))
      ctx.addIssue({ code: 'custom', path: ['gear', 'steps'], message: 'gear steps must ascend' });
    const seats = value.attacks.targets.map((row) => row.seat);
    if (new Set(seats).size !== seats.length)
      ctx.addIssue({ code: 'custom', path: ['attacks', 'targets'], message: 'a seat is targeted twice' });
  });
export type MapEscalation = z.infer<typeof MapEscalation>;
export type MapEscalationInput = z.input<typeof MapEscalation>;
