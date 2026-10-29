import { MapVariant, MapVariantKind } from './schema.js';
import { SPECJALNA_FORTECA_RAGNAROK } from './specjalna-forteca-ragnarok.js';

/** Every committed map variant, validated once at load. */
export const MAP_VARIANTS: readonly MapVariant[] = MapVariant.array().parse([SPECJALNA_FORTECA_RAGNAROK]);

/** The variants a map ships, in lobby order; empty for most maps. */
export function mapVariantsOf(mapId: string): readonly MapVariant[] {
  return MAP_VARIANTS.filter((variant) => variant.mapId === mapId);
}

/** The variant `kind` of `mapId`; null when the map ships no such variant. */
export function findMapVariant(mapId: string, kind: string): MapVariant | null {
  const known = MapVariantKind.safeParse(kind);
  if (!known.success) return null;
  return MAP_VARIANTS.find((variant) => variant.mapId === mapId && variant.kind === known.data) ?? null;
}
