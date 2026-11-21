import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTouchDevice } from '../../../src/view/platform/touch-device.js';

afterEach(() => vi.unstubAllGlobals());

describe('isTouchDevice', () => {
  it('answers a phone that points with the finger alone, as the boot notice classes it', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query === '(any-pointer: coarse)' }),
    });
    expect(isTouchDevice()).toBe(true);
  });

  it('keeps the desktop face on a device a mouse or trackpad points with', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query !== '(any-pointer: coarse)' }),
    });
    expect(isTouchDevice()).toBe(false);
  });

  it('keeps it on a touch screen beside a mouse, the comfortable device both pointers answer', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(isTouchDevice()).toBe(false);
  });

  it('keeps it where no window answers, so a headless caller reads as the desktop', () => {
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('matchMedia unavailable');
      },
    });
    expect(isTouchDevice()).toBe(false);
  });
});
