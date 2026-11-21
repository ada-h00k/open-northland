/**
 * Whether the device reports no precise pointer at all: a phone or a tablet played with fingers
 * alone. There a focused input raises the on-screen keyboard over the window it sits in, so a window
 * that offers typing waits for a tap on its field instead of taking the focus unasked.
 *
 * The pair of queries is the device notice's (`device-notice.ts`): a touchscreen beside a mouse or a
 * trackpad — a touch laptop — keeps the mouse's manners, and a page that answers neither query (no
 * matchMedia, a bare test document) reads as a desktop.
 */

export function touchFirstDevice(): boolean {
  try {
    return (
      window.matchMedia('(any-pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
    );
  } catch {
    // No matchMedia in this document (a test page): desktop manners.
    return false;
  }
}
