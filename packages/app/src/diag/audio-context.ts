import { type ContextFactory, webAudioContextFactory } from '@open-northland/audio';
import { type DiagLog, diag } from './log.js';

/** Creating an audio context opens the output device synchronously, which has blocked the main thread
 *  for seconds on some Windows machines. A creation this slow is logged, so a freeze report names it
 *  even without a stack. */
export const SLOW_AUDIO_CONTEXT_MS = 500;

/** `create`, logging to `target` each call that took {@link SLOW_AUDIO_CONTEXT_MS} or longer. */
export function timedAudioContext(
  create: ContextFactory = webAudioContextFactory,
  target: DiagLog = diag,
  now: () => number = () => performance.now(),
): ContextFactory {
  return () => {
    const startMs = now();
    const ctx = create();
    const ms = Math.round(now() - startMs);
    if (ms >= SLOW_AUDIO_CONTEXT_MS) {
      target.warn('audio', `audio context took ${ms} ms to create`, {
        ms,
        sampleRate: ctx?.sampleRate ?? null,
        baseLatency: ctx?.baseLatency ?? null,
      });
    }
    return ctx;
  };
}
