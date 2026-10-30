import { describe, expect, it } from 'vitest';
import { GLOW_PALETTE_INDEX, liftDarkGlowColour } from '../../../src/data/palettes/glow-colour.js';
import { HUMAN_PALETTE_BYTES } from '../../../src/data/palettes/human-palettes.js';

const RGB = 3;

function glowAfterLift(colour: readonly [number, number, number]): number[] {
  const palette = new Uint8Array(HUMAN_PALETTE_BYTES);
  palette.set(colour, GLOW_PALETTE_INDEX * RGB);
  liftDarkGlowColour(palette);
  return [...palette.subarray(GLOW_PALETTE_INDEX * RGB, (GLOW_PALETTE_INDEX + 1) * RGB)];
}

describe('hero glow colour', () => {
  it("lifts a dark owner's glow toward white and leaves a bright one as the ramp gives it", () => {
    // Step 10 of the black and blue `Player NN` ramps.
    const [r, g, b] = glowAfterLift([0x4f, 0x4f, 0x4f]);
    expect(r).toBeGreaterThan(0xb0);
    expect([g, b]).toEqual([r, r]);
    expect(glowAfterLift([0x4b, 0x87, 0xeb])).toEqual([0x4b, 0x87, 0xeb]);
  });
});
