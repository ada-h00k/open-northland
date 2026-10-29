// @vitest-environment jsdom
import type { MapVariantKind } from '@open-northland/data';
import { describe, expect, it } from 'vitest';
import { mapVariantToggles } from '../../../../src/entries/main-menu/lobby-controls/variant.js';

const TEXT = { names: { ragnarok: 'Ragnarök' }, details: { ragnarok: 'Harder.' } };

describe('mapVariantToggles', () => {
  it('offers one switch per shipped variant, off by default, and reports each flip', () => {
    const changes: (MapVariantKind | null)[] = [];
    const rows = mapVariantToggles('specjalna_forteca', TEXT, null, (next) => changes.push(next));
    expect(rows.map((row) => [row.textContent, row.title])).toEqual([['Ragnarök', 'Harder.']]);
    const pill = rows[0]?.querySelector('button');
    expect(pill?.getAttribute('aria-checked')).toBe('false');
    pill?.click();
    expect(pill?.getAttribute('aria-checked')).toBe('true');
    pill?.click();
    expect(changes).toEqual(['ragnarok', null]);
  });

  it('shows nothing for a map without variants', () => {
    expect(mapVariantToggles('zatoka', TEXT, null, () => undefined)).toEqual([]);
  });
});
