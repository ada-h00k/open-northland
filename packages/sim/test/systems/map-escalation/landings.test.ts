import { MapEscalation } from '@open-northland/data';
import { describe, expect, it } from 'vitest';
import { mapEscalationProgress, Position, Rider } from '../../../src/components/index.js';
import { TICKS_PER_SECOND } from '../../../src/core/loop.js';
import type { Entity } from '../../../src/ecs/world.js';
import { exportSaveGame, parseSaveGame, restoreSimulation, serializeSaveGame } from '../../../src/index.js';
import {
  coast,
  coastWorld,
  distance,
  ESCALATION,
  LANDING,
  LAUNCH_SECONDS,
  NOTICE,
  PLAYER,
  raiderMen,
  raiderShips,
  runUntil,
  SCRIPT,
  SHIP_SEATS,
  TARGET,
} from '../../fixtures/map-escalation/coast.js';

describe('map escalation - a sea landing', () => {
  it('sails one full ship to the landing point, sets its men ashore in the attack and leaves the map', () => {
    const sim = coastWorld();
    let landing: { wave: number; seats: readonly number[]; noticeKey: string } | null = null;
    runUntil(sim, LAUNCH_SECONDS + 1, () => {
      for (const ev of sim.events.current())
        if (ev.kind === 'mapEscalationLanding')
          landing = { wave: ev.wave, seats: ev.seats, noticeKey: ev.noticeKey };
      return landing !== null;
    });
    expect(landing).toEqual({ wave: 1, seats: [PLAYER], noticeKey: NOTICE });
    const [ship, ...others] = raiderShips(sim);
    if (ship === undefined) throw new Error('no ship');
    expect(others).toEqual([]);
    expect(distance(sim, ship, { x: LANDING.spawnX, y: LANDING.spawnY })).toBeLessThan(4);
    // One ship only: its seats and the commander's, every man aboard and counted in the attack.
    const aboard = raiderMen(sim).filter((e) => sim.world.has(e, Rider));
    expect(aboard).toHaveLength(SHIP_SEATS + 1);
    for (const e of aboard) expect(sim.world.has(e, Position)).toBe(false);
    expect(mapEscalationProgress(sim.world).attack?.men).toEqual(expect.arrayContaining(aboard));

    expect(runUntil(sim, 60, () => aboard.every((e) => sim.world.has(e, Position)))).toBe(true);
    for (const e of aboard) {
      expect(sim.world.has(e, Rider)).toBe(false);
      expect(distance(sim, e, LANDING)).toBeLessThan(6);
    }
    expect(runUntil(sim, 60, () => raiderShips(sim).length === 0)).toBe(true);
    expect(mapEscalationProgress(sim.world).landings).toEqual([]);

    // Ashore they are the raider's soldiers like the land band, and its Attack task takes them on.
    const ashore = distance(sim, aboard[0] as Entity, TARGET);
    sim.run(20 * TICKS_PER_SECOND);
    expect(distance(sim, aboard[0] as Entity, TARGET)).toBeLessThan(ashore);
    expect(sim.checkInvariants()).toEqual([]);
  });

  it('keeps a ship under way through a save', () => {
    const sim = coastWorld();
    runUntil(sim, LAUNCH_SECONDS + 2, () => false);
    expect(mapEscalationProgress(sim.world).landings).toHaveLength(1);
    const save = parseSaveGame(JSON.parse(serializeSaveGame(exportSaveGame(sim))));
    const restored = restoreSimulation(save, {
      content: sim.content,
      map: coast(),
      mapAiScript: SCRIPT,
      mapEscalation: MapEscalation.parse(ESCALATION),
    });
    expect(restored.hashState()).toBe(sim.hashState());
  });
});
