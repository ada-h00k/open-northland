// @vitest-environment jsdom
import type { HudModel } from '@open-northland/render';
import { TICKS_PER_SECOND } from '@open-northland/sim';
import { afterEach, describe, expect, it } from 'vitest';
import { createHudSystemBar } from '../../../../src/hud/dom/system/bar.js';
import { formatSimClock } from '../../../../src/hud/summary/model.js';

afterEach(() => {
  document.body.replaceChildren();
});

/** A peace with one minute and five seconds left at tick 0. */
const PEACE_LEFT_SECONDS = 65;

const modelAt = (tick: number): HudModel => ({ tick, player: 0, population: 0, jobs: [], stocks: [] });

const barDeps = () => ({
  summary: { paintGood: () => {}, goodIdOf: () => undefined, goodLabel: (goodId: string) => goodId },
  onPauseToggle: () => {},
  onSpeed: () => {},
  onMenu: () => {},
});

describe('the system bar', () => {
  it('shows the peace as its time left in its own cell, named for assistive tech, gone once it ends', () => {
    const bar = createHudSystemBar(document.body, barDeps());
    const peace = document.querySelector<HTMLElement>('.on-peace');
    const endsAt = PEACE_LEFT_SECONDS * TICKS_PER_SECOND;

    bar.update(modelAt(0), endsAt);
    expect(peace?.hidden).toBe(false);
    expect(peace?.textContent).toBe('1:05');
    expect(peace?.querySelector('svg')).not.toBeNull();
    expect(peace?.getAttribute('aria-label')).toContain('1:05');
    expect(peace?.dataset.tip).not.toContain('1:05');

    bar.update(modelAt(endsAt), null);
    expect(peace?.hidden).toBe(true);
    bar.dispose();
  });

  it('reads a recording watch as current time over the recording end, its fill following the ticks', () => {
    // An hour's recording, watched halfway in.
    const untilTick = 60 * 60 * TICKS_PER_SECOND;
    const bar = createHudSystemBar(document.body, { ...barDeps(), replay: { untilTick } });
    const progress = document.querySelector<HTMLElement>('.on-replay-progress');
    const text = progress?.querySelector<HTMLElement>('.on-replay-progress__text');
    const fill = progress?.querySelector<HTMLElement>('.on-replay-progress__fill');
    expect(progress).not.toBeNull();

    const half = untilTick / 2;
    bar.update(modelAt(half), null);
    expect(text?.textContent).toBe(`${formatSimClock(half)} / ${formatSimClock(untilTick)}`);
    expect(fill?.style.width).toBe('50%');
    expect(progress?.getAttribute('aria-valuenow')).toBe(`${half}`);
    expect(progress?.getAttribute('aria-valuemax')).toBe(`${untilTick}`);

    // Past the recording's end the cell holds at its full length, never overfills.
    bar.update(modelAt(untilTick + 500), null);
    expect(fill?.style.width).toBe('100%');
    bar.dispose();
    expect(document.querySelector('.on-replay-progress')).toBeNull();
  });

  it('keeps no progress cell for a session that plays no recording', () => {
    const bar = createHudSystemBar(document.body, barDeps());
    bar.update(modelAt(60), null);
    expect(document.querySelector('.on-replay-progress')).toBeNull();
    bar.dispose();
  });

  it('offers a recording watch one tempo button over the per-tempo segments, named for the tempo it stands at', () => {
    const asked: string[] = [];
    const bar = createHudSystemBar(document.body, {
      ...barDeps(),
      // The dev tempos reach the bar for a bench session; the watch yields them all to its cycle.
      devSpeeds: true,
      replayCycle: true,
      replay: { untilTick: 6000 },
      onSpeed: (state) => asked.push(state),
    });
    const cycle = document.querySelector<HTMLButtonElement>('.on-speed button[aria-label=""]');
    if (cycle === null) throw new Error('the watch tempo button is missing');
    // The pause yields to nothing - a watch still pauses - so the segments are the tempo buttons.
    const segments = [...document.querySelectorAll<HTMLButtonElement>('.on-speed button')].filter(
      (button) => button !== cycle && button.textContent !== '❚❚',
    );
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((button) => button.hidden)).toBe(true);
    expect(cycle.hidden).toBe(false);

    bar.setSpeed({ running: 'normal', paused: false });
    expect(cycle.textContent).toBe('×1');
    expect(cycle.getAttribute('aria-label')).toContain('×1');
    cycle.click();
    expect(asked).toEqual(['fast']);
    bar.setSpeed({ running: 'fast', paused: false });
    expect(cycle.textContent).toBe('×2');
    bar.dispose();
  });

  it('keeps the per-tempo segments and hides the tempo button for a session that plays no recording', () => {
    const bar = createHudSystemBar(document.body, { ...barDeps(), devSpeeds: true });
    bar.setSpeed({ running: 'normal', paused: false });
    const cycle = document.querySelector<HTMLButtonElement>('.on-speed button[aria-label=""]');
    expect(cycle?.hidden).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>('.on-speed button')) {
      if (button === cycle) continue;
      expect(button.hidden).toBe(false);
    }
    bar.dispose();
  });
});
