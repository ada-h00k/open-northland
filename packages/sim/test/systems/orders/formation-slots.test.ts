import { describe, expect, it } from 'vitest';
import { Position, Settler } from '../../../src/components/index.js';
import type { Entity } from '../../../src/ecs/world.js';
import {
  type FormationSlotGroup,
  formationNodes,
  type HalfCellNode,
  MAX_UNIT_ORDER_MEMBERS,
  nodeOfPosition,
  pairBySpace,
  positionOfNode,
  type ScriptLandscapeType,
  Simulation,
} from '../../../src/index.js';
import {
  stampResourceFootprintData,
  unstampResourceFootprint,
} from '../../../src/systems/footprint/index.js';
import { testContent } from '../../fixtures/content.js';
import { grassNodeMap, waterColumnMap } from '../../fixtures/terrain.js';
import {
  HUT,
  mappedSim,
  placedBuilding,
  terrainOf,
  VIKING,
} from '../footprint/building-placement/support.js';

function person(sim: Simulation, hx: number, hy: number) {
  const id = sim.world.create();
  sim.world.add(id, Settler, { tribe: 1, jobType: null });
  sim.world.add(id, Position, positionOfNode(hx, hy));
  return id;
}

/** Column of the closed gate {@link gateSplitSim} sets in its wall. */
const GATE_X = 12;
/** Enough soldiers that a two-row fan around the gate reaches past the default judged box. */
const LARGE_ARMY = 200;
const WALL_POST_GFX = 691;
const CLOSED_GATE_GFX = 696;
const OPEN_GATE_GFX = 700;
const WOOD = 5;

/** A `width` x `height` grass map split by a finished wall on half-row `row`, closed by a gate at
 *  {@link GATE_X}. */
function gateSplitSim(width: number, height: number, row: number): Simulation {
  const wall = { maxHitpoints: 100, repairPerStrike: 1, construction: [{ goodType: WOOD, amount: 1 }] };
  const span = [-2, -1, 0, 1, 2].map((dx) => ({ dx, dy: 0 }));
  const post: ScriptLandscapeType = {
    typeId: WALL_POST_GFX,
    walk: [{ dx: 0, dy: 0 }],
    build: [{ dx: 0, dy: 0 }],
    groups: [],
    wall,
  };
  const closedGate: ScriptLandscapeType = {
    typeId: CLOSED_GATE_GFX,
    walk: span,
    build: span,
    groups: [],
    wall: { ...wall, gate: { open: false, counterpartGfxIndex: OPEN_GATE_GFX } },
  };
  const sim = new Simulation({
    seed: 1,
    content: testContent(),
    map: { ...grassNodeMap(width, height), landscapes: { types: [post, closedGate], placements: [] } },
  });
  for (let hx = 0; hx < width; hx++) {
    if (Math.abs(hx - GATE_X) <= 2) continue;
    sim.enqueueSetup({
      kind: 'placePalisade',
      gfxIndex: WALL_POST_GFX,
      x: hx,
      y: row,
      tribe: VIKING,
      owner: 0,
    });
  }
  sim.enqueueSetup({
    kind: 'placePalisade',
    gfxIndex: CLOSED_GATE_GFX,
    x: GATE_X,
    y: row,
    tribe: VIKING,
    owner: 0,
  });
  sim.step();
  return sim;
}

function slotOf(groups: readonly FormationSlotGroup[] | null, member: Entity): HalfCellNode | undefined {
  const group = groups?.find((g) => g.members.includes(member));
  return group?.slots[group.members.indexOf(member)];
}

