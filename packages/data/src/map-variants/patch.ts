import { mapSlotEligibility } from '../map-lobby.js';
import type { TerrainEntities } from '../schema/maps/entities.js';
import type { MapsIndexPlayerSlot } from '../schema/maps/listing.js';
import type { MapMission, MapScript } from '../schema/maps/script.js';
import type { MapVariant } from './schema.js';

const ACTIVATE_MISSION = 'ActivateMission';

/**
 * The map's script as the variant plays it. Throws when the variant names a mission the script lacks
 * or leaves a kept mission activating a neutralised one: either means the variant was written for
 * another version of the map, and playing it half-applied would be a third map.
 */
export function applyMapVariantScript(script: MapScript, variant: MapVariant): MapScript {
  const patch = variant.script;
  const indexOf = missionIndexes(script.missions, variant);
  const neutralized = new Set(patch.neutralizedMissions.map(indexOf));
  const appended = new Map<number, MapMission['results']>();
  for (const row of patch.appendedResults) {
    const index = indexOf(row.mission);
    if (neutralized.has(index)) throw new Error(`${label(variant)}: appends to neutralised ${row.mission}`);
    appended.set(index, [...(appended.get(index) ?? []), ...row.results]);
  }
  const missions = script.missions.map((mission, index): MapMission => {
    if (neutralized.has(index)) return neutralizedMission(mission);
    const extra = appended.get(index);
    return extra === undefined ? mission : { ...mission, results: [...mission.results, ...extra] };
  });
  missions.forEach((mission, index) => {
    if (neutralized.has(index)) return;
    for (const line of mission.results) {
      const target = line.values[0] === ACTIVATE_MISSION ? Number(line.values[1]) : null;
      if (target !== null && neutralized.has(target))
        throw new Error(
          `${label(variant)}: ${mission.debugName ?? index} still activates neutralised ${target}`,
        );
    }
  });
  const dropped = new Set(patch.droppedTradeHouses);
  return {
    ...script,
    ai: patchedAi(script.ai, variant),
    ...(script.multiplayer === undefined && patch.slotOptions.length === 0
      ? {}
      : { multiplayer: patchedMultiplayer(script.multiplayer, patch.slotOptions) }),
    tradeAgreements: script.tradeAgreements.filter((row) => !dropped.has(row.missionId)),
    missions,
  };
}

/** The map's placements as the variant starts them: its settlers after the authored ones, so every
 *  authored placement keeps its place in the order entity ids are minted in. */
export function applyMapVariantEntities(entities: TerrainEntities, variant: MapVariant): TerrainEntities {
  if (variant.startHumans.length === 0) return entities;
  return { ...entities, humans: [...entities.humans, ...variant.startHumans] };
}

/** The lobby rows of a map index entry as the variant offers them: only the eligibility a replaced
 *  `playeroption` row decides changes. */
export function applyMapVariantSlots(
  slots: readonly MapsIndexPlayerSlot[],
  variant: MapVariant,
): MapsIndexPlayerSlot[] {
  const options = new Map(variant.script.slotOptions.map((row) => [row.player, row.allowed]));
  return slots.map((slot) => {
    const allowed = options.get(slot.player);
    return allowed === undefined ? slot : { ...slot, ...mapSlotEligibility(slot.type, allowed) };
  });
}

function missionIndexes(missions: readonly MapMission[], variant: MapVariant): (name: string) => number {
  const byName = new Map<string, number>();
  // A repeated label cannot name one mission, so the variant may not use it.
  const repeated = new Set<string>();
  missions.forEach((mission, index) => {
    if (mission.debugName === undefined) return;
    if (byName.has(mission.debugName)) repeated.add(mission.debugName);
    byName.set(mission.debugName, index);
  });
  return (name) => {
    const index = byName.get(name);
    if (index === undefined || repeated.has(name))
      throw new Error(`${label(variant)}: the script has no single mission named ${name}`);
    return index;
  };
}

/** Each seat's rows with the variant's tasks after its authored ones. */
function patchedAi(rows: MapScript['ai'], variant: MapVariant): MapScript['ai'] {
  const appended = variant.script.appendedAiTasks;
  for (const row of appended) {
    if (!rows.some((seat) => seat.player === row.player))
      throw new Error(`${label(variant)}: the script has no [AIData] rows for seat ${row.player}`);
  }
  if (appended.length === 0) return rows;
  return rows.map((seat) => {
    const extra = appended.filter((row) => row.player === seat.player).flatMap((row) => row.tasks);
    return extra.length === 0 ? seat : { ...seat, tasks: [...seat.tasks, ...extra] };
  });
}

function neutralizedMission(mission: MapMission): MapMission {
  return {
    ...(mission.debugName === undefined ? {} : { debugName: mission.debugName }),
    goals: [],
    results: [],
    other: [],
  };
}

function patchedMultiplayer(
  table: MapScript['multiplayer'],
  rows: MapVariant['script']['slotOptions'],
): NonNullable<MapScript['multiplayer']> {
  const replaced = new Set(rows.map((row) => row.player));
  const kept = (table?.slotOptions ?? []).filter((row) => !replaced.has(row.player));
  return {
    hiddenSlots: [],
    other: [],
    ...table,
    slotOptions: [...kept, ...rows].sort((a, b) => a.player - b.player),
  };
}

function label(variant: MapVariant): string {
  return `map variant ${variant.mapId}/${variant.kind}`;
}
