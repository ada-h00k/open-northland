import { CONSTRUCTION_PRIORITIES, type ConstructionPriority } from '@open-northland/sim';
import { formatMessage, messages } from '../../../i18n/index.js';
import type { BuildingPanelModel } from '../../details-panel/model/index.js';
import type { GoodIconPainter } from '../good-art.js';
import { element, setHidden, write } from '../parts/dom.js';
import { meterFill } from '../parts/meter-row.js';
import { createSection } from '../parts/section.js';
import { createSegmented } from '../parts/segmented.js';
import type { BuildingPanelActions } from './actions.js';
import { createGoodLine, type GoodLine, syncLines } from './good-line.js';

/** Build or Upgrade: how far the site has come on the rule, then one line per material of its bill,
 *  delivered against needed with what is on its way, in amber when the owner holds none of the rest -
 *  and the build priority strip the owner ranks the site among their others with. */
export interface ConstructionSection {
  readonly element: HTMLElement;
  update(model: BuildingPanelModel): void;
}

export function createConstructionSection(deps: {
  readonly icons: GoodIconPainter;
  readonly building: Pick<BuildingPanelActions, 'setConstructionPriority'>;
}): ConstructionSection {
  const progress = element('span', 'on-section__count');
  const title = createSection(progress);
  const list = element('ul', 'on-manifest');
  const priorityLabel = element('small', 'on-construction-priority__label');
  let shownId: number | null = null;
  const priority = createSegmented<ConstructionPriority>(CONSTRUCTION_PRIORITIES, '', (level) => {
    if (shownId !== null) deps.building.setConstructionPriority(shownId, level);
  });
  const priorityRow = element('div', 'on-construction-priority');
  priorityRow.append(priorityLabel, priority.element);
  const root = element('div', '');
  root.append(title.element, list, priorityRow);
  const lines = new Map<string, GoodLine>();
  return {
    element: root,
    update(model): void {
      const site = model.construction;
      setHidden(root, site === null);
      if (site === null) {
        shownId = null;
        return;
      }
      shownId = model.entityId;
      const copy = messages().hud.buildingPanel;
      title.update(
        site.upgradeTo === null
          ? copy.construction
          : formatMessage(copy.upgradeSectionTo, { level: site.upgradeTo }),
      );
      write(progress, `${site.pct}%`);
      const shown = syncLines(
        list,
        lines,
        site.rows.map((row) => `${row.goodType}`),
        () => createGoodLine(deps.icons),
      );
      site.rows.forEach((row, index) => {
        const words = formatMessage(copy.billRow, {
          good: row.label,
          delivered: row.delivered,
          needed: row.needed,
        });
        const notes = [
          ...(row.inbound > 0 ? [formatMessage(copy.billInbound, { count: row.inbound })] : []),
          ...(row.unsourced ? [copy.billUnsourced] : []),
        ];
        const aside = [
          ...(row.inbound > 0 ? [`+${row.inbound}`] : []),
          ...(row.unsourced ? [copy.billUnsourcedMark] : []),
        ];
        shown[index]?.update({
          goodId: row.goodId,
          label: row.label,
          value: `${row.delivered} / ${row.needed}`,
          ...(aside.length > 0 ? { aside: aside.join(' ') } : {}),
          fill: meterFill(row.delivered, row.needed),
          tooltip: [words, ...notes].join(' · '),
          muted: row.delivered >= row.needed,
          ...(row.unsourced ? { tone: 'warning' as const } : {}),
        });
      });
      write(priorityLabel, copy.buildPriority);
      priority.update(
        {
          low: { label: copy.buildPriorityLow, tooltip: copy.buildPriorityTooltip },
          normal: { label: copy.buildPriorityNormal, tooltip: copy.buildPriorityTooltip },
          high: { label: copy.buildPriorityHigh, tooltip: copy.buildPriorityTooltip },
        },
        site.priority,
        copy.buildPriority,
      );
    },
  };
}
