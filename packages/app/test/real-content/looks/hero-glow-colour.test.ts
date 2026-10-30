import { createHumanPaletteColours, GLOW_PALETTE_INDEX, liftDarkGlowColour } from '@open-northland/render';
import { describe, expect, it } from 'vitest';
import { PLAYER_COLOR_NAMES } from '../../../src/catalog/roster.js';
import type { ContentIr } from '../../../src/content/ir/rows.js';
import { humanPaletteBook } from '../../../src/content/sprite-sheet/human-palettes.js';
import { hasRealIr, rawIrUnderTest } from '../helpers.js';

const RGB = 3;

describe.runIf(hasRealIr())('the hero glow over the real player ramps', () => {
  it('lifts the black, maroon, navy, brown and purple glows and leaves every other colour', () => {
    const book = humanPaletteBook(rawIrUnderTest() as ContentIr);
    if (book === undefined) throw new Error('the served content has no human palettes');
    const team = createHumanPaletteColours();
    const at = GLOW_PALETTE_INDEX * RGB;
    const lifted = PLAYER_COLOR_NAMES.filter((_name, player) => {
      book.composeTeam(player, team);
      const before = [...team.body.subarray(at, at + RGB)];
      liftDarkGlowColour(team.body);
      return team.body.subarray(at, at + RGB).some((value, i) => value !== before[i]);
    });
    expect(lifted).toEqual(['purple', 'black', 'maroon', 'navy', 'brown']);
  });
});
