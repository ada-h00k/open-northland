/**
 * Touch input on the game canvas: the finger gestures a phone has, mapped onto the mouse's world
 * input so the controllers under it (`unit-controls`, the camera) answer unchanged.
 *
 * A tap is the left click; a held finger is the right click, the orders' press; a dragged finger
 * pans the camera, the world following the hand; two fingers pinch the zoom about their midpoint
 * and carry the pan along. A held finger that then drags draws the selection box instead, the
 * mouse's drag select over several units: the left press goes out at the point the finger rested,
 * the moves follow it, and the lift releases the box. The tap and the long-press go out as ordinary
 * `MouseEvent`s the mouse handlers already take, the pan and the pinch through the camera
 * controller's touch methods — no mouse handler learns of any of it.
 *
 * The browser's own gestures are shut out instead: the canvas styles itself `touch-action: none`,
 * every touch pointer is captured and its events prevented, so a finger never scrolls or zooms the
 * page and the compatibility mouse events (which would double the tap as a browser-made click)
 * stay suppressed — this layer's synthetic events are the only mouse a finger makes.
 */

/** A hold past this many ms is the held finger: lifted still it is the right click, dragged it is
 *  the selection box. Below the browsers' own long-press answers (~500 ms), and the prevented
 *  `pointerdown` has already silenced those. */
const LONG_PRESS_MS = 450;
/** Client px a press may drift (a thumb's jitter) and stay a tap, a hold, or a still press. */
const MOVE_SLOP_PX = 10;
/** Two taps within this many ms, this close, are the double click the job-mates selection reads. */
const DOUBLE_TAP_MS = 350;
/** Client px both taps of a double may land apart; thumbs are sloppy. */
const DOUBLE_TAP_SLOP_PX = 28;
/** The hold's answer buzzes, as the system's own long-presses do. */
const VIBRATE_MS = 15;

/** The camera touch methods the gestures drive; `CameraController` implements them. */
export interface TouchCameraInput {
  /** Pan by client px, the world following the finger 1:1, clamped as every pan is. */
  readonly panBy: (dxCss: number, dyCss: number) => void;
  /** The two-finger pinch: free of the integer-level snap while it lasts, which waits for its end. */
  readonly touchZoom: {
    readonly begin: () => void;
    readonly move: (factor: number, clientX: number, clientY: number) => void;
    readonly end: () => void;
  };
}

interface TrackedPointer {
  readonly id: number;
  x: number;
  y: number;
  readonly downX: number;
  readonly downY: number;
  readonly downAt: number;
  /** The point the last pan step read from, so each move carries only its own delta. */
  lastX: number;
  lastY: number;
}

/**
 * The gesture the tracked pointers are in. 'press' waits to learn tap, hold or drag; 'held' is the
 * long-press answered (the finger rests, its right click waiting for a still lift); 'box' is the
 * held finger dragging the selection box; 'pan' is the one-finger drag; 'pinch' the two-finger one.
 */
type GestureMode = 'idle' | 'press' | 'held' | 'box' | 'pan' | 'pinch';

