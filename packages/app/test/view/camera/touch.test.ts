// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTouchInput, type TouchCameraInput } from '../../../src/view/camera/touch.js';

/**
 * The finger gestures on the game canvas: what each maps to, and what it suppresses. The long-press's
 * timer runs on fake timers; the tap timing rides the events' own `timeStamp`.
 */

const LONG_PRESS_MS = 450;

interface MouseRecord {
  readonly type: string;
  readonly button: number;
  readonly detail: number;
  readonly x: number;
  readonly y: number;
}

const harness = () => {
  const canvas = document.createElement('canvas');
  const camera: TouchCameraInput = {
    panBy: vi.fn(),
    touchZoom: { begin: vi.fn(), move: vi.fn(), end: vi.fn() },
  };
  const mouse: MouseRecord[] = [];
  canvas.addEventListener('mousedown', (e) => {
    const event = e as MouseEvent;
    mouse.push({
      type: 'mousedown',
      button: event.button,
      detail: event.detail,
      x: event.clientX,
      y: event.clientY,
    });
  });
  canvas.addEventListener('mouseup', (e) => {
    const event = e as MouseEvent;
    mouse.push({
      type: 'mouseup',
      button: event.button,
      detail: event.detail,
      x: event.clientX,
      y: event.clientY,
    });
  });
  const dispose = installTouchInput(canvas, camera);
  return { canvas, camera, mouse, dispose };
};

/** A pointer event for the canvas; a plain `Event` with the read properties stands in where the
 *  runner lacks `PointerEvent`, which the layer's listeners answer the same way. */
const pointer = (
  canvas: HTMLCanvasElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  at: { readonly x: number; readonly y: number },
  id = 1,
  pointerType = 'touch',
): boolean => {
  const ctor = window.PointerEvent ?? null;
  const event =
    ctor !== null
      ? new ctor(type, {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType,
          clientX: at.x,
          clientY: at.y,
        })
      : Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
          pointerId: id,
          pointerType,
          clientX: at.x,
          clientY: at.y,
        });
  return canvas.dispatchEvent(event);
};

