import { describe, expect, it } from 'vitest';
import { devServerModuleFault, ignoredWindowError } from '../../../src/diag/capture/foreign-error.js';

const ORIGIN = 'https://game.example';

const thrown = (stack: string): Error => Object.assign(new Error('x'), { stack });

describe('ignoredWindowError', () => {
  it('leaves an error thrown by the page to the report, even called from a foreign frame', () => {
    const ours = thrown(
      `Error: see https://ext.example/doc\n    at b (${ORIGIN}/assets/main.js:3:4)\n    at a (chrome-extension://id/hook.js:1:2)`,
    );
    Object.assign(ours, { message: 'see https://ext.example/doc' });
    expect(
      ignoredWindowError(
        { message: 'Uncaught Error: x', filename: `${ORIGIN}/assets/main.js`, error: ours },
        ORIGIN,
      ),
    ).toBeNull();
    expect(
      ignoredWindowError({ message: 'Uncaught Error: x', filename: '', error: thrown('Error: x') }, ORIGIN),
    ).toBeNull();
  });

  it('drops an error thrown in a foreign wrapper the game called', () => {
    const wrapped = thrown(
      `Error: x\n    at hook (chrome-extension://id/hook.js:1:2)\n    at b (${ORIGIN}/assets/main.js:3:4)`,
    );
    expect(
      ignoredWindowError(
        { message: 'Uncaught Error: x', filename: 'chrome-extension://id/hook.js', error: wrapped },
        ORIGIN,
      ),
    ).toBe('foreign');
  });

  it("keeps the page's error that a foreign wrapper caught and rethrew under its own filename", () => {
    const rethrown = thrown(
      `TypeError: x\n    at gameTick (${ORIGIN}/game.js:1:27)\n    at https://ext.example/wrap.js:1:86`,
    );
    expect(
      ignoredWindowError(
        { message: 'Uncaught TypeError: x', filename: 'https://ext.example/wrap.js', error: rethrown },
        ORIGIN,
      ),
    ).toBeNull();
  });

  it('drops errors from other origins: muted, from a foreign file, or with only foreign frames', () => {
    const verdicts = [
      ignoredWindowError({ message: 'Script error.', filename: '', error: null }, ORIGIN),
      ignoredWindowError(
        { message: 'Uncaught Error: x', filename: 'https://cdn.example/inject.js', error: null },
        ORIGIN,
      ),
      ignoredWindowError(
        {
          message: 'Uncaught Error: x',
          filename: '',
          error: thrown('Error: x\n    hook@moz-extension://id/hook.js:1:2'),
        },
        ORIGIN,
      ),
    ];
    expect(verdicts).toEqual(['foreign', 'foreign', 'foreign']);
  });

  it("drops the ResizeObserver's loop notices", () => {
    const notices = [
      'ResizeObserver loop completed with undelivered notifications.',
      'ResizeObserver loop limit exceeded',
    ].map((message) => ignoredWindowError({ message, filename: '', error: null }, ORIGIN));
    expect(notices).toEqual(['resize-observer', 'resize-observer']);
  });
});

describe('devServerModuleFault', () => {
  it('names a module that failed to load or to link, in each engine', () => {
    const faults = [
      { name: 'LoadError', message: 'a script failed to load' },
      {
        name: 'TypeError',
        message: 'Failed to fetch dynamically imported module: http://127.0.0.1:5188/src/x.ts',
      },
      {
        name: 'SyntaxError',
        message: "The requested module '/src/x.ts' does not provide an export named 'X'",
      },
      { name: 'SyntaxError', message: 'import not found: X' },
      { name: 'SyntaxError', message: "Importing binding name 'X' is not found." },
    ];
    expect(faults.map(devServerModuleFault)).toEqual([true, true, true, true, true]);
  });

  it("leaves the game's own errors to the report", () => {
    expect(
      devServerModuleFault({
        name: 'TypeError',
        message: "Cannot read properties of undefined (reading 'x')",
      }),
    ).toBe(false);
  });
});
