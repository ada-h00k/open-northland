import type { MapAiSeat, MapEscalationInput } from '@open-northland/data';
import { MapEscalation } from '@open-northland/data';
import { describe, expect, it } from 'vitest';
import { Building, Owner, Position, Settler } from '../../../src/components/index.js';
import { TICKS_PER_SECOND } from '../../../src/core/loop.js';
import type { Entity } from '../../../src/ecs/world.js';
import {
  exportSaveGame,
  parseSaveGame,
  restoreSimulation,
  Simulation,
  serializeSaveGame,
} from '../../../src/index.js';
import { hexDistanceBetween, nodeOfPosition } from '../../../src/nav/halfcell.js';
import { soldierCount } from '../../../src/systems/ai-shared/seat-roster.js';
import { removeSettlerSilently } from '../../../src/systems/lifecycle/death.js';
import { CONDITION_ALWAYS } from '../../../src/systems/map-ai/index.js';
import { aiContent } from '../../fixtures/ai-content.js';
import { grassNodeMap } from '../../fixtures/terrain.js';

/**
 * The escalation end to end on a synthetic map: a fortress seat whose keep spawns each attack for the
 * raider of every occupied target seat, the raider's own Attack task marching it, and a guard that
 * refills toward its growing cap. The garrison stays where its post holds it.
 */

const VIKING = 1;
const HQ_TYPE = 1;
const SPEARMAN = 32;
const BOWMAN = 40;
const MAP = 160;

const FORTRESS = 6;
const PLAYER = 0;
const EMPTY_SEAT = 1;
const RAIDER = 7;
const IDLE_RAIDER = 8;
const KEEP = { x: 40, y: 80 };
const TARGET = { x: 130, y: 80 };
const POST = { x: 40, y: 96, range: 10 };

const FIRST_LAUNCH_SECONDS = 10;
const FIRST_WAVE_MEN = 3;
const END_AFTER_SECONDS = 120;
const GUARD_BASE = 3;
const REFILL_EVERY_SECONDS = 5;

const ESCALATION: MapEscalationInput = {
  keep: { seat: FORTRESS, houseType: HQ_TYPE, ...KEEP, range: 4 },
  tribe: VIKING,
  jobMix: [
    { job: SPEARMAN, weight: 2 },
    { job: BOWMAN, weight: 1 },
  ],
  attacks: {
    launches: [
      { atSeconds: FIRST_LAUNCH_SECONDS, landMen: FIRST_WAVE_MEN, seaMen: 0 },
      { atSeconds: 400, landMen: 5, seaMen: 0 },
    ],
    repeat: { everySeconds: 400, waves: [{ landMen: 1, seaMen: 0 }] },
    endAfterSeconds: END_AFTER_SECONDS,
    targets: [
      { seat: PLAYER, raider: RAIDER, ...TARGET },
      { seat: EMPTY_SEAT, raider: IDLE_RAIDER, x: 10, y: 10 },
    ],
  },
  guard: {
    base: GUARD_BASE,
    perSeatStep: 1,
    stepSeconds: 30,
    perSeatMax: 2,
    refill: [{ fromSeconds: 0, everySeconds: REFILL_EVERY_SECONDS, men: 2 }],
  },
};

const seat = (player: number, tasks: MapAiSeat['tasks']): MapAiSeat => ({
  player,
  allDisabled: false,
  computerDisabled: true,
  disabledComputerModules: [],
  conditions: [],
  tasks,
});

const SCRIPT: MapAiSeat[] = [
  seat(FORTRESS, [{ kind: 'defend', priority: 10, condition: CONDITION_ALWAYS, ...POST, min: 0, max: 0 }]),
  seat(RAIDER, [
    {
      kind: 'attack',
      priority: 100,
      condition: CONDITION_ALWAYS,
      ...TARGET,
      range: 20,
      min: 0,
      max: 0,
      rallyX: 80,
      rallyY: 80,
      stance: 1,
    },
  ]),
];

function setup(config: MapEscalationInput = ESCALATION): { sim: Simulation; garrison: Entity[] } {
  const sim = new Simulation({
    seed: 3,
    content: aiContent(),
    map: grassNodeMap(MAP, MAP),
    mapAiScript: SCRIPT,
    mapEscalation: MapEscalation.parse(config),
  });
  const fortressSide = [FORTRESS, RAIDER, IDLE_RAIDER];
  for (const player of fortressSide) {
    sim.enqueueSetup({ kind: 'setAiControl', player, enabled: true, modules: { military: false } });
    for (const ally of fortressSide) {
      if (ally !== player)
        sim.enqueueSetup({ kind: 'setDiplomacy', from: player, to: ally, state: 'friend' });
    }
  }
  const house = (owner: number, at: { x: number; y: number }) =>
    sim.enqueueSetup({
      kind: 'placeBuilding',
      buildingType: HQ_TYPE,
      ...at,
      tribe: VIKING,
      owner,
      force: true,
      underConstruction: false,
    });
  house(FORTRESS, KEEP);
  house(PLAYER, TARGET);
  sim.enqueueSetup({
    kind: 'spawnSettler',
    jobType: 0,
    x: TARGET.x,
    y: TARGET.y + 6,
    tribe: VIKING,
    owner: PLAYER,
  });
  for (let i = 0; i < GUARD_BASE; i++) {
    sim.enqueueSetup({
      kind: 'spawnSettler',
      jobType: SPEARMAN,
      x: POST.x + 2 * i,
      y: POST.y,
      tribe: VIKING,
      owner: FORTRESS,
    });
  }
  sim.step();
  return { sim, garrison: ownedFighters(sim, FORTRESS) };
}