describe('installTouchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers a tap with one left press and release at the finger, and no camera pan', () => {
    const { canvas, camera, mouse } = harness();
    expect(pointer(canvas, 'pointerdown', { x: 40, y: 60 })).toBe(false); // prevented: no page gesture
    expect(pointer(canvas, 'pointerup', { x: 40, y: 60 })).toBe(true); // the release prevents nothing
    expect(mouse).toEqual([
      { type: 'mousedown', button: 0, detail: 1, x: 40, y: 60 },
      { type: 'mouseup', button: 0, detail: 1, x: 40, y: 60 },
    ]);
    expect(camera.panBy).not.toHaveBeenCalled();
  });

  it("suppresses the page's gestures: a touch pointerdown is prevented", () => {
    const { canvas } = harness();
    expect(pointer(canvas, 'pointerdown', { x: 40, y: 60 })).toBe(false); // preventDefault answered
  });

  it('answers a held finger with the right press, then releases it when the finger lifts', () => {
    const { canvas, camera, mouse } = harness();
    pointer(canvas, 'pointerdown', { x: 40, y: 60 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer(canvas, 'pointerup', { x: 40, y: 60 });
    expect(mouse).toEqual([
      { type: 'mousedown', button: 2, detail: 1, x: 40, y: 60 },
      { type: 'mouseup', button: 2, detail: 1, x: 40, y: 60 },
    ]);
    expect(camera.panBy).not.toHaveBeenCalled();
    expect(camera.touchZoom.begin).not.toHaveBeenCalled();
  });

  it('turns a press that drifts past the slop into the pan, with no click and no hold', () => {
    const { canvas, camera, mouse } = harness();
    pointer(canvas, 'pointerdown', { x: 100, y: 100 });
    pointer(canvas, 'pointermove', { x: 112, y: 100 }); // past the 10 px slop
    pointer(canvas, 'pointermove', { x: 118, y: 103 });
    pointer(canvas, 'pointerup', { x: 118, y: 103 });
    expect(camera.panBy).toHaveBeenNthCalledWith(1, 12, 0);
    expect(camera.panBy).toHaveBeenNthCalledWith(2, 6, 3);
    expect(mouse).toEqual([]); // a drag is not a click
  });

  it("pans by each move's own step, so a stalled finger carries no stale delta", () => {
    const { canvas, camera } = harness();
    pointer(canvas, 'pointerdown', { x: 0, y: 0 });
    pointer(canvas, 'pointermove', { x: 20, y: 5 });
    pointer(canvas, 'pointermove', { x: 20, y: 5 }); // a repeated sample pans by nothing
    pointer(canvas, 'pointermove', { x: 35, y: 9 });
    expect(camera.panBy).toHaveBeenNthCalledWith(1, 20, 5);
    expect(camera.panBy).toHaveBeenNthCalledWith(2, 0, 0);
    expect(camera.panBy).toHaveBeenNthCalledWith(3, 15, 4);
  });

  it("zooms about the fingers' midpoint with a pinch and carries the pan along", () => {
    const { canvas, camera, mouse } = harness();
    pointer(canvas, 'pointerdown', { x: 100, y: 100 }, 1);
    pointer(canvas, 'pointerdown', { x: 200, y: 100 }, 2);
    expect(camera.touchZoom.begin).toHaveBeenCalledTimes(1);
    // The first finger spreads out: the span grows 100 → 110 about the midpoint (150,100) → (145,100).
    pointer(canvas, 'pointermove', { x: 90, y: 100 }, 1);
    expect(camera.touchZoom.move).toHaveBeenCalledWith(1.1, 145, 100);
    expect(camera.panBy).toHaveBeenCalledWith(-5, 0);
    // The pinch's lift of one finger hands the drag back to the plain pan; the zoom ends once.
    pointer(canvas, 'pointerup', { x: 200, y: 100 }, 2);
    expect(camera.touchZoom.end).toHaveBeenCalledTimes(1);
    pointer(canvas, 'pointermove', { x: 80, y: 100 }, 1);
    expect(camera.panBy).toHaveBeenLastCalledWith(-10, 0);
    pointer(canvas, 'pointerup', { x: 80, y: 100 }, 1);
    expect(camera.touchZoom.end).toHaveBeenCalledTimes(1); // not again
    expect(mouse).toEqual([]); // neither the pinch nor its remainder is a click
  });

  it('reads two near taps inside the window as the double click (detail 2)', () => {
    const { canvas, mouse } = harness();
    pointer(canvas, 'pointerdown', { x: 40, y: 60 });
    pointer(canvas, 'pointerup', { x: 40, y: 60 });
    pointer(canvas, 'pointerdown', { x: 44, y: 62 });
    pointer(canvas, 'pointerup', { x: 44, y: 62 });
    expect(mouse.map((event) => event.detail)).toEqual([1, 1, 2, 2]);
  });

  it('answers nothing on a cancelled press', () => {
    const { canvas, camera, mouse } = harness();
    pointer(canvas, 'pointerdown', { x: 40, y: 60 });
    pointer(canvas, 'pointercancel', { x: 40, y: 60 });
    expect(mouse).toEqual([]);
    pointer(canvas, 'pointermove', { x: 60, y: 60 });
    expect(camera.panBy).not.toHaveBeenCalled();
  });

  it('lets the mouse through untouched', () => {
    const { canvas, camera, mouse } = harness();
    pointer(canvas, 'pointerdown', { x: 40, y: 60 }, 1, 'mouse');
    pointer(canvas, 'pointerup', { x: 40, y: 60 }, 1, 'mouse');
    expect(mouse).toEqual([]);
    expect(camera.panBy).not.toHaveBeenCalled();
  });

  it('ends the gesture on a blur, so a lost pointer leaves no stuck zoom', () => {
    const { canvas, camera } = harness();
    pointer(canvas, 'pointerdown', { x: 100, y: 100 }, 1);
    pointer(canvas, 'pointerdown', { x: 200, y: 100 }, 2);
    window.dispatchEvent(new Event('blur'));
    expect(camera.touchZoom.end).toHaveBeenCalledTimes(1);
    // A later move from the ghosted pointer answers nothing.
    pointer(canvas, 'pointermove', { x: 150, y: 100 }, 1);
    expect(camera.panBy).not.toHaveBeenCalled();
  });

  it('stops answering once disposed', () => {
    const { canvas, camera, mouse, dispose } = harness();
    dispose();
    pointer(canvas, 'pointerdown', { x: 40, y: 60 });
    pointer(canvas, 'pointerup', { x: 40, y: 60 });
    expect(mouse).toEqual([]);
    expect(camera.panBy).not.toHaveBeenCalled();
  });
});
