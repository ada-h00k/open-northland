// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { BuildingPanelModel } from '../../../../src/hud/details-panel/model/index.js';
import { createConstructionSection } from '../../../../src/hud/dom/building-panel/construction.js';
import { warmBuildingModel } from '../../../../src/hud/dom/building-panel/warm-model.js';
import { messages } from '../../../../src/i18n/index.js';

const BUILDING = 7;

function setup(model: BuildingPanelModel) {
  const setConstructionPriority = vi.fn();
  const section = createConstructionSection({
    icons: () => {},
    building: { setConstructionPriority },
  });
  document.body.append(section.element);
  section.update(model);
  const options = (): HTMLButtonElement[] => [
    ...section.element.querySelectorAll<HTMLButtonElement>('.on-segmented > button'),
  ];
  return { section, setConstructionPriority, options };
}

describe('building panel construction section', () => {
  it('lights the chosen build priority and sends the pressed one', () => {
    const copy = messages().hud.buildingPanel;
    const warm = warmBuildingModel([]);
    const { setConstructionPriority, options } = setup({ ...warm, entityId: BUILDING });
    expect(options().map((option) => option.textContent)).toEqual([
      copy.buildPriorityLow,
      copy.buildPriorityNormal,
      copy.buildPriorityHigh,
    ]);
    // The warm model builds at 'high', so the strip lights its third option.
    expect(options().map((option) => option.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
    options()[1]?.click();
    expect(setConstructionPriority.mock.calls).toEqual([[BUILDING, 'normal']]);
  });

  it('re-lights the strip when the model carries another rank, and keeps it hidden off a site', () => {
    const warm = warmBuildingModel([]);
    const construction = warm.construction;
    if (construction === null) throw new Error('warm model has no construction');
    const { section, setConstructionPriority, options } = setup(warm);
    section.update({
      ...warm,
      entityId: BUILDING,
      construction: { ...construction, priority: 'low' },
    });
    expect(options().map((option) => option.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    const finished = { ...warm, construction: null };
    section.update(finished);
    expect(section.element.hidden).toBe(true);
    options()[2]?.click();
    // A hidden strip holds no site, so a press sends nothing.
    expect(setConstructionPriority).not.toHaveBeenCalled();
  });
});
