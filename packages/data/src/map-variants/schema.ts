import { z } from 'zod';
import { MapAiTask, MapMultiplayerSlot, MapScriptLine } from '../schema/maps/script.js';
import { MapEscalation } from './escalation.js';

/** The kinds of variant a map can ship. A kind is also the variant's id within its map, the value the
 *  `variant` launch param and the session descriptor carry, and the key its lobby label is looked up by. */
export const MapVariantKind = z.enum(['ragnarok']);
export type MapVariantKind = z.infer<typeof MapVariantKind>;

/** Result lines added to the end of one authored mission, named by its `debuginfo` label. */
export const MapVariantMissionResults = z.strictObject({
  mission: z.string().min(1),
  results: z.array(MapScriptLine).min(1),
});
export type MapVariantMissionResults = z.infer<typeof MapVariantMissionResults>;

/** `[AIData]` tasks added after one seat's authored tasks, so every authored task keeps its index. */
export const MapVariantAiTasks = z.strictObject({
  player: z.number().int().nonnegative(),
  tasks: z.array(MapAiTask).min(1),
});
export type MapVariantAiTasks = z.infer<typeof MapVariantAiTasks>;

/**
 * What the variant changes in the map's decoded script before the world is built. Missions are named
 * by `debuginfo` label and neutralised in place, never removed: `ActivateMission <n>` addresses a
 * mission by its index, so every other mission keeps its number.
 */
export const MapVariantScriptPatch = z.strictObject({
  /** `[multiplayer]` `playeroption` rows that replace the authored row for the same seat. */
  slotOptions: z.array(MapMultiplayerSlot).default([]),
  /** Missions that keep their index but lose every goal and result and start inactive and hidden. */
  neutralizedMissions: z.array(z.string().min(1)).default([]),
  appendedResults: z.array(MapVariantMissionResults).default([]),
  /** The house mission object ids whose `tradeagreement` rows the variant drops. */
  droppedTradeHouses: z.array(z.number().int()).default([]),
  appendedAiTasks: z.array(MapVariantAiTasks).default([]),
});
export type MapVariantScriptPatch = z.infer<typeof MapVariantScriptPatch>;

/**
 * One committed variant of one map: our own authored rules over the map's decoded data, never a copy
 * of it. Every map-specific number lives here, so the systems that read it stay generic.
 */
export const MapVariant = z.strictObject({
  mapId: z.string().min(1),
  kind: MapVariantKind,
  script: MapVariantScriptPatch,
  /** Each spawned deposit node of the named good (a content good id) starts with its authored amount
   *  times this factor. */
  depositYield: z.record(z.string().min(1), z.number().int().min(1)).default({}),
  /** The siege the simulation runs over the map; absent for a variant that only patches the map. */
  escalation: MapEscalation.optional(),
});
export type MapVariant = z.infer<typeof MapVariant>;
export type MapVariantInput = z.input<typeof MapVariant>;
