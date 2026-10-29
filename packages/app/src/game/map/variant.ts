import {
  applyMapVariantScript,
  findMapVariant,
  type MapScript,
  type MapVariant,
  type MapVariantKind,
  mapVariantsOf,
} from '@open-northland/data';
import type { SessionWorld } from '@open-northland/lockstep';

/** `?variant=<kind>`: which committed variant of the map a launch plays; absent plays it as authored. */
export const MAP_VARIANT_PARAM = 'variant';

/** The variant `?variant=` names for `mapId`; null when it names none the map ships. */
export function mapVariantParam(params: URLSearchParams, mapId: string | null): MapVariantKind | null {
  const kind = params.get(MAP_VARIANT_PARAM);
  if (kind === null || mapId === null) return null;
  return findMapVariant(mapId, kind)?.kind ?? null;
}

/** The variant a session's world is built under. Throws on a variant this build does not ship, because a
 *  peer or save naming it describes a world this client cannot assemble. */
export function sessionMapVariant(world: SessionWorld): MapVariant | null {
  if (world.kind !== 'map' || world.variant === undefined) return null;
  const variant = findMapVariant(world.mapId, world.variant);
  if (variant === null) throw new Error(`map ${world.mapId} ships no variant ${world.variant}`);
  return variant;
}

/** The map's script as the session's world plays it. */
export function variantMapScript(script: MapScript, world: SessionWorld): MapScript;
export function variantMapScript(script: MapScript | null, world: SessionWorld): MapScript | null;
export function variantMapScript(script: MapScript | null, world: SessionWorld): MapScript | null {
  const variant = sessionMapVariant(world);
  return script === null || variant === null ? script : applyMapVariantScript(script, variant);
}

/** The map world a launch plays: `mapId` under `variant`, or as authored. */
export function mapSessionWorld(mapId: string, variant: string | null): SessionWorld {
  return variant === null ? { kind: 'map', mapId } : { kind: 'map', mapId, variant };
}

export function hasMapVariants(mapId: string): boolean {
  return mapVariantsOf(mapId).length > 0;
}