function ownedFighters(sim: Simulation, player: number): Entity[] {
  return [...sim.world.query(Settler, Owner)].filter(
    (e) => sim.world.get(e, Owner).player === player && sim.world.get(e, Settler).jobType !== 0,
  );
}

function distance(sim: Simulation, e: Entity, to: { x: number; y: number }): number {
  const at = sim.world.get(e, Position);
  const node = nodeOfPosition(at.x, at.y);
  return hexDistanceBetween(node.hx, node.hy, to.x, to.y);
}

function runToSecond(sim: Simulation, seconds: number): void {
  sim.run(seconds * TICKS_PER_SECOND - sim.tick);
}

function eventsUntil(sim: Simulation, seconds: number): string[] {
  const seen: string[] = [];
  while (sim.tick < seconds * TICKS_PER_SECOND) {
    sim.step();
    for (const ev of sim.events.current()) {
      if (ev.kind === 'mapEscalationAttackLaunched') seen.push(`launched ${ev.wave} ${ev.seats.join(',')}`);
      if (ev.kind === 'mapEscalationAttackEnded') seen.push(`ended ${ev.wave} ${ev.cause}`);
    }
  }
  return seen;
}

describe('map escalation - an attack', () => {
  it('spawns a band at the keep for each occupied seat’s raider, which marches it on the target', () => {
    const { sim, garrison } = setup();
    expect(sim.mapEscalationView()).toMatchObject({
      wave: 0,
      attackRunning: false,
      nextAttackTick: FIRST_LAUNCH_SECONDS * TICKS_PER_SECOND,
    });

    expect(eventsUntil(sim, FIRST_LAUNCH_SECONDS)).toEqual([`launched 1 ${PLAYER}`]);
    const band = ownedFighters(sim, RAIDER);
    expect(band.map((e) => sim.world.get(e, Settler).jobType)).toEqual([SPEARMAN, SPEARMAN, BOWMAN]);
    for (const e of band) expect(distance(sim, e, KEEP)).toBeLessThan(6);
    // The empty seat's raider gets nobody.
    expect(ownedFighters(sim, IDLE_RAIDER)).toEqual([]);
    expect(sim.mapEscalationView()).toMatchObject({ wave: 1, attackRunning: true });

    runToSecond(sim, FIRST_LAUNCH_SECONDS + 60);
    const start = hexDistanceBetween(KEEP.x, KEEP.y, TARGET.x, TARGET.y);
    for (const e of band) expect(distance(sim, e, TARGET)).toBeLessThan(start / 2);
    // The garrison holds its post, and the spawned men are not on the fortress's list.
    for (const e of garrison) {
      expect(sim.world.get(e, Owner).player).toBe(FORTRESS);
      expect(distance(sim, e, POST)).toBeLessThanOrEqual(POST.range);
    }
    expect(sim.checkInvariants()).toEqual([]);
  });

  it('ends when every man it sent is dead, or when its time runs out', () => {
    const killed = setup().sim;
    runToSecond(killed, FIRST_LAUNCH_SECONDS + 1);
    for (const e of ownedFighters(killed, RAIDER)) removeSettlerSilently(killed.world, e);
    expect(eventsUntil(killed, FIRST_LAUNCH_SECONDS + 3)).toEqual(['ended 1 defeated']);

    const outlasted = setup().sim;
    const events = eventsUntil(outlasted, FIRST_LAUNCH_SECONDS + END_AFTER_SECONDS + 2);
    expect(events).toEqual([`launched 1 ${PLAYER}`, 'ended 1 expired']);
    expect(outlasted.mapEscalationView()).toEqual({
      wave: 1,
      attackRunning: false,
      attackEndsByTick: null,
      nextAttackTick: 400 * TICKS_PER_SECOND,
    });
  });

  it('launches nothing while no finished keep stands', () => {
    const { sim } = setup();
    for (const e of [...sim.world.query(Building, Owner)]) {
      if (sim.world.get(e, Owner).player === FORTRESS) sim.world.destroy(e);
    }
    expect(eventsUntil(sim, FIRST_LAUNCH_SECONDS + 1)).toEqual([]);
    expect(ownedFighters(sim, RAIDER)).toEqual([]);
    expect(sim.mapEscalationView()?.wave).toBe(1);
  });
});

describe('map escalation - the guard', () => {
  it('refills toward a cap that grows with each step for each occupied seat, and no further', () => {
    const { sim } = setup();
    const guard = () => soldierCount(sim.world, sim.content, FORTRESS);
    // At the base cap nothing is added until the first step raises it by one occupied seat's share.
    runToSecond(sim, REFILL_EVERY_SECONDS * 5);
    expect(guard()).toBe(GUARD_BASE);
    runToSecond(sim, 30 + REFILL_EVERY_SECONDS);
    expect(guard()).toBe(GUARD_BASE + 1);
    runToSecond(sim, 90 + REFILL_EVERY_SECONDS);
    expect(guard()).toBe(GUARD_BASE + 2);
  });
});

describe('map escalation - a save', () => {
  it('keeps the running attack and requires the same escalation to restore', () => {
    const { sim } = setup();
    runToSecond(sim, FIRST_LAUNCH_SECONDS + 1);
    const save = parseSaveGame(JSON.parse(serializeSaveGame(exportSaveGame(sim))));
    const inputs = { content: sim.content, map: grassNodeMap(MAP, MAP), mapAiScript: SCRIPT };
    const restored = restoreSimulation(save, { ...inputs, mapEscalation: MapEscalation.parse(ESCALATION) });
    expect(restored.hashState()).toBe(sim.hashState());
    expect(restored.mapEscalationView()).toEqual(sim.mapEscalationView());
    expect(() => restoreSimulation(save, inputs)).toThrow(/mapEscalationFingerprint/);
  });
});
