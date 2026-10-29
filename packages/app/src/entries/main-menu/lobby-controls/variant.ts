import { type MapVariantKind, mapVariantsOf } from '@open-northland/data';
import { selectControl } from './select.js';

/** The control's id for the map as authored, which no variant kind can take. */
const AUTHORED = 'authored';

export interface MapVariantControlText {
  readonly label: string;
  readonly modes: Readonly<Record<typeof AUTHORED | MapVariantKind, string>>;
}

/** The map mode picker: the map as authored or one of its variants. Null for a map that ships none,
 *  which shows no control at all. */
export function mapVariantControl(
  mapId: string,
  text: MapVariantControlText,
  current: MapVariantKind | null,
  change: (variant: MapVariantKind | null) => void,
  className?: string,
): HTMLElement | null {
  const variants = mapVariantsOf(mapId);
  if (variants.length === 0) return null;
  const control = selectControl(
    text.label,
    [
      { id: AUTHORED, label: text.modes[AUTHORED] },
      ...variants.map((variant) => ({ id: variant.kind, label: text.modes[variant.kind] })),
    ],
    (id) => {
      const variant = variants.find((known) => known.kind === id)?.kind ?? null;
      control.update(variant ?? AUTHORED, false);
      change(variant);
    },
    className,
  );
  control.update(current ?? AUTHORED, false);
  return control.root;
}
