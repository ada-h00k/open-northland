import { findMapVariant, mapLobbySlots } from '@open-northland/data';
import { components, type Simulation } from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import type { ContentIr } from '../../../src/content/ir/rows.js';
import { mapSessionWorld, variantMapScript } from '../../../src/game/map/variant.js';
import { GATHERERS, GOOD_GOLD } from '../../../src/game/sandbox/ids/index.js';
import { resolveMissionScript } from '../../../src/game/world/mission-script.js';
import { hasRealIr, rawIrUnderTest } from '../helpers.js';
import { realMapScript, realMapSessionWorld } from '../real-map-world.js';

const MAP_ID = 'specjalna_forteca';
const AUTHORED_PLAYER_SEATS = [0, 1, 2, 3];
const VILLAGE_SEATS = [4, 5];
/** The villages' take-over missions, then the raider waves: the 60-minute start and a generate and
 *  restart pair for each of the six raider seats, by authored index. */
const TAKE_OVER_MISSIONS = [9, 10];
const FIRST_WAVE_MISSION = 11;
const WAVE_MISSIONS = 13;
const DROPPED_MISSIONS = [
  ...TAKE_OVER_MISSIONS,
  ...Array.from({ length: WAVE_MISSIONS }, (_, i) => FIRST_WAVE_MISSION + i),
];

function scripts() {
  const authored = realMapScript(MAP_ID);
  if (authored === null) throw new Error(`no decoded script for ${MAP_ID}`);
  return { authored, ragnarok: variantMapScript(authored, mapSessionWorld(MAP_ID, 'ragnarok')) };
}

describe.runIf(hasRealIr())('Ragnarök on specjalna_forteca', () => {
  it('opens the two villages as player seats', () => {
    const { authored, ragnarok } = scripts();
    const claimable = (script: typeof authored) =>
      mapLobbySlots(script)
        .filter((slot) => slot.claimable)
        .map((slot) => slot.player);

    expect(claimable(authored)).toEqual(AUTHORED_PLAYER_SEATS);
    expect(claimable(ragnarok)).toEqual([...AUTHORED_PLAYER_SEATS, ...VILLAGE_SEATS]);
  });

  it('neutralises the take-over missions and raider waves without renumbering the script', () => {
    const { authored, ragnarok } = scripts();

    expect(ragnarok.missions.map((m) => m.debugName)).toEqual(authored.missions.map((m) => m.debugName));
    const emptied = ragnarok.missions.flatMap((m, i) =>
      m.goals.length === 0 && m.results.length === 0 ? [i] : [],
    );
    expect(emptied).toEqual(DROPPED_MISSIONS);
    // Seat 4's headquarters held every trade agreement the map authors.
    expect(authored.tradeAgreements.length).toBeGreaterThan(0);
    expect(ragnarok.tradeAgreements).toEqual([]);
  });

  it('resolves the patched script with no name the authored one did not leave unresolved', () => {
    const { authored, ragnarok } = scripts();
    const ir = rawIrUnderTest() as ContentIr;
    const before = resolveMissionScript(authored.missions, ir);
    const after = resolveMissionScript(ragnarok.missions, ir);

    expect(after.unknownOpcodes).toBe(before.unknownOpcodes);
    expect(after.tokenMismatches).toBe(before.tokenMismatches);
    expect(after.unresolvedNames).toEqual(before.unresolvedNames);
  });

  it('multiplies only goods a map deposit spawns as', () => {
    const variant = findMapVariant(MAP_ID, 'ragnarok');
    const gathered = new Set(GATHERERS.map((g) => g.id));
    expect(Object.keys(variant?.depositYield ?? {}).filter((good) => !gathered.has(good))).toEqual([]);
  });
});

describe.runIf(hasRealIr())('a Ragnarök world on specjalna_forteca', () => {
  const SEARCH = 'map=specjalna_forteca&player=4&missions=off&seed=7';
  const GOLD = 'gold';

  function goldStock(sim: Simulation): number {
    let total = 0;
    for (const e of sim.world.query(components.Resource)) {
      const resource = sim.world.get(e, components.Resource);
      if (resource.goodType === GOOD_GOLD) total += resource.remaining;
    }
    return total;
  }

  it('starts every gold deposit at the variant factor times its authored stock', async () => {
    const factor = findMapVariant(MAP_ID, 'ragnarok')?.depositYield[GOLD];
    const authored = await realMapSessionWorld(`?${SEARCH}`);
    const ragnarok = await realMapSessionWorld(`?${SEARCH}&variant=ragnarok`);
    if (factor === undefined) throw new Error('no gold yield to compare');

    expect(goldStock(authored)).toBeGreaterThan(0);
    expect(goldStock(ragnarok)).toBe(goldStock(authored) * factor);
  });
});
