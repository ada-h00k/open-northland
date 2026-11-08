import { messages } from '../../../i18n/index.js';
import type { BuildingPanelModel } from '../../details-panel/model/index.js';
import { GLYPH } from '../icons.js';
import { button, element, setAttribute, setClass, setHidden, setTip, write } from '../parts/dom.js';
import type { BuildingPanelDeps } from './actions.js';

export interface RallySection {
  readonly element: HTMLElement;
  update(model: BuildingPanelModel): void;
}

/** The rally row of a barracks, in the alarm row's look: a wide labelled tile that arms the planting of the
 *  rally flag (it reads "Move" while one stands) and, only while one stands, a small tile that takes it away. */
export function createRallySection(
  deps: BuildingPanelDeps,
  current: () => BuildingPanelModel | null,
): RallySection {
  const bar = element('div', 'on-rally-bar');
  const set = button('on-order on-order--tile on-rally', `${GLYPH.banner}<span></span>`);
  const clear = button('on-order on-order--tile on-rally on-rally--clear', GLYPH.close);
  const setLabel = set.lastElementChild;
  if (!(setLabel instanceof HTMLElement)) throw new Error('building rally: label');
  set.addEventListener('click', () => {
    const shown = current();
    if (shown?.orders?.rally != null) deps.building.armRallyPoint(shown.entityId);
  });
  clear.addEventListener('click', () => {
    const shown = current();
    if (shown?.orders?.rally?.set === true) deps.building.clearRallyPoint(shown.entityId);
  });
  bar.append(set, clear);

  return {
    element: bar,
    update(model): void {
      const rally = model.orders?.rally ?? null;
      setHidden(bar, rally === null);
      if (rally === null) return;
      const copy = messages().hud.buildingPanel;
      const label = rally.set ? copy.orders.rallyMove : copy.orders.rallySet;
      write(setLabel, label);
      setTip(set, copy.rallySetTooltip);
      setAttribute(set, 'aria-label', label);
      setClass(set, 'on-rally--on', rally.set);
      setHidden(clear, !rally.set);
      setTip(clear, copy.rallyClearTooltip);
      setAttribute(clear, 'aria-label', copy.orders.rallyClear);
    },
  };
}
