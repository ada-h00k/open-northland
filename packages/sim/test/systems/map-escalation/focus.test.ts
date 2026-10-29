import { describe, expect, it } from 'vitest';
import {
  AttackOrder,
  Building,
  mapEscalationProgress,
  Owner,
  Position,
  Settler,
} from '../../../src/components/index.js';
import type { Entity } from '../../../src/ecs/world.js';
import type { Simulation } from '../../../src/index.js';
import {
  coastWorld,
  distance,
  LAUNCH_SECONDS,
  PLAYER,
  raiderMen,
  runUntil,
  SECOND_HOUSE,
  TARGET,
} from '../../fixtures/map-escalation/coast.js';

function playerHouseAt(sim: Simulation, at: { x: number; y: number }): Entity {
  const house = [...sim.world.query(Building, Owner, Position)].find(
    (e) => sim.world.get(e, Owner).player === PLAYER && distance(sim, e, at) === 0,
  );
  if (house === undefined) throw new Error('no house there');
  return house;
}

describe('map escalation - the aim', () => {
  it('moves to another building once the headquarters falls, then to the seat’s people', () => {
    const sim = coastWorld();
    runUntil(sim, LAUNCH_SECONDS + 1, () => false);
    expect(mapEscalationProgress(sim.world).focus).toMatchObject([{ seat: PLAYER, kind: 'headquarters' }]);

    sim.world.destroy(playerHouseAt(sim, TARGET));
    const second = playerHouseAt(sim, SECOND_HOUSE);
    const band = () => raiderMen(sim).filter((e) => sim.world.has(e, Position));
    const aimedAt = (target: Entity) => () =>
      band().length > 0 && band().every((e) => sim.world.tryGet(e, AttackOrder)?.target === target);
    expect(runUntil(sim, 3, aimedAt(second))).toBe(true);
    expect(mapEscalationProgress(sim.world).focus).toEqual([
      { seat: PLAYER, kind: 'building', entity: second },
    ]);

    sim.world.destroy(second);
    const villager = [...sim.world.query(Settler, Owner)].find(
      (e) => sim.world.get(e, Owner).player === PLAYER,
    );
    if (villager === undefined) throw new Error('no villager');
    expect(runUntil(sim, 3, aimedAt(villager))).toBe(true);
    expect(mapEscalationProgress(sim.world).focus).toEqual([
      { seat: PLAYER, kind: 'person', entity: villager },
    ]);
  });
});