export function installTouchInput(canvas: HTMLCanvasElement, camera: TouchCameraInput): () => void {
  const pointers = new Map<number, TrackedPointer>();
  let mode: GestureMode = 'idle';
  let holdTimer: number | null = null;
  /** Whether `touchZoom.begin` ran and its `end` is still owed. */
  let zooming = false;
  /** The last tap, for the double-tap's click count; cleared by the second tap of the pair. */
  let lastTap: { readonly x: number; readonly y: number; readonly at: number } | null = null;
  /** The pinch reads its zoom factor and midpoint step off these, set as the gesture forms. */
  let pinchSpan = 0;
  let pinchMidX = 0;
  let pinchMidY = 0;

  const clearHold = (): void => {
    if (holdTimer === null) return;
    window.clearTimeout(holdTimer);
    holdTimer = null;
  };

  const endZoom = (): void => {
    if (!zooming) return;
    zooming = false;
    camera.touchZoom.end();
  };

  const vibrate = (): void => {
    try {
      navigator.vibrate?.(VIBRATE_MS);
    } catch {
      // A browser without the vibration API (or one that forbids it) skips the buzz.
    }
  };

  /** The mouse event the world handlers take, at the finger's point. `detail` carries the tap
   *  count, so a double-tap reads as the double click the job-mates selection needs. */
  const mouseEvent = (
    type: 'mousedown' | 'mousemove' | 'mouseup',
    at: { readonly x: number; readonly y: number },
    button: number,
    detail: number,
  ): MouseEvent =>
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(at.x),
      clientY: Math.round(at.y),
      button,
      buttons: button === 0 ? 1 : 2,
      detail,
    });

  /** Map iteration keeps insertion order, so the first two entries are the pinch's fingers. */
  const pair = (): readonly [TrackedPointer | undefined, TrackedPointer | undefined] => {
    const values = [...pointers.values()];
    return [values[0], values[1]];
  };

  const beginPinch = (): void => {
    clearHold();
    // A box the pinch takes over releases where its finger stood, so the boxed selection lands and
    // no marquee dangles; a held finger was never a click, its right press waited for a still lift.
    if (mode === 'box') {
      const rest = pair()[0];
      if (rest !== undefined) canvas.dispatchEvent(mouseEvent('mouseup', rest, 0, 1));
    }
    mode = 'pinch';
    const [a, b] = pair();
    if (a === undefined || b === undefined) return;
    pinchSpan = Math.hypot(a.x - b.x, a.y - b.y);
    pinchMidX = (a.x + b.x) / 2;
    pinchMidY = (a.y + b.y) / 2;
    if (!zooming) {
      zooming = true;
      camera.touchZoom.begin();
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    // No page pan or zoom, and no compatibility mouse events: the synthetic events below are the
    // only mouse a finger makes, so a tap selects once and never scrolls the page.
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // A pointer already gone (a system gesture took it): its moves answer nowhere.
    }
    if (pointers.size >= 2) return; // a third finger joins no gesture
    const p: TrackedPointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      downX: e.clientX,
      downY: e.clientY,
      downAt: e.timeStamp,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    pointers.set(p.id, p);
    if (pointers.size === 2) {
      // The second finger always means the pinch, whatever the first was doing: a press becomes no
      // click, a drag hands the pan to the two-finger gesture.
      beginPinch();
      return;
    }
    mode = 'press';
    // The hold's timer: past it, the finger rests as the held one — lifted still it answers as the
    // right click, dragged it draws the selection box. Neither has gone out yet.
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      if (mode !== 'press') return;
      mode = 'held';
      vibrate();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: PointerEvent): void => {
    const p = pointers.get(e.pointerId);
    if (p === undefined) return;
    e.preventDefault();
    p.x = e.clientX;
    p.y = e.clientY;
    if (mode === 'pinch' && pointers.size === 2) {
      const [a, b] = pair();
      if (a === undefined || b === undefined) return;
      const span = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      // Spread the zoom about the fingers' midpoint and carry the camera by its step, so the view
      // follows both at once: the hands' move is a zoom and a pan together.
      if (pinchSpan > 0) camera.touchZoom.move(span / pinchSpan, midX, midY);
      camera.panBy(midX - pinchMidX, midY - pinchMidY);
      pinchSpan = span;
      pinchMidX = midX;
      pinchMidY = midY;
      return;
    }
    if (mode === 'held') {
      // A held finger that then drags draws the selection box instead: the mouse's drag select. The
      // left press anchors at the point the finger rested on, and the camera holds still, as a drag
      // select on the mouse holds it.
      if (Math.hypot(p.x - p.downX, p.y - p.downY) < MOVE_SLOP_PX) return;
      mode = 'box';
      canvas.dispatchEvent(mouseEvent('mousedown', { x: p.downX, y: p.downY }, 0, 1));
      canvas.dispatchEvent(mouseEvent('mousemove', p, 0, 1));
      return;
    }
    if (mode === 'box') {
      canvas.dispatchEvent(mouseEvent('mousemove', p, 0, 1));
      return;
    }
    if (mode === 'press') {
      // Past the slop the press becomes the drag: the hold is cancelled, the camera takes over.
      if (Math.hypot(p.x - p.downX, p.y - p.downY) < MOVE_SLOP_PX) return;
      clearHold();
      mode = 'pan';
    }
    if (mode === 'pan') camera.panBy(p.x - p.lastX, p.y - p.lastY);
    p.lastX = p.x;
    p.lastY = p.y;
  };

  const onPointerEnd = (e: PointerEvent, cancelled: boolean): void => {
    const p = pointers.get(e.pointerId);
    if (p === undefined) return;
    pointers.delete(e.pointerId);
    if (mode === 'pinch') {
      if (pointers.size === 1 && !cancelled) {
        // One finger left of the pinch keeps dragging as the plain pan; the zoom stops here.
        endZoom();
        mode = 'pan';
        const rest = pair()[0];
        if (rest !== undefined) {
          rest.lastX = rest.x;
          rest.lastY = rest.y; // its next move pans by its own step alone
        }
        return;
      }
      endZoom();
      mode = 'idle';
      return;
    }
    if (mode === 'held') {
      mode = 'idle';
      if (cancelled) return; // a stolen hold was never a click, and none goes out now
      // The lift answers as the right click at the point the finger rested on, a whole press.
      canvas.dispatchEvent(mouseEvent('mousedown', { x: p.downX, y: p.downY }, 2, 1));
      canvas.dispatchEvent(mouseEvent('mouseup', { x: p.downX, y: p.downY }, 2, 1));
      return;
    }
    if (mode === 'box') {
      mode = 'idle';
      // The release lands the box wherever the finger ended, on a cancel too: a vanished box would
      // otherwise linger on the screen until the next press took it down.
      canvas.dispatchEvent(mouseEvent('mouseup', p, 0, 1));
      return;
    }
    if (mode === 'press') {
      clearHold();
      mode = 'idle';
      // A cancelled press answers nothing: the browser took the gesture, so a click now would
      // order on a point the player never chose to press.
      if (cancelled) return;
      const near =
        lastTap !== null &&
        e.timeStamp - lastTap.at <= DOUBLE_TAP_MS &&
        Math.hypot(p.x - lastTap.x, p.y - lastTap.y) <= DOUBLE_TAP_SLOP_PX;
      lastTap = near ? null : { x: p.x, y: p.y, at: e.timeStamp };
      const detail = near ? 2 : 1;
      canvas.dispatchEvent(mouseEvent('mousedown', p, 0, detail));
      canvas.dispatchEvent(mouseEvent('mouseup', p, 0, detail));
      return;
    }
    mode = 'idle'; // a pan's lift is no click
  };

  const onPointerUp = (e: PointerEvent): void => onPointerEnd(e, false);
  const onPointerCancel = (e: PointerEvent): void => onPointerEnd(e, true);

  // Losing the page mid-gesture drops the pointer's end, which would leave the mode and the zoom
  // gesture stuck; a blur is a clean sheet. A box being drawn releases where its finger stood, so
  // its selection lands and nothing dangles.
  const onBlur = (): void => {
    clearHold();
    endZoom();
    if (mode === 'box') {
      const rest = pair()[0];
      if (rest !== undefined) canvas.dispatchEvent(mouseEvent('mouseup', rest, 0, 1));
    }
    pointers.clear();
    mode = 'idle';
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', onBlur);

  return () => {
    clearHold();
    endZoom();
    pointers.clear();
    mode = 'idle';
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', onBlur);
  };
}
