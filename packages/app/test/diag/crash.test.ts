// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installCrashCapture } from '../../src/diag/crash.js';
import { type Problem, setProblemSink } from '../../src/diag/report/problem.js';

const reported: Problem[] = [];

function reject(reason: unknown): void {
  const event = new Event('unhandledrejection') as Event & { reason: unknown };
  event.reason = reason;
  window.dispatchEvent(event);
}

/** Thrown in the page's own script, not another origin's. */
function named(name: string, message: string): Error {
  return Object.assign(new Error(message), {
    name,
    stack: `${name}: ${message}\n    at f (${location.origin}/src/main.ts:1:1)`,
  });
}

describe('crash capture on the dev server', () => {
  beforeAll(() => {
    setProblemSink((problem) => reported.push(problem));
    installCrashCapture();
  });
  beforeEach(() => {
    reported.length = 0;
  });

  it('logs a module the server did not serve whole and reports nothing', () => {
    reject(named('TypeError', 'Failed to fetch dynamically imported module: http://127.0.0.1:5188/src/x.ts'));
    reject(named('LoadError', 'the sim worker failed to load'));
    const error = named(
      'SyntaxError',
      "The requested module '/src/x.ts' does not provide an export named 'X'",
    );
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
    expect(reported).toEqual([]);
  });

  it("reports the game's own errors", () => {
    reject(named('TypeError', "Cannot read properties of undefined (reading 'x')"));
    expect(reported).toMatchObject([{ trigger: 'error', error: { name: 'TypeError' } }]);
  });
});
