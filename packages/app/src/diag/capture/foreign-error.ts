/**
 * Errors that are no fault of the game, so no crash report. The pre-boot recorder inline in
 * `index.html` applies the window error rules before this module loads.
 */
import { isStaleCodeError } from '../../update/model.js';

/** A ResizeObserver whose callback resized what it observes leaves the rest for the next frame and
 *  says so as an error event with no error: "loop completed with undelivered notifications", or
 *  "loop limit exceeded" in older engines. */
const RESIZE_OBSERVER_NOTICE = 'ResizeObserver loop';

/** All a browser tells of an error thrown by a script from another origin: an extension, a script a
 *  browser or proxy injected. */
const MUTED_ERROR_MESSAGE = 'Script error.';

/** A URL in a stack frame: `at f (https://host/a.js:1:2)` or `f@moz-extension://id/a.js:1:2`. */
const STACK_URL = /\b[a-z][a-z\d+.-]*:\/\/[^\s)]+/gi;

export type IgnoredError = 'resize-observer' | 'foreign' | 'dev-server';

/** What an `ErrorEvent` says of its error. */
export interface WindowErrorFacts {
  readonly message: string;
  readonly filename: string;
  readonly error: unknown;
}

/** An unparseable URL counts as the page's own: only a URL known to be elsewhere drops a report. */
function fromOrigin(url: string, pageOrigin: string): boolean {
  try {
    return new URL(url).origin === pageOrigin;
  } catch {
    return true;
  }
}

/** The script URL of the stack's top frame, read past the `Name: message` line V8 starts it with, so
 *  a URL in the message is no frame; null for a value without a stack or a stack without URLs. */
function topFrameUrl(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('stack' in error)) return null;
  const { stack } = error;
  if (typeof stack !== 'string') return null;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const head = message === '' ? name : `${name}: ${message}`;
  const frames = head !== '' && stack.startsWith(head) ? stack.slice(head.length) : stack;
  return frames.match(STACK_URL)?.[0] ?? null;
}

/** The error was thrown in another origin's script: its stack's top frame is not the page's. Frames
 *  below may be the page's, as when the game calls a function an extension wrapped. */
export function thrownElsewhere(error: unknown, pageOrigin: string): boolean {
  const url = topFrameUrl(error);
  return url !== null && !fromOrigin(url, pageOrigin);
}

/** Why a window error event is no game crash, or null when it may be one. A stack outranks the
 *  event's filename: a foreign script that wraps the game's callbacks and rethrows names itself as
 *  the filename of the game's own error. */
export function ignoredWindowError(event: WindowErrorFacts, pageOrigin: string): IgnoredError | null {
  if (event.message.includes(RESIZE_OBSERVER_NOTICE)) return 'resize-observer';
  if (event.error == null && event.message === MUTED_ERROR_MESSAGE) return 'foreign';
  if (topFrameUrl(event.error) !== null) return thrownElsewhere(event.error, pageOrigin) ? 'foreign' : null;
  return event.filename !== '' && !fromOrigin(event.filename, pageOrigin) ? 'foreign' : null;
}

/** The name given to a script that failed to load: by the pre-boot recorder in `index.html` and by a
 *  worker whose module graph never came up. */
export const SCRIPT_LOAD_FAILURE = 'LoadError';

export const DEV_SERVER_FAULT_NOTE = 'ignored a module the dev server did not serve whole';

/** How Chromium, Firefox and Safari word an import its module does not export. */
const MISSING_EXPORT: readonly RegExp[] = [
  /does not provide an export named/i,
  /import not found/i,
  /Importing binding name .* is not found/i,
];

/** On the dev server a module that fails to load or to link is the server going away or serving a
 *  tree mid-edit, as when a worktree preview stops or rebases under an open tab. A production build
 *  links at build time, so there the same failure is the host's and stays a report. */
export function devServerModuleFault(error: { readonly name: string; readonly message: string }): boolean {
  return (
    error.name === SCRIPT_LOAD_FAILURE ||
    isStaleCodeError(error.message) ||
    MISSING_EXPORT.some((pattern) => pattern.test(error.message))
  );
}
