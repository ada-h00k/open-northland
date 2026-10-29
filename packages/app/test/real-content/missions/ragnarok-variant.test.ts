import { readFileSync } from 'node:fs';
import { findMapVariant, type MapEscalation, mapLobbySlots, TerrainMapFile } from '@open-northland/data';
import {
  components,
  type Entity,
  hexDistanceBetween,
  nodeOfPosition,
  type Simulation,
  systems,
} from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import type { ContentIr } from '../../../src/content/ir/rows.js';
import { buildMapWorld } from '../../../src/entries/map/world.js';
import { mapSessionWorld, variantMapScript } from '../../../src/game/map/variant.js';
import { GATHERERS, GOOD_GOLD } from '../../../src/game/sandbox/ids/index.js';
import { mapScriptWorld, resolveMissionScript } from '../../../src/game/world/mission-script.js';
import { hasRealIr, loadContentUnderTest, rawIrUnderTest } from '../helpers.js';
import { realMapPath, realMapScript, realMapSessionWorld } from '../real-map-world.js';

const MAP_ID = 'specjalna_forteca';
const AUTHORED_PLAYER_SEATS = [0, 1, 2, 3];
const VILLAGE_SEATS = [4, 5];
/** The fortress's refill pulse, the villages' take-over missions, then the raider waves: the 60-minute
 *  start and a generate and restart pair for each of the six raider seats, by authored index. */
