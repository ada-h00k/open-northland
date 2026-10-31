import { describe, expect, it } from 'vitest';
import { SLOW_AUDIO_CONTEXT_MS, timedAudioContext } from '../../src/diag/audio-context.js';
import { DiagLog } from '../../src/diag/index.js';

const SAMPLE_RATE = 48_000;
const BASE_LATENCY_S = 0.01;

/** A factory whose creation advances the clock by `ms`. */
function slowFactory(ms: number): { readonly create: () => AudioContext; readonly now: () => number } {
  let clockMs = 0;
  const ctx = { sampleRate: SAMPLE_RATE, baseLatency: BASE_LATENCY_S } as AudioContext;
  return {
    create: () => {
      clockMs += ms;
      return ctx;
    },
    now: () => clockMs,
  };
}

describe('audio context timing', () => {
  it('logs a creation that blocked past the threshold, with the device it opened', () => {
    const log = new DiagLog({ consoleLevel: 'silent' });
    const blockedMs = 15_775;
    const { create, now } = slowFactory(blockedMs);
    timedAudioContext(create, log, now)();
    expect(log.entries().map(({ channel, level, data }) => ({ channel, level, data }))).toEqual([
      {
        channel: 'audio',
        level: 'warn',
        data: { ms: blockedMs, sampleRate: SAMPLE_RATE, baseLatency: BASE_LATENCY_S },
      },
    ]);
  });

  it('stays quiet for a creation under the threshold', () => {
    const log = new DiagLog({ consoleLevel: 'silent' });
    const { create, now } = slowFactory(SLOW_AUDIO_CONTEXT_MS - 1);
    timedAudioContext(create, log, now)();
    expect(log.entries()).toHaveLength(0);
  });
});
