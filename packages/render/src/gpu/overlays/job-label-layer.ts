import { Container, Text, TextStyle } from 'pixi.js';
import type { Viewport } from '../../data/projection/index.js';
import { OVERHEAD_BASE_GAP, type OverheadColumn } from '../../data/scene/overhead-column.js';
import { type MarkAnchorFrame, markAnchor } from './entity-anchor.js';
import { retireUndrawn } from './retained-pool.js';

/**
 * The job-label layer - the profession's name over each working settler's head, so a crowded map reads
 * its trades without opening anyone. The app resolves which settlers wear a name and what it says; this
 * layer draws them over the sprites the pool drew this frame, above the over-head icon column the
 * bubbles, hearts and stars stack in. Artistic choice: the original names no trades over the heads.
 */

/** World px of the label's font. */
export const LABEL_FONT_SIZE = 7;
/** Screen px the label keeps at least, whatever the view zooms: a thumb reads the name. */
export const LABEL_MIN_SCREEN_PX = 14;
/** A thin sans; the menu's face when the document has it, a system one otherwise. */
const FONT_FAMILY = '"Alegreya Sans", "Helvetica Neue", Arial, sans-serif';
/** Texture pixels per world px, enough for a zoomed-in view on a high-density display. */
const TEXT_RESOLUTION = 8;
const LABEL_STYLE = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: LABEL_FONT_SIZE,
  fontWeight: '600',
  fill: 0xf2e8c9,
  // A rim of the terrain's dark keeps the name readable over sand and snow too, where the pale fill
  // alone would wash out; aligned outside, so the rim never eats the thin strokes it circles.
  stroke: { color: 0x241708, width: 2, alignment: 0 },
  dropShadow: { color: 0x000000, alpha: 0.9, blur: 1.5, distance: 0, angle: 0 },
});
/** World px a standing settler reaches over his feet, where the pool has drawn no bounds to read. */
const HEAD_ABOVE_FEET = 40;
/** World px between the head (or the icon column's top) and the label's baseline. */
const LABEL_GAP = 4;
/** World px of art a worn icon stands over its column slot, which the label must clear. */
const ICON_ART_ROOM = 14;

/** One label the app resolved: the settler's profession name and its fixed-point `Position`. */
export interface JobLabel {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export interface JobLabelFrame extends MarkAnchorFrame {
  /** Logical screen pixels per world pixel; zoomed out, a label keeps its unzoomed screen size. */
  readonly zoom?: number;
  /** The over-head icon column this frame stacked, whose height the label clears. */
  readonly column?: OverheadColumn | undefined;
}

interface Label {
  readonly text: Text;
  /** The name {@link text} was written from. */
  written: string;
}

export class JobLabelLayer {
  readonly container = new Container();
  /** One label per on-screen worker; rewritten only when its name changes. */
  private readonly labels = new Map<number, Label>();
  /** Reused scratch of ids drawn this frame, to avoid a per-frame allocation. */
  private readonly seen = new Set<number>();

  /** Reconcile to `labels` (entity id → its job label): draw one per visible worker, retire the rest. */
  draw(frame: JobLabelFrame, labels: ReadonlyMap<number, JobLabel>, viewport?: Viewport): void {
    this.seen.clear();
    // One screen size from every zoomed-out view, the floor carrying the name; zoomed in past it,
    // the label follows the zoom again, so a close view's names do not dwarf their sprites.
    const scale = Math.max(1, LABEL_MIN_SCREEN_PX / (LABEL_FONT_SIZE * (frame.zoom ?? 1)));
    for (const [id, label] of labels) {
      // The head the pool drew (its sprite-bounds top), else the feet raised by the head estimate; the
      // cull runs on the raw projection first, so an off-screen settler pays no pool lookup.
      const head = markAnchor(frame, { id, x: label.x, y: label.y }, HEAD_ABOVE_FEET, viewport);
      if (head === undefined) continue;
      // The icons the column stacked this frame stand over the head; the label clears their art too.
      const rise = frame.column?.riseOf(id, 'marker') ?? 0;
      let node = this.labels.get(id);
      if (node === undefined) {
        const text = new Text({ text: label.name, style: LABEL_STYLE, resolution: TEXT_RESOLUTION });
        this.container.addChild(text);
        node = { text, written: label.name };
        this.labels.set(id, node);
      } else if (node.written !== label.name) {
        node.text.text = label.name;
        node.written = label.name;
      }
      node.text.anchor.set(0.5, 1);
      node.text.position.set(
        head.x,
        head.y - OVERHEAD_BASE_GAP - rise - (rise > 0 ? ICON_ART_ROOM : 0) - LABEL_GAP,
      );
      node.text.scale.set(scale);
      this.seen.add(id);
    }
    retireUndrawn(this.labels, this.seen, (label) => label.text.destroy());
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.labels.clear();
  }
}