const REFILL_MISSIONS = [3, 4];
const TAKE_OVER_MISSIONS = [9, 10];
const FIRST_WAVE_MISSION = 11;
const WAVE_MISSIONS = 13;
const DROPPED_MISSIONS = [
  ...REFILL_MISSIONS,
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

  it('neutralises the refill pulse, take-over missions and raider waves without renumbering the script', () => {
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

describe.runIf(hasRealIr())('a Ragnarök attack on specjalna_forteca', () => {
  const FORTRESS = 6;
  const HUMAN_SEAT = 0;
  const COMPUTER_SEATS = [1, 2, 3];
  /** Left idle: its people stand, so it is attacked like any played seat. */
  const IDLE_SEAT = 4;
  const ABSENT_SEAT = 5;
  const FORTRESS_SIDE = [FORTRESS, 7, 8, 9, 10, 11, 12];
  /** The first launch moved this early, so the run reaches it in seconds of sim time. */
  const EARLY_LAUNCH_SECONDS = 20;
  const TICKS_PER_SECOND = 12;
  /** Two handler rounds for the raider to list and order its band, then a minute of march. */
  const MARCH_TICKS = 2 * systems.AI_HANDLER_ROUND_TICKS + 60 * TICKS_PER_SECOND;
  /** How far march ground the band covers at the least, in map points. */
  const MARCHED = 20;
  /** The mean distance of the garrison from the keep: its Defend posts lie within 40 of it. */
  const GARRISON_REACH = 40;

  function ragnarok(): MapEscalation {
    const escalation = findMapVariant(MAP_ID, 'ragnarok')?.escalation;
    if (escalation === undefined) throw new Error('Ragnarök ships no escalation');
    return escalation;
  }

  /** The escalation with its first launch at {@link EARLY_LAUNCH_SECONDS}. */
  function earlyAttack(): MapEscalation {
    const real = ragnarok();
    const [first, ...later] = real.attacks.launches;
    if (first === undefined) throw new Error('no first launch');
    return {
      ...real,
      attacks: { ...real.attacks, launches: [{ ...first, atSeconds: EARLY_LAUNCH_SECONDS }, ...later] },
    };
  }

  async function earlyAttackWorld(escalation: MapEscalation = earlyAttack()): Promise<Simulation> {
    const ir = rawIrUnderTest() as ContentIr;
    const { merge } = await loadContentUnderTest();
    const map = TerrainMapFile.parse(JSON.parse(readFileSync(realMapPath(MAP_ID), 'utf8')));
    const { ragnarok: script } = scripts();
    return buildMapWorld({
      seed: 7,
      map,
      ir,
      content: { content: merge.content },
      machineSeats: [...COMPUTER_SEATS, ...FORTRESS_SIDE],
      absentSeats: [ABSENT_SEAT],
      assistantSeats: [0],
      script: { ...mapScriptWorld(script, ir), escalation },
      fog: null,
      progression: null,
      needs: null,
      alliedVision: null,
      peace: null,
      missions: false,
      berryBushes: false,
    }).sim;
  }

  function owned(sim: Simulation, seat: number): Entity[] {
    return [...sim.world.query(components.Person, components.Owner)].filter(
      (e) => sim.world.get(e, components.Owner).player === seat,
    );
  }

  function meanDistance(sim: Simulation, men: readonly Entity[], to: { x: number; y: number }): number {
    let sum = 0;
    for (const e of men) {
      const at = sim.world.get(e, components.Position);
      const node = nodeOfPosition(at.x, at.y);
      sum += hexDistanceBetween(node.hx, node.hy, to.x, to.y);
    }
    return sum / men.length;
  }

  it('sends each occupied seat’s raider its band from the keep, and leaves the garrison home', async () => {
    const sim = await earlyAttackWorld();
    const escalation = ragnarok();
    const { keep, attacks } = escalation;
    const garrison = owned(sim, FORTRESS);
    const launch = EARLY_LAUNCH_SECONDS * TICKS_PER_SECOND;
    let launched: number[] | null = null;
    while (sim.tick < launch) {
      sim.step();
      for (const ev of sim.events.current())
        if (ev.kind === 'mapEscalationAttackLaunched') launched = [...ev.seats];
    }
    expect(launched).toEqual([0, ...COMPUTER_SEATS, IDLE_SEAT]);
    const firstWave = attacks.launches[0]?.landMen;
    const bands = new Map(attacks.targets.map((target) => [target, owned(sim, target.raider)]));
    for (const [target, band] of bands) {
      expect(band, `raider ${target.raider}`).toHaveLength(
        target.seat === ABSENT_SEAT ? 0 : (firstWave ?? -1),
      );
      if (band.length > 0) expect(meanDistance(sim, band, keep)).toBeLessThan(keep.range);
    }
    expect(sim.mapEscalationView()).toMatchObject({ wave: 1, attackRunning: true });

    sim.run(MARCH_TICKS);
    for (const [target, band] of bands) {
      if (band.length === 0) continue;
      const from = hexDistanceBetween(keep.x, keep.y, target.x, target.y);
      expect(meanDistance(sim, band, target), `raider ${target.raider}`).toBeLessThan(from - MARCHED);
    }
    // The garrison is the fortress's own still, standing in the fortress; catapult crews stand nowhere.
    const standing = garrison.filter((e) => sim.world.has(e, components.Position));
    for (const e of garrison) expect(sim.world.tryGet(e, components.Owner)?.player).toBe(FORTRESS);
    expect(meanDistance(sim, standing, keep)).toBeLessThan(GARRISON_REACH);
  }, 300_000);

  it('gears the fortress side’s soldiers, existing and new, and raises a lost catapult again', async () => {
    const early = earlyAttack();
    const gear = early.gear;
    const respawn = early.catapults;
    if (gear === undefined || respawn === undefined) throw new Error('Ragnarök ships no gear or catapults');
    /** Every gear step one second apart from the second second on, all passed before the first launch. */
    const FIRST_STEP_SECONDS = 2;
    const CATAPULT_RESPAWN_SECONDS = 30;
    const escalation: MapEscalation = {
      ...early,
      gear: { ...gear, steps: gear.steps.map((step, i) => ({ ...step, atSeconds: FIRST_STEP_SECONDS + i })) },
      catapults: { respawnSeconds: CATAPULT_RESPAWN_SECONDS },
    };
    const sim = await earlyAttackWorld(escalation);
    const goods = new Map(sim.content.goods.map((good) => [good.id, good]));
    const typeOf = (slug: string): number => goods.get(slug)?.typeId ?? -1;
    const heavyArmor = (gear.steps[1]?.grants[0]?.goods ?? []).map(typeOf);
    const amulets = (gear.steps[2]?.grants[0]?.goods ?? []).map(typeOf);
    const healDraught = typeOf('potion_heal_big');
    // The goods carry the effects the combat reads: armor tiers, the amulets' effects and a heal.
    for (const step of gear.steps)
      for (const grant of step.grants)
        for (const slug of grant.goods) expect(goods.get(slug)?.equip, slug).toBeDefined();
    expect(goods.get('potion_heal_big')?.equip?.restorePct?.healthMax).toBeGreaterThan(0);
    expect(goods.get('amulet_defense')?.equip?.damageTakenPct).toBeDefined();

    const fortressCatapults = () =>
      [...sim.world.query(components.Vehicle, components.Owner)].filter(
        (e) => sim.world.get(e, components.Owner).player === FORTRESS,
      );
    const catapults = fortressCatapults();
    expect(catapults.length).toBeGreaterThan(0);

    sim.run((FIRST_STEP_SECONDS + gear.steps.length) * TICKS_PER_SECOND - sim.tick);
    const garrison = owned(sim, FORTRESS).filter((e) => sim.world.has(e, components.Equipment));
    expect(garrison.length).toBeGreaterThan(gear.steps.length);
    const misc = (e: Entity) =>
      (sim.world.get(e, components.Equipment).misc ?? []).flatMap((slot) =>
        slot === null ? [] : [slot.goodType],
      );
    for (const e of garrison) {
      const eq = sim.world.get(e, components.Equipment);
      expect(heavyArmor).toContain(eq.armor?.goodType);
      expect(eq.boots?.goodType).toBe(typeOf('shoes'));
      expect(eq.weapon).not.toBeNull();
    }
    expect(garrison.some((e) => misc(e).some((good) => amulets.includes(good)))).toBe(true);
    expect(garrison.some((e) => misc(e).includes(healDraught))).toBe(true);

    const [lost] = catapults;
    if (lost === undefined) throw new Error('no catapult');
    const spot = sim.world.get(lost, components.Vehicle).guard;
    sim.world.mut(lost, components.Health).hitpoints = 0;
    sim.run((EARLY_LAUNCH_SECONDS + 1) * TICKS_PER_SECOND - sim.tick);
    const humanRaider = escalation.attacks.targets.find((target) => target.seat === HUMAN_SEAT)?.raider;
    const band = humanRaider === undefined ? [] : owned(sim, humanRaider);
    expect(band.length).toBeGreaterThan(0);
    for (const e of band)
      expect(heavyArmor).toContain(sim.world.tryGet(e, components.Equipment)?.armor?.goodType);
    expect(fortressCatapults()).toHaveLength(catapults.length - 1);

    // Seen lost within a second; the first refill beat a full wait after that raises it.
    const firstBeat = (escalation.guard.refill[0]?.everySeconds ?? 0) * TICKS_PER_SECOND;
    sim.run(firstBeat + TICKS_PER_SECOND - sim.tick);
    const back = fortressCatapults().filter((e) => !catapults.includes(e));
    expect(back).toHaveLength(1);
    expect(sim.world.get(back[0] as Entity, components.Vehicle).guard).toEqual(spot);
  }, 300_000);

  it('schedules the owner’s waves: the first at 0:40, landings on the odd ones from the third', () => {
    const { launches, repeat } = ragnarok().attacks;
    const MINUTE = 60;
    expect(launches.map((row) => row.atSeconds / MINUTE)).toEqual([40, 65, 90, 120, 150]);
    expect(launches.map((row) => row.landMen)).toEqual([10, 20, 30, 60, 60]);
    expect([...launches, ...repeat.waves].map((row) => row.seaMen > 0)).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });
});
