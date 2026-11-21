// @vitest-environment jsdom
import type { HudModel } from '@open-northland/render';
import { afterEach, expect, it, vi } from 'vitest';
import {
  AVAILABILITY_REFRESH_MS,
  type ConstructionWindow,
  createConstructionWindow,
} from '../../../src/hud/dom/construction-window.js';
import {
  type BuildingAvailability,
  type MenuBuildingEntry,
  OPEN_AVAILABILITY,
} from '../../../src/hud/tool-panel/building-menu.js';

const VIKING = 1;
const FARM = 12;
const FORBIDDEN: BuildingAvailability = { kind: 'forbidden' };

afterEach(() => {
  document.body.replaceChildren();
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

it('lists a house a script allowed while the world is paused, once the answer lands', () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 40, 33));
  let availability: BuildingAvailability = FORBIDDEN;
  let answers = 0;
  const farm: MenuBuildingEntry = {
    typeId: FARM,
    label: 'Farm',
    kind: 'work',
    cost: [],
    trades: [],
    availability: () => availability,
  };
  const plane = document.createElement('div');
  document.body.append(plane);
  const window = createConstructionWindow({
    plane,
    hudScale: () => 1,
    entries: [farm],
    thumbs: { paint: () => false, holds: () => false },
    pack: null,
    goodIdOf: () => undefined,
    goodLabel: (goodType) => `#${goodType}`,
    papers: () => [],
    paperLabel: () => '',
    buildingLabel: (typeId) => `#${typeId}`,
    homeTribe: VIKING,
    buildTribes: () => [VIKING],
    answersVersion: () => answers,
    onPick: () => undefined,
    tools: [],
    onPickTool: () => undefined,
    onPickPaper: () => undefined,
    onHelp: () => undefined,
    cue: () => undefined,
  });
  const listed = (): number => plane.querySelectorAll('.on-bcard').length;
  try {
    // The paused world's one model: the window opens on the answer held from before the script's result.
    const model: HudModel = { tick: 8, player: 0, population: 0, jobs: [], stocks: [] };
    const opened = 1000;
    const now = vi.spyOn(performance, 'now').mockReturnValue(opened);
    window.update(model);
    window.toggle();
    expect(listed()).toBe(0);

    availability = OPEN_AVAILABILITY;
    window.update(model);
    expect(listed()).toBe(0);

    // The answer lands, but the entries' availability is read at most every quarter second.
    answers += 1;
    window.update(model);
    expect(listed()).toBe(0);
    now.mockReturnValue(opened + AVAILABILITY_REFRESH_MS);
    window.update(model);
    expect(listed()).toBe(1);
  } finally {
    window.dispose();
  }
});

/** A jsdom has no matchMedia; the tests write one answering the given query results. */
function matchMediaOf(answers: Readonly<Record<string, boolean>>): void {
  (window as { matchMedia?: unknown }).matchMedia = vi
    .fn()
    .mockImplementation((query: string) => ({ matches: answers[query] === true, media: query }));
}

/** The window's seams against a plane of the given size at the given HUD scale, an empty catalogue. */
function mounted(plane: HTMLElement, hudScale: number): ConstructionWindow {
  return createConstructionWindow({
    plane,
    hudScale: () => hudScale,
    entries: [],
    thumbs: { paint: () => false, holds: () => false },
    pack: null,
    goodIdOf: () => undefined,
    goodLabel: (goodType) => `#${goodType}`,
    papers: () => [],
    paperLabel: () => '',
    buildingLabel: (typeId) => `#${typeId}`,
    homeTribe: VIKING,
    buildTribes: () => [VIKING],
    answersVersion: () => 0,
    onPick: () => undefined,
    tools: [],
    onPickTool: () => undefined,
    onPickPaper: () => undefined,
    onHelp: () => undefined,
    cue: () => undefined,
  });
}

it('opens with the search field focused, the open-for-typing kind a mouse expects', () => {
  const plane = document.createElement('div');
  document.body.append(plane);
  const window = mounted(plane, 1);
  try {
    window.toggle();
    expect(document.activeElement).toBe(plane.querySelector('.on-construction-search input'));
  } finally {
    window.dispose();
  }
});

it('leaves the search unfocused on a finger-first device, whose keyboard would cover the window', () => {
  matchMediaOf({ '(any-pointer: coarse)': true, '(any-pointer: fine)': false });
  const plane = document.createElement('div');
  document.body.append(plane);
  const window = mounted(plane, 1);
  try {
    window.toggle();
    expect(document.activeElement).not.toBe(plane.querySelector('.on-construction-search input'));
  } finally {
    window.dispose();
  }
});

it('keeps the search focus on a touch screen beside a mouse', () => {
  matchMediaOf({ '(any-pointer: coarse)': true, '(any-pointer: fine)': true });
  const plane = document.createElement('div');
  document.body.append(plane);
  const window = mounted(plane, 1);
  try {
    window.toggle();
    expect(document.activeElement).toBe(plane.querySelector('.on-construction-search input'));
  } finally {
    window.dispose();
  }
});

it('keeps the fixed design width on a desktop scale', () => {
  const plane = document.createElement('div');
  document.body.append(plane);
  Object.defineProperty(plane, 'clientWidth', { value: 1920, configurable: true });
  Object.defineProperty(plane, 'clientHeight', { value: 1080, configurable: true });
  const window = mounted(plane, 1);
  try {
    window.toggle();
    const shell = plane.querySelector('.on-window--construction');
    if (!(shell instanceof HTMLElement)) throw new Error('construction: window shell');
    expect(shell.getAttribute('style')).toContain('width: 640px');
    expect(shell.classList.contains('on-window--phone')).toBe(false);
  } finally {
    window.dispose();
  }
});

it('widens to the plane on a phone scale and marks the window for the parchment fill', () => {
  const plane = document.createElement('div');
  document.body.append(plane);
  Object.defineProperty(plane, 'clientWidth', { value: 1361, configurable: true });
  Object.defineProperty(plane, 'clientHeight', { value: 629, configurable: true });
  const window = mounted(plane, 0.62);
  try {
    window.toggle();
    const shell = plane.querySelector('.on-window--construction');
    if (!(shell instanceof HTMLElement)) throw new Error('construction: window shell');
    expect(shell.classList.contains('on-window--phone')).toBe(true);
    expect(shell.getAttribute('style')).toContain('width: 1252px'); // the plane less the fill's share
  } finally {
    window.dispose();
  }
});
