// @vitest-environment jsdom
import type { HudModel } from '@open-northland/render';
import { TICKS_PER_SECOND } from '@open-northland/sim';
import { afterEach, describe, expect, it } from 'vitest';
import { createHudSystemBar } from '../../../../src/hud/dom/system/bar.js';

afterEach(() => {
  document.body.replaceChildren();
});

/** A peace with one minute and five seconds left at tick 0. */
const PEACE_LEFT_SECONDS = 65;

const modelAt = (tick: number): HudModel => ({ tick, player: 0, population: 0, jobs: [], stocks: [] });

describe('the system bar', () => {
  it('shows the peace as its time left in its own cell, named for assistive tech, gone once it ends', () => {
    const bar = createHudSystemBar(document.body, {
      summary: { paintGood: () => {}, goodIdOf: () => undefined, goodLabel: (goodId) => goodId },
      onPauseToggle: () => {},
      onSpeed: () => {},
      onMenu: () => {},
    });
    const peace = document.querySelector<HTMLElement>('.on-peace');
    const endsAt = PEACE_LEFT_SECONDS * TICKS_PER_SECOND;

    bar.update(modelAt(0), endsAt);
    expect(peace?.hidden).toBe(false);
    expect(peace?.textContent).toBe('1:05');
    expect(peace?.querySelector('svg')).not.toBeNull();
    expect(peace?.getAttribute('aria-label')).toContain('1:05');
    expect(peace?.dataset.tip).toContain('1:05');

    bar.update(modelAt(endsAt), null);
    expect(peace?.hidden).toBe(true);
    bar.dispose();
  });
});
