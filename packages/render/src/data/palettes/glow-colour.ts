/**
 * The palette index a hero's glow takes its colour from: step 10 of the team ramp in the body palette's
 * vest band (160-175), which each player's team row of the human LUT carries. Original behavior: the glow
 * colour is that step of the owner's `Player NN` ramp.
 */
export const GLOW_PALETTE_INDEX = 170;
const RGB = 3;
const CHANNEL_MAX = 255;
/** Rec. 709 luma weights, applied to the sRGB bytes. */
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;

/**
 * Below this luma (0..1) a hero glow vanishes against dark ground: black, maroon, navy, brown and purple
 * fall under it, every other player colour stays above.
 */
export const GLOW_MIN_LUMA = 0.35;
/** How far toward white a too-dark glow colour moves; it keeps a trace of the owner's hue. */
const GLOW_DARK_LIFT = 0.6;

/**
 * Lift the glow colour at {@link GLOW_PALETTE_INDEX} toward white when it is darker than {@link GLOW_MIN_LUMA}.
 * The original takes the entry as it is, so a dark owner's hero glows near-black; the lift is a project
 * choice that keeps it visible.
 */
export function liftDarkGlowColour(palette: Uint8Array): void {
  const at = GLOW_PALETTE_INDEX * RGB;
  const r = palette[at] ?? 0;
  const g = palette[at + 1] ?? 0;
  const b = palette[at + 2] ?? 0;
  if ((LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b) / CHANNEL_MAX >= GLOW_MIN_LUMA) return;
  palette[at] = Math.round(r + (CHANNEL_MAX - r) * GLOW_DARK_LIFT);
  palette[at + 1] = Math.round(g + (CHANNEL_MAX - g) * GLOW_DARK_LIFT);
  palette[at + 2] = Math.round(b + (CHANNEL_MAX - b) * GLOW_DARK_LIFT);
}
