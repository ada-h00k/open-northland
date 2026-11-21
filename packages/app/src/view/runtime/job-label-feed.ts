import type { JobLabel, Viewport } from '@open-northland/render';
import type { WorldSnapshot } from '@open-northland/sim';

/**
 * The seam the profession-name feed travels through. The read models build it once the session's
 * content is loaded; the frame loop reads it per frame. Both sit deep in the game view's wiring, and
 * a pass-through there would have a third file hand-carry the argument — ground the tool-panel
 * patches share, where a copied file set can drop the line and take the frame loop's names with it.
 * The seam keeps the labels' wiring inside the labels' own files, the way the update watcher stages
 * its continuation (`setUpdateContinuation`).
 *
 * A session registers while it runs and every new registration replaces the old, so a session left
 * behind names nobody reads: its frame loop stopped, and the next session registers before it
 * renders a frame.
 */

/** The feed the frame loop reads: the profession name over each on-screen worker, memoized by the
 *  snapshot and the screen and fog-filtered. */
export type JobLabelFeed = (snap: WorldSnapshot, viewport?: Viewport) => ReadonlyMap<number, JobLabel>;

let feed: JobLabelFeed | null = null;

/** The read models register the feed while their session runs; null ends it, and the frames draw no
 *  names — the mouse game's, where pointing at a settler and opening him answers who he is. */
export function setJobLabelFeed(next: JobLabelFeed | null): void {
  feed = next;
}

/** The feed the running session registered, or null: the frame then draws no names. */
export function jobLabelFeed(): JobLabelFeed | null {
  return feed;
}
