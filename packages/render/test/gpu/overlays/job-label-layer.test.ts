import type { Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { OverheadColumn } from '../../../src/data/scene/overhead-column.js';
import {
  type JobLabel,
  JobLabelLayer,
  LABEL_FONT_SIZE,
  LABEL_MIN_SCREEN_PX,
} from '../../../src/gpu/overlays/job-label-layer.js';
import { ONE } from '../../../src/index.js';
import { drawnGeometry } from '../../support/fixtures.js';

/**
 * The profession label over a working settler's head: anchored over the drawn sprite's head (the feet
 * raised by the estimate where the pool drew no bounds), cleared over the icons the over-head column
 * stacked, rewritten only when the name changes, retired with the settler.
 */

const FEET = { x: 120, y: 90 };
const drawn = drawnGeometry({ anchorOf: () => FEET });
const label = (name: string): [number, JobLabel] => [1, { name, x: ONE, y: ONE }];

describe('JobLabelLayer', () => {
  it('writes each worker his profession name, rewritten only when it changes', () => {
    const layer = new JobLabelLayer();
    layer.draw({ drawn }, new Map([label('Bauer')]));
    expect(layer.container.children.map((child) => (child as Text).text)).toEqual(['Bauer']);

    layer.draw({ drawn }, new Map([label('Holzfäller')]));
    expect((layer.container.children[0] as Text).text).toBe('Holzfäller');
    expect(layer.container.children).toHaveLength(1);
    layer.destroy();
  });

  it('stands centred over the head, anchored at its baseline', () => {
    const layer = new JobLabelLayer();
    layer.draw({ drawn }, new Map([label('Bauer')]));
    const text = layer.container.children[0] as Text;
    expect(text.position.x).toBe(FEET.x);
    expect(text.position.y).toBeLessThan(FEET.y);
    expect(text.anchor.x).toBe(0.5);
    expect(text.anchor.y).toBe(1);
    layer.destroy();
  });

  it('lifts over the icons the over-head column stacked', () => {
    const bare = new JobLabelLayer();
    bare.draw({ drawn }, new Map([label('Bauer')]));
    const column = new OverheadColumn();
    column.wear(1, 'bubble');
    const over = new JobLabelLayer();
    over.draw({ drawn, column }, new Map([label('Bauer')]));
    expect((over.container.children[0] as Text).position.y).toBeLessThan(
      (bare.container.children[0] as Text).position.y,
    );
    bare.destroy();
    over.destroy();
  });

  it('keeps one screen size from every zoomed-out view, then follows the zoom in', () => {
    const layer = new JobLabelLayer();
    // The screen size the label reads at is its scale times the zoom: far out and at the default
    // zoom the floor carries it, zoomed in the world size leads again.
    layer.draw({ drawn, zoom: 0.55 }, new Map([label('Bauer')]));
    const far = layer.container.children[0] as Text;
    expect(far.scale.x * 0.55).toBeCloseTo(LABEL_MIN_SCREEN_PX / LABEL_FONT_SIZE);
    layer.draw({ drawn, zoom: 1 }, new Map([label('Bauer')]));
    expect((layer.container.children[0] as Text).scale.x).toBe(LABEL_MIN_SCREEN_PX / LABEL_FONT_SIZE);
    layer.draw({ drawn, zoom: 4 }, new Map([label('Bauer')]));
    expect((layer.container.children[0] as Text).scale.x).toBe(1);
    layer.destroy();
  });

  it('retires a label whose settler the frame drew no more', () => {
    const layer = new JobLabelLayer();
    layer.draw({ drawn }, new Map([label('Bauer')]));
    layer.draw({ drawn }, new Map());
    expect(layer.container.children).toHaveLength(0);
    layer.destroy();
  });
});
