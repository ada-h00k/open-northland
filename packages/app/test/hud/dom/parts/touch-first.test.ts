// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { touchFirstDevice } from '../../../../src/hud/dom/parts/touch-first.js';

/** A jsdom has no matchMedia; the tests write one answering the given query results. */
function matchMediaOf(answers: Readonly<Record<string, boolean>>): void {
  (window as { matchMedia?: unknown }).matchMedia = vi
    .fn()
    .mockImplementation((query: string) => ({ matches: answers[query] === true, media: query }));
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

it('reads a finger-first device: a coarse pointer with no fine one', () => {
  matchMediaOf({ '(any-pointer: coarse)': true, '(any-pointer: fine)': false });
  expect(touchFirstDevice()).toBe(true);
});

it('reads a mouse-only device: no coarse pointer at all', () => {
  matchMediaOf({ '(any-pointer: coarse)': false, '(any-pointer: fine)': true });
  expect(touchFirstDevice()).toBe(false);
});

it('reads a touch screen beside a mouse as a mouse device', () => {
  matchMediaOf({ '(any-pointer: coarse)': true, '(any-pointer: fine)': true });
  expect(touchFirstDevice()).toBe(false);
});

it('reads a document without matchMedia as a desktop, so tests keep the mouse manners', () => {
  expect(touchFirstDevice()).toBe(false);
});
