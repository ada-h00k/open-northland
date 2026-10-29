import { describe, expect, it } from 'vitest';
import { Equipment } from '../../../src/components/index.js';
import { TICKS_PER_SECOND } from '../../../src/core/loop.js';
import type { Entity } from '../../../src/ecs/world.js';
import type { Simulation } from '../../../src/index.js';
import { damageTakenBy } from '../../../src/systems/equipment/index.js';
import { ctxOf } from '../../fixtures/context.js';
import {
  AMULET_SECONDS,
  DEFENSE_AMULET,
  FORTRESS,
  GEARED,
  gearContent,
  keepWorld,
  LEATHER,
  LIGHT_ARMOR_SECONDS,
  ownedFighters,
  RAIDER,
  REFILL_EVERY_SECONDS,
  runToSecond,
  SHOES,
  WOOL,
} from '../../fixtures/map-escalation/keep.js';

function gearOf(sim: Simulation, e: Entity) {
  const eq = sim.world.tryGet(e, Equipment);
  return {
    armor: eq?.armor?.goodType ?? null,
    boots: eq?.boots?.goodType ?? null,
    misc: (eq?.misc ?? []).flatMap((slot) => (slot === null ? [] : [slot.goodType])),
  };
}

function gearSteps(sim: Simulation, seconds: number): string[] {
  const seen: string[] = [];
  while (sim.tick < seconds * TICKS_PER_SECOND) {
    sim.step();
    for (const ev of sim.events.current())
      if (ev.kind === 'mapEscalationGearStep') seen.push(`${ev.step} ${ev.noticeKey}`);
  }
  return seen;
}

describe('map escalation - gear', () => {
  it('gears every soldier of the gear seats at each step, and each one they gain later with every step passed', () => {
    const { sim, garrison } = keepWorld(GEARED, gearContent());
    expect(gearSteps(sim, LIGHT_ARMOR_SECONDS + 1)).toEqual(['1 light']);
    const band = ownedFighters(sim, RAIDER);
    expect(band.length).toBeGreaterThan(0);
    for (const e of [...garrison, ...band]) {
      expect(gearOf(sim, e)).toMatchObject({ boots: SHOES, misc: [] });
      expect([WOOL, LEATHER]).toContain(gearOf(sim, e).armor);
    }

    expect(gearSteps(sim, AMULET_SECONDS + 1)).toEqual(['2 amulets']);
    for (const e of garrison) expect(gearOf(sim, e).misc).toEqual([DEFENSE_AMULET]);
    // The cap grew at 30 s, so the next refill beat brings a newcomer.
    runToSecond(sim, AMULET_SECONDS + REFILL_EVERY_SECONDS + 1);
    const newcomers = ownedFighters(sim, FORTRESS).filter((e) => !garrison.includes(e));
    expect(newcomers.length).toBeGreaterThan(0);
    for (const e of newcomers) {
      expect(gearOf(sim, e)).toMatchObject({ boots: SHOES, misc: [DEFENSE_AMULET] });
      expect(damageTakenBy(sim.world, ctxOf(sim), e, 10)).toBe(5);
    }
  });
});
