import { describe, expect, it } from 'vitest';
import { chosenMapVariantParam } from '../../../src/game/map/variant.js';

const RAGNAROK_SEARCH = new URLSearchParams({ map: 'specjalna_forteca', variant: 'ragnarok' });

describe('chosenMapVariantParam', () => {
  it('takes the variant the search names on a dev server', () => {
    expect(chosenMapVariantParam(RAGNAROK_SEARCH, 'specjalna_forteca', true)).toBe('ragnarok');
  });

  it('ignores the search outside a dev server', () => {
    expect(chosenMapVariantParam(RAGNAROK_SEARCH, 'specjalna_forteca', false)).toBeNull();
  });
});
