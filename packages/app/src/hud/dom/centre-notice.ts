import { element } from './parts/dom.js';

export interface CentreNoticeText {
  readonly title: string;
  readonly detail?: string;
}

/** A large announcement in the middle of the screen; it never takes the pointer. */
export interface CentreNotice {
  /** The notice to stand now; a new one restarts the fade, the same one leaves it running, null clears. */
  show(notice: CentreNoticeText | null): void;
  dispose(): void;
}

/** `shownMs` is the whole life of one notice, which the stylesheet's fade spans. */
export function createCentreNotice(plane: HTMLElement, shownMs: number): CentreNotice {
  let shown: CentreNoticeText | null = null;
  let node: HTMLElement | null = null;
  return {
    show(notice) {
      if (notice === shown) return;
      shown = notice;
      node?.remove();
      node = null;
      if (notice === null) return;
      // A fresh node restarts the stylesheet's animation for every notice.
      node = element('div', 'on-centre-notice');
      node.setAttribute('role', 'status');
      node.style.setProperty('--notice-ms', `${shownMs}ms`);
      const title = element('p', 'on-centre-notice__title');
      title.textContent = notice.title;
      node.append(title);
      if (notice.detail !== undefined) {
        const detail = element('p', 'on-centre-notice__detail');
        detail.textContent = notice.detail;
        node.append(detail);
      }
      plane.append(node);
    },
    dispose() {
      node?.remove();
      node = null;
    },
  };
}
