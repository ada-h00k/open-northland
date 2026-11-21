/**
 * Which input family the device plays with, as the boot notice classifies it: the touch device is
 * the one whose pointers are all fingers — a coarse pointer and no fine one, the same
 * `(any-pointer)` pair the device notice reads. A touch screen beside a mouse or trackpad is the
 * comfortable desktop and keeps its face, so the aids the touch game carries stay off it.
 */

/** Whether this device plays by touch alone: a finger answers, and no mouse or trackpad does. */
export function isTouchDevice(): boolean {
  try {
    return (
      window.matchMedia('(any-pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
    );
  } catch {
    return false; // no window to ask (a headless caller): the desktop answers
  }
}
