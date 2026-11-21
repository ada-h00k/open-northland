import type { JobLabel } from '@open-northland/render';
// The Pixi-free entry: the root barrel would drag Pixi into headless callers.
import { isIndoorSettler, ONE } from '@open-northland/render/data';
import {
  type EntitySnapshot,
  indexesOf,
  type SnapshotIndexSpec,
  type TileBox,
  TileBuckets,
  type WorldSnapshot,
} from '@open-northland/sim';
import { isSettler, positionOf, type SnapshotEntity, settlerJobType } from '../../game/snapshot/index.js';

/**
 * The profession name each working settler wears over his head, ascending by id: the label the render
 * layer draws over the drawn sprite. Only the settlers standing in `box` are read; no box reads the whole
 * map. A jobless settler — a child, or an adult between jobs — wears no name, and neither does a settler
 * the scene draws nobody for, such as one resting indoors.
 */

/** Reused output of the box query; the slots past a query's count hold earlier frames' bodies. */
const boxed: SnapshotEntity[] = [];

/** What the projection resolves outside the snapshot. */
export interface JobLabelInputs {
  /** The localized name a job type shows. */
  readonly jobNameOf: (jobType: number) => string;
  /** A stamp the held names were built under, such as the locale; a changed stamp rebuilds them. */
  readonly stamp?: string | undefined;
}

/** The labels last made per settler, kept across snapshots by one caller. */
export interface JobLabelCache {
  held: Map<number, { readonly job: number; readonly name: string }>;
  /** The stamp {@link held}'s names were built under. */
  stamp?: string | undefined;
}

/** The settlers holding a job, bucketed by their `Position`: a written `Settler` (a job gained, changed
 *  or lost) re-buckets a held settler, a step lands in `swapAll`. */
const JOB_WEARERS: SnapshotIndexSpec<TileBuckets<EntitySnapshot>> = {
  name: 'job label wearers',
  reads: { values: ['Settler'], presence: ['Position'] },
  empty: () => new TileBuckets(),
  differs: (held, fresh) => held.differenceFrom(fresh),
  add: placeWearer,
  remove: (buckets, e) => {
    buckets.delete(e.id);
  },
  replace: (buckets, _previous, next) => placeWearer(buckets, next),
  swapAll: (buckets, nexts) => {
    for (const next of nexts) {
      if (!buckets.has(next.id)) continue; // most touched entities are ones this index never holds
      const pos = positionOf(next);
      if (pos !== undefined) buckets.move(next.id, next, pos.x / ONE, pos.y / ONE);
    }
  },
};

function placeWearer(buckets: TileBuckets<EntitySnapshot>, e: EntitySnapshot): void {
  const pos = positionOf(e);
  if (pos !== undefined && isSettler(e) && settlerJobType(e) !== undefined) {
    buckets.set(e.id, e, pos.x / ONE, pos.y / ONE);
  } else {
    buckets.delete(e.id);
  }
}

/** The job labels of the settlers standing in `box`; no box reads the whole map. With `cache`, a settler
 *  whose job and whose name's stamp held since the last call keeps its built name. */
export function computeJobLabels(
  snapshot: WorldSnapshot,
  inputs: JobLabelInputs,
  box?: TileBox,
  cache?: JobLabelCache,
): Map<number, JobLabel> {
  if (cache !== undefined && cache.stamp !== inputs.stamp) {
    cache.held = new Map();
    cache.stamp = inputs.stamp;
  }
  const out = new Map<number, JobLabel>();
  // Only the settlers in this view are kept, so the cache never outgrows a screen.
  const kept =
    cache === undefined ? undefined : new Map<number, { readonly job: number; readonly name: string }>();
  // No box reads the whole map, the entities themselves; a box reads the wearers' position buckets.
  const candidates = box === undefined ? snapshot.entities : boxed;
  const count =
    box === undefined ? candidates.length : indexesOf(snapshot).get(JOB_WEARERS).collect(box, boxed);
  for (let i = 0; i < count; i++) {
    const e = candidates[i] as SnapshotEntity;
    if (!isSettler(e)) continue;
    const pos = positionOf(e);
    if (pos === undefined) continue;
    // The scene draws nobody indoors to hang the name over.
    if (isIndoorSettler(snapshot, e.components)) continue;
    const job = settlerJobType(e);
    if (job === undefined) continue;
    const held = cache?.held.get(e.id);
    const name = held !== undefined && held.job === job ? held.name : inputs.jobNameOf(job);
    kept?.set(e.id, { job, name });
    out.set(e.id, { name, x: pos.x, y: pos.y });
  }
  if (cache !== undefined && kept !== undefined) cache.held = kept;
  return out;
}