describe('fresh formation slots', () => {
  it('keeps each bank separate when a click near the shore names water', () => {
    const sim = new Simulation({ seed: 1, content: testContent(), map: waterColumnMap(12, 8, 6) });
    const terrain = terrainOf(sim);
    const members = [person(sim, 4, 4), person(sim, 5, 4), person(sim, 18, 4), person(sim, 20, 4)];
    const before = sim.hashState();
    const groups = sim.formationSlots({ hx: 12, hy: 5 }, members, 2);
    expect(groups).toHaveLength(2);
    expect(groups?.flatMap((group) => group.members).sort()).toEqual([...members].sort());
    for (const group of groups ?? []) {
      expect(group.slots).toHaveLength(group.members.length);
      const components = new Set(
        group.members.map((id) => {
          const { hx, hy } = nodeOfPosition(sim.world.get(id, Position).x, sim.world.get(id, Position).y);
          return terrain.componentOf(terrain.nodeAt(hx, hy));
        }),
      );
      expect(components.size).toBe(1);
      for (const { hx, hy } of group.slots) {
        expect(terrain.isWalkable(terrain.nodeAt(hx, hy))).toBe(true);
        expect(components.has(terrain.componentOf(terrain.nodeAt(hx, hy)))).toBe(true);
        expect(hy % 2).toBe(1);
      }
    }
    expect(sim.hashState()).toBe(before);
  });

  it('blocks the full body of a selected building while allowing the selected settlers to vacate', () => {
    const sim = mappedSim();
    sim.enqueueSetup({ kind: 'placeBuilding', buildingType: HUT, x: 10, y: 10, tribe: VIKING });
    sim.step();
    const building = placedBuilding(sim);
    const movers = [person(sim, 9, 9), person(sim, 11, 9), person(sim, 12, 9)];
    const idle = person(sim, 9, 10);
    const groups = sim.formationSlots({ hx: 10, hy: 10 }, [...movers, building]);
    expect(groups?.flatMap((group) => group.members)).toEqual(movers);
    const keys = groups?.flatMap((group) => group.slots.map(({ hx, hy }) => `${hx},${hy}`));
    expect(keys).toHaveLength(movers.length);
    expect(keys).not.toContain('10,10');
    expect(keys).not.toContain('11,10');
    expect(keys).not.toContain('9,10');
    expect(sim.formationSlots({ hx: 9, hy: 10 }, [idle])?.[0]?.slots).toEqual([{ hx: 9, hy: 10 }]);
  });

  it('reads structure footprints again on the next click, without a stale client cache', () => {
    const sim = new Simulation({ seed: 1, content: testContent(), map: grassNodeMap(20, 16) });
    const member = person(sim, 2, 2);
    const target = { hx: 10, hy: 8 };
    expect(sim.formationSlots(target, [member])?.[0]?.slots).toEqual([target]);
    const obstacle = sim.world.create();
    sim.world.add(obstacle, Position, positionOfNode(target.hx, target.hy));
    stampResourceFootprintData(sim.world, obstacle, { walk: [{ dx: 0, dy: 0 }], build: [], work: [] });
    expect(sim.formationSlots(target, [member])?.[0]?.slots).not.toContainEqual(target);
    unstampResourceFootprint(sim.world, obstacle);
    expect(sim.formationSlots(target, [member])?.[0]?.slots).toEqual([target]);
  });

  it('gives each member a slot on its own side of a closed gate between two large regions', () => {
    // Each half holds about 750 nodes, past the route-region pocket cap.
    const row = 32;
    const sim = gateSplitSim(24, 64, row);
    const north = person(sim, GATE_X, 4);
    const south = person(sim, GATE_X, 60);
    // Pressed halfway into the gate from the node south of it, nearer the gate than any open node.
    const pressed = person(sim, GATE_X, row + 1);
    const below = positionOfNode(GATE_X, row + 1);
    const onGate = positionOfNode(GATE_X, row);
    sim.world.add(pressed, Position, {
      x: ((below.x + onGate.x) / 2) as typeof below.x,
      y: ((below.y + onGate.y) / 2) as typeof below.y,
    });
    const groups = sim.formationSlots({ hx: GATE_X, hy: row }, [north, south, pressed]);
    expect(slotOf(groups, north)?.hy).toBeLessThan(row);
    expect(slotOf(groups, south)?.hy).toBeGreaterThan(row);
    expect(slotOf(groups, pressed)?.hy).toBeGreaterThan(row);
  });

  it("keeps a military fan wider than the gate's surroundings on its own side", () => {
    const width = 48;
    const row = 64;
    const sim = gateSplitSim(width, 2 * row, row);
    const south = Array.from({ length: LARGE_ARMY }, (_, i) =>
      person(sim, i % width, row + 8 + 2 * Math.floor(i / width)),
    );
    const groups = sim.formationSlots({ hx: GATE_X, hy: row }, south, 2);
    for (const member of south) expect(slotOf(groups, member)?.hy).toBeGreaterThan(row);
  });

  it('lets an attack-move take slots past a closed gate, where its walkers breach', () => {
    const row = 32;
    const sim = gateSplitSim(24, 64, row);
    const south = [0, 1, 2, 3, 4, 5].map((i) => person(sim, GATE_X - 3 + i, 60));
    const groups = sim.formationSlots({ hx: GATE_X, hy: row }, south, 2, 'attackMove');
    expect(south.some((member) => (slotOf(groups, member)?.hy ?? row) < row)).toBe(true);
  });

  it('ignores duplicate, unknown and positionless members and bounds malformed requests', () => {
    const sim = new Simulation({ seed: 1, content: testContent(), map: grassNodeMap(8, 6) });
    const member = person(sim, 2, 2);
    const inside = sim.world.create();
    sim.world.add(inside, Settler, { tribe: 1, jobType: null });
    expect(
      sim.formationSlots({ hx: -20, hy: 40 }, [member, member, inside, 99999 as Entity, -1 as Entity]),
    ).toEqual([{ members: [member], slots: [{ hx: 0, hy: 5 }] }]);
    expect(sim.formationSlots({ hx: 2, hy: 2 }, [])).toEqual([]);
    expect(sim.formationSlots({ hx: 2, hy: 2 }, [inside])).toEqual([]);
    expect(() =>
      sim.formationSlots({ hx: 0, hy: 0 }, Array(MAX_UNIT_ORDER_MEMBERS + 1).fill(member)),
    ).toThrow('invalid formation query');
    expect(() => sim.formationSlots({ hx: Number.NaN, hy: 0 }, [member])).toThrow('invalid formation query');
    expect(() => sim.formationSlots({ hx: 0, hy: 0 }, [member], 1, 'charge' as never)).toThrow(
      'invalid formation query',
    );
    expect(
      new Simulation({ seed: 1, content: testContent() }).formationSlots({ hx: 0, hy: 0 }, [member]),
    ).toBeNull();
  });

  it('finds 1000 legal and distinct slots around a shore', () => {
    const sim = new Simulation({ seed: 1, content: testContent(), map: waterColumnMap(64, 48, 32) });
    const members = Array.from({ length: 1000 }, (_, i) =>
      person(sim, 2 + (i % 40), 2 + Math.floor(i / 40) * 2),
    );
    const groups = sim.formationSlots({ hx: 64, hy: 48 }, members, 2);
    const slots = groups?.flatMap((group) => group.slots) ?? [];
    expect(slots).toHaveLength(1000);
    expect(new Set(slots.map(({ hx, hy }) => `${hx},${hy}`)).size).toBe(1000);
    expect(slots.every(({ hx }) => hx < 64)).toBe(true);
  });

  it('fills legal gaps when military spacing would exclude a thin bank or halve a crowded destination', () => {
    const map = grassNodeMap(8, 3);
    const sim = new Simulation({
      seed: 1,
      content: testContent(),
      map: {
        ...map,
        typeIds: map.typeIds.map((_, i) => (Math.floor(i / 8) === 1 ? 0 : 1)),
      },
    });
    const members = Array.from({ length: 8 }, (_, i) => person(sim, i, 1));
    const groups = sim.formationSlots({ hx: 4, hy: 0 }, members, 2);
    expect(groups?.[0]?.slots).toHaveLength(8);
    expect(groups?.[0]?.slots.every(({ hy }) => hy === 1)).toBe(true);
    const crowded = new Simulation({ seed: 1, content: testContent(), map: grassNodeMap(4, 4) });
    const army = Array.from({ length: 16 }, (_, i) => person(crowded, i % 4, Math.floor(i / 4)));
    const slots = crowded.formationSlots({ hx: 2, hy: 2 }, army, 2)?.[0]?.slots ?? [];
    expect(slots).toHaveLength(16);
    expect(new Set(slots.map(({ hx, hy }) => `${hx},${hy}`)).size).toBe(16);
  });

  it.each([1, 2] as const)(
    'visits each on-map slot at most once on a thin blocked map, spacing %s',
    (spacing) => {
      const visited: string[] = [];
      expect(
        formationNodes(
          { hx: 4, hy: 1 },
          1000,
          3000,
          3,
          (hx, hy) => {
            visited.push(`${hx},${hy}`);
            return true;
          },
          spacing,
        ),
      ).toEqual([]);
      expect(new Set(visited).size).toBe(visited.length);
      expect(visited).toHaveLength(3000 * (spacing === 1 ? 3 : 1));
    },
  );
});

describe('pairBySpace', () => {
  it('keeps every member of a translated layout on its own place', () => {
    const from = [
      { key: 7, x: 0, y: 0 },
      { key: 3, x: 4, y: 0 },
      { key: 5, x: 0, y: 6 },
      { key: 9, x: 4, y: 6 },
    ];
    const shift = { x: 40, y: 12 };
    const to = from.map((point, key) => ({ key, x: point.x + shift.x, y: point.y + shift.y }));
    const paired = pairBySpace(from, to);
    for (const [index, point] of from.entries()) expect(paired.get(point.key)).toBe(index);
  });

  it('takes the leading places and leaves the surplus', () => {
    const paired = pairBySpace(
      [{ key: 1, x: 0, y: 0 }],
      [
        { key: 0, x: 9, y: 9 },
        { key: 1, x: 0, y: 0 },
      ],
    );
    expect([...paired]).toEqual([[1, 0]]);
  });
});
