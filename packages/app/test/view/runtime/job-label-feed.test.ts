import type { JobLabel } from '@open-northland/render';
import { afterEach, describe, expect, it } from 'vitest';
import { jobLabelFeed, setJobLabelFeed } from '../../../src/view/runtime/job-label-feed.js';

afterEach(() => setJobLabelFeed(null));

const FEED = (): ReadonlyMap<number, JobLabel> => new Map([[1, { name: 'Bauer', x: 0, y: 0 }]]);

describe('jobLabelFeed', () => {
  it('reads no names until a session registers its feed', () => {
    expect(jobLabelFeed()).toBeNull();
    setJobLabelFeed(FEED);
    expect(jobLabelFeed()).not.toBeNull();
  });

  it('answers the feed a session registered, so the frame draws the names it resolves', () => {
    setJobLabelFeed(FEED);
    expect(jobLabelFeed()?.(undefined as never)?.get(1)?.name).toBe('Bauer');
  });

  it('carries the newest registration, so the session that mounted last names the frames', () => {
    setJobLabelFeed(FEED);
    const next = (): ReadonlyMap<number, JobLabel> => new Map([[2, { name: 'Holzfäller', x: 0, y: 0 }]]);
    setJobLabelFeed(next);
    expect(jobLabelFeed()).not.toBe(FEED);
    expect(jobLabelFeed()?.(undefined as never)?.get(1)).toBeUndefined();
    expect(jobLabelFeed()?.(undefined as never)?.get(2)?.name).toBe('Holzfäller');
  });

  it('ends the names when a session hands back null, and the frame draws none again', () => {
    setJobLabelFeed(FEED);
    setJobLabelFeed(null);
    expect(jobLabelFeed()).toBeNull();
  });
});
