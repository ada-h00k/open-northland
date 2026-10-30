import type { MusicTrack } from './manifest.js';
import type { MusicCue, MusicSequence } from './sequence.js';

/** Seconds an interlude rises over as it cuts in under the outgoing music's fade. Approximation. */
export const INTERLUDE_FADE_IN_S = 1.5;
/** Seconds an interlude fades over at its end: short, since the file carries its own ending. */
export const INTERLUDE_FADE_S = 1;

/**
 * One track played once through in front of the running music, which then carries on. The player
 * cannot tell it from any other sequence; it is over once the player asks for the cue after it,
 * which also happens when its file fails to load or a stop drops it.
 */
export class MusicInterlude implements MusicSequence {
  private handedOut = false;
  private over = false;

  constructor(
    private readonly track: MusicTrack,
    private after: MusicSequence | null,
  ) {}

  /** The interlude has not given way to the music after it. */
  get playing(): boolean {
    return !this.over;
  }

  /** Replace the music that follows, as a source or map change does under the interlude. */
  follow(after: MusicSequence | null): void {
    this.after = after;
  }

  next(): MusicCue | null {
    if (!this.handedOut) {
      this.handedOut = true;
      return {
        track: this.track,
        passes: 1,
        gapBeforeS: 0,
        fadeInS: INTERLUDE_FADE_IN_S,
        fadeS: INTERLUDE_FADE_S,
      };
    }
    this.over = true;
    return this.after?.next() ?? null;
  }

  drop(file: string): void {
    if (file !== this.track.file) this.after?.drop(file);
  }

  standby(): MusicTrack | null {
    return this.over ? (this.after?.standby?.() ?? null) : null;
  }

  /** While the interlude plays, the track that follows it, so the music resumes without a fetch. */
  upcoming(): MusicTrack | null {
    return this.handedOut ? (this.after?.upcoming?.() ?? null) : this.track;
  }
}
