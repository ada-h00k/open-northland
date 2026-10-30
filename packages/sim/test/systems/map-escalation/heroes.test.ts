import { describe, expect, it } from 'vitest';
import {
  Equipment,
  Health,
  hasMissionBehaviour,
  MISSION_BEHAVIOUR,
  Owner,
  ScriptedName,
  Settler,
} from '../../../src/components/index.js';
import type { Entity } from '../../../src/ecs/world.js';
import type { Simulation } from '../../../src/index.js';
import {
  AMULET_SECONDS,
  DEFENSE_AMULET,
  distance,
  FORTRESS,
  GEARED,
  gearContent,
  KEEP,
  keepWorld,
  runToSecond,
  SPEARMAN,
  WOOL,
} from '../../fixtures/map-escalation/keep.js';

const HERO_HITPOINTS = 30000;
const NAME_STRING_ID = 90001;
/** Beside the keep, which stands on the keep point. */
const HERO_AT = { x: KEEP.x, y: KEEP.y + 8 };
/** How far a defender standing his ground may have moved. */
const HOLD_NODES = 4;

function heroWorld(): Simulation {
  const config = {
    ...GEARED,
    heroes: [
      {
        seat: FORTRESS,
        job: SPEARMAN,
        ...HERO_AT,
        hitpoints: HERO_HITPOINTS,
        equipment: ['armor_wool', 'amulet_defense'],
        nameStringId: NAME_STRING_ID,
        name: { eng: 'Lord Usurper' },
      },
    ],
  };
  return keepWorld(config, gearContent(), { scriptedFortress: true }).sim;
}

function heroesOf(sim: Simulation): Entity[] {
  return [...sim.world.query(ScriptedName, Owner)].filter((e) => sim.world.get(e, Owner).player === FORTRESS);
}

describe('map escalation - heroes', () => {
  it('places each defender once with his hitpoints, gear and name, holding his ground past the gear steps', () => {
    const sim = heroWorld();
    const [hero, ...more] = heroesOf(sim);
    if (hero === undefined) throw new Error('no hero');
    expect(more).toEqual([]);
    expect(sim.world.get(hero, Settler).jobType).toBe(SPEARMAN);
    expect(sim.world.get(hero, Health)).toEqual({ hitpoints: HERO_HITPOINTS, max: HERO_HITPOINTS });
    expect(sim.world.get(hero, ScriptedName).stringId).toBe(NAME_STRING_ID);
    expect(hasMissionBehaviour(sim.world, hero, MISSION_BEHAVIOUR.NOT_CONTROLLABLE)).toBe(true);
    const placed = () => {
      const eq = sim.world.get(hero, Equipment);
      return {
        armor: eq.armor?.goodType,
        misc: eq.misc.flatMap((slot) => (slot === null ? [] : [slot.goodType])),
      };
    };
    expect(placed()).toEqual({ armor: WOOL, misc: [DEFENSE_AMULET] });

    runToSecond(sim, AMULET_SECONDS + 1);
    expect(heroesOf(sim)).toEqual([hero]);
    expect(placed()).toEqual({ armor: WOOL, misc: [DEFENSE_AMULET] });
    expect(distance(sim, hero, HERO_AT)).toBeLessThanOrEqual(HOLD_NODES);
  });
});
