import { formatMessage, messages } from '../../../i18n/index.js';
import type { StorePriorityModel } from '../../details-panel/model/index.js';
import { goodIconMarkup } from '../good-art.js';
import { element, setHidden, setTip, write } from '../parts/dom.js';
import { createSwitch } from '../parts/switch.js';
import type { BuildingPanelDeps } from './actions.js';
import type { MinimumGood } from './minimum.js';

/** Design px of the good's icon in its well (foundation.css `.on-good-well`). */
const PRIORITY_ICON_PX = 18;

/** The priority line under a store's stock: the good picked on the list and the switch marking it, or
 *  the hint to pick one. */
export interface PriorityRow {
  readonly element: HTMLElement;
  update(model: StorePriorityModel, good: MinimumGood | null): void;
}

export function createPriorityRow(deps: BuildingPanelDeps): PriorityRow {
  const root = element(
    'div',
    'on-ledger on-ledger--ctl on-building-minimum',
    `<span class="on-building-minimum__label"></span><span class="on-good-well">${goodIconMarkup(PRIORITY_ICON_PX)}</span><span class="on-building-minimum__good"></span><small class="on-building-minimum__hint"></small>`,
  );
  const label = root.querySelector('.on-building-minimum__label');
  const well = root.querySelector('.on-good-well');
  const frame = root.querySelector('.on-good__frame');
  const name = root.querySelector('.on-building-minimum__good');
  const hint = root.querySelector('.on-building-minimum__hint');
  if (
    !(label instanceof HTMLElement) ||
    !(well instanceof HTMLElement) ||
    !(frame instanceof HTMLElement) ||
    !(name instanceof HTMLElement) ||
    !(hint instanceof HTMLElement)
  ) {
    throw new Error('building panel: priority row');
  }
  let shown: { model: StorePriorityModel; good: MinimumGood } | null = null;
  const copy = messages().hud.buildingPanel;
  const toggle = createSwitch(copy.priority, copy.priorityTooltip, (next) => {
    if (shown === null || shown.model.control !== true) return;
    deps.building.setStorePriority(shown.model.building, shown.good.goodType, next);
  });
  root.append(toggle.element);
  let icon = '';

  return {
    element: root,
    update(model, good): void {
      const copy = messages().hud.buildingPanel;
      shown = good === null ? null : { model, good };
      write(label, copy.priority);
      setTip(label, copy.priorityTooltip);
      setHidden(well, good === null);
      setHidden(name, good === null);
      setHidden(toggle.element, good === null);
      setHidden(hint, good !== null);
      if (good === null) {
        write(hint, copy.priorityPick);
        return;
      }
      if (good.goodId !== undefined && good.goodId !== icon) {
        icon = good.goodId;
        frame.removeAttribute('style');
        deps.icons(frame, good.goodId, PRIORITY_ICON_PX);
      }
      write(name, good.label);
      const on = model.goods.includes(good.goodType);
      const words = formatMessage(on ? copy.priorityOn : copy.priorityOff, { good: good.label });
      setTip(toggle.element, model.control === true ? words : model.control);
      toggle.update(on, model.control === true);
    },
  };
}
