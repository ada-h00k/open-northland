import { fx } from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import { computeJobLabels, type JobLabelCache } from '../../../src/view/projections/job-labels.js';
import { type Ent, snapshotOf } from '../../support/snapshot.js';

/**
 * The profession label each working settler wears over his head: who wears one, and the name cache that
 * keeps a per-frame read from rebuilding every label's string.
 */

const at = (x: number, y: number): { x: number; y: number } => ({ x: fx.fromInt(x), y: fx.fromInt(y) });
const worker = (id: number, jobType: number, x: number, y: number): Ent => ({
  id,
  components: { Settler: { jobType }, Position: at(x, y) },
});
const jobless = (id: number, x: number, y: number): Ent => ({
  id,
  components: { Settler: {}, Position: at(x, y) },
});
const indoor = (id: number, x: number, y: number): Ent => ({
  id,
  components: { Settler: { jobType: 3 }, Position: at(x, y), Resting: {} },
});
const boxAll = { minX: 0, minY: 0, maxX: 64, maxY: 64 };

describe('computeJobLabels', () => {
  it('names each working settler over his position, and nobody else', () => {
    const world = snapshotOf([worker(1, 0, 2, 3), worker(2, 7, 4, 3), jobless(3, 6, 3), indoor(4, 8, 3)]);
    const labels = computeJobLabels(world, { jobNameOf: (job) => `job ${job}` }, boxAll);
    expect([...labels].map(([id, label]) => [id, label.name])).toEqual([
      [1, 'job 0'],
      [2, 'job 7'],
    ]);
    expect(labels.get(1)).toMatchObject({ x: fx.fromInt(2), y: fx.fromInt(3) });
  });

  it('keeps a held name while the job and the stamp hold, and rebuilds on either change', () => {
    const world = snapshotOf([worker(1, 0, 2, 3)]);
    const cache: JobLabelCache = { held: new Map() };
    const first = computeJobLabels(world, { jobNameOf: () => 'farmer', stamp: 'de' }, boxAll, cache);
    expect(first.get(1)?.name).toBe('farmer');

    // Same job and stamp: the held string survives, whatever the resolver would answer now.
    const heldAgain = computeJobLabels(world, { jobNameOf: () => 'other', stamp: 'de' }, boxAll, cache);
    expect(heldAgain.get(1)?.name).toBe('farmer');

    // A turned locale rebuilds: the same job under the new stamp asks the resolver again.
    const rebuilt = computeJobLabels(world, { jobNameOf: () => 'Bauer', stamp: 'en' }, boxAll, cache);
    expect(rebuilt.get(1)?.name).toBe('Bauer');
  });

  it('prunes the cache to the settlers the last read kept', () => {
    const two = snapshotOf([worker(1, 0, 2, 3), worker(2, 1, 4, 3)]);
    const cache: JobLabelCache = { held: new Map() };
    computeJobLabels(two, { jobNameOf: (job) => `job ${job}` }, boxAll, cache);
    expect(cache.held.size).toBe(2);

    const one = snapshotOf([worker(1, 0, 2, 3)]);
    computeJobLabels(one, { jobNameOf: (job) => `job ${job}` }, boxAll, cache);
    expect([...cache.held.keys()]).toEqual([1]);
  });
});
