import { describe, expect, it } from 'vitest';
import {
  applyMapVariantBriefing,
  applyMapVariantEntities,
  applyMapVariantScript,
  applyMapVariantSlots,
  MAP_VARIANTS,
  MapBriefing,
  MapEscalation,
  MapScript,
  MapVariant,
  mapLobbySlots,
  TerrainEntities,
} from '../../src/index.js';

const OPEN_SEAT = 0;
const VILLAGE_SEAT = 1;
const TRADE_HOUSE = 1;
const OTHER_HOUSE = 2;

const line = (key: string, ...values: string[]) => ({ key, values });

const SCRIPT = MapScript.parse({
  players: [
    { player: OPEN_SEAT, type: 'human', tribeId: 1, colorId: 0 },
    { player: VILLAGE_SEAT, type: 'ai', tribeId: 1, colorId: 1 },
  ],
  multiplayer: {
    slotOptions: [
      { player: OPEN_SEAT, allowed: ['human', 'ai', 'none'] },
      { player: VILLAGE_SEAT, allowed: ['ai'] },
    ],
  },
  tradeAgreements: [
    { missionId: TRADE_HOUSE, giveGood: 1, giveAmount: 1, takeGood: 2, takeAmount: 1 },
    { missionId: OTHER_HOUSE, giveGood: 1, giveAmount: 1, takeGood: 2, takeAmount: 1 },
  ],
  missions: [
    {
      debugName: 'Won',
      active: true,
      goals: [line('goal', 'True')],
      results: [line('result', 'MissionWon', '0')],
    },
    {
      debugName: 'Take over',
      active: true,
      visible: true,
      goals: [line('goal', 'True')],
      results: [line('result', 'ActivateMission', '2')],
    },
    {
      debugName: 'Wave',
      goals: [line('goal', 'TimeGone', '60')],
      results: [line('result', 'ActivateMission', '1')],
    },
    { debugName: 'Later', goals: [line('goal', 'True')], results: [line('result', 'ActivateMission', '0')] },
  ],
});

const VARIANT = MapVariant.parse({
  mapId: 'test',
  kind: 'ragnarok',
  script: {
    slotOptions: [{ player: VILLAGE_SEAT, allowed: ['human', 'ai', 'none'] }],
    neutralizedMissions: ['Take over', 'Wave'],
    appendedResults: [{ mission: 'Won', results: [line('result', 'MissionWon', '1')] }],
    droppedTradeHouses: [TRADE_HOUSE],
  },
});

describe('applyMapVariantScript', () => {
  it('neutralises missions in place, so every mission keeps its ActivateMission index', () => {
    const patched = applyMapVariantScript(SCRIPT, VARIANT);

    expect(patched.missions.map((m) => m.debugName)).toEqual(['Won', 'Take over', 'Wave', 'Later']);
    expect(patched.missions[1]).toEqual({ debugName: 'Take over', goals: [], results: [], other: [] });
    expect(patched.missions[2]).toEqual({ debugName: 'Wave', goals: [], results: [], other: [] });
    expect(patched.missions[3]).toBe(SCRIPT.missions[3]);
  });

  it('appends results, drops the named house trades and opens the replaced seat', () => {
    const patched = applyMapVariantScript(SCRIPT, VARIANT);

    expect(patched.missions[0]?.results).toEqual([
      line('result', 'MissionWon', '0'),
      line('result', 'MissionWon', '1'),
    ]);
    expect(patched.tradeAgreements.map((row) => row.missionId)).toEqual([OTHER_HOUSE]);
    expect(mapLobbySlots(patched).map((slot) => slot.claimable)).toEqual([true, true]);
    expect(mapLobbySlots(SCRIPT).map((slot) => slot.claimable)).toEqual([true, false]);
  });

  it('appends AI tasks after a seat’s authored ones and refuses a seat without rows', () => {
    const defend = {
      kind: 'defend' as const,
      priority: 5,
      condition: 0,
      x: 1,
      y: 1,
      range: 4,
      min: 0,
      max: 0,
    };
    const seat = {
      player: VILLAGE_SEAT,
      allDisabled: false,
      computerDisabled: true,
      disabledComputerModules: [],
    };
    const script = MapScript.parse({ ...SCRIPT, ai: [{ ...seat, tasks: [defend] }] });
    const appended = { ...defend, x: 2 };
    const patched = applyMapVariantScript(script, {
      ...VARIANT,
      script: { ...VARIANT.script, appendedAiTasks: [{ player: VILLAGE_SEAT, tasks: [appended] }] },
    });
    expect(patched.ai[0]?.tasks).toEqual([defend, appended]);
    const stray = { ...VARIANT.script, appendedAiTasks: [{ player: OPEN_SEAT, tasks: [appended] }] };
    expect(() => applyMapVariantScript(script, { ...VARIANT, script: stray })).toThrow(
      /no \[AIData\] rows for seat 0/,
    );
  });

  it('refuses a variant naming a mission the script lacks', () => {
    const stale = { ...VARIANT, script: { ...VARIANT.script, neutralizedMissions: ['Gone'] } };
    expect(() => applyMapVariantScript(SCRIPT, stale)).toThrow(/no single mission named Gone/);
  });

  it('refuses a variant that leaves a kept mission activating a neutralised one', () => {
    const dangling = {
      ...VARIANT,
      script: { ...VARIANT.script, neutralizedMissions: ['Won'], appendedResults: [] },
    };
    expect(() => applyMapVariantScript(SCRIPT, dangling)).toThrow(/Later still activates neutralised 0/);
  });
});

describe('a start seat', () => {
  const FORTRESS = 6;
  const PLACE_ANY = 2;
  const PLACE_HOUSE = 3;
  const HOUSE = 41;
  const started = MapVariant.parse({
    ...VARIANT,
    startSeats: [{ player: VILLAGE_SEAT, from: OPEN_SEAT, dx: 10, dy: -2 }],
  });

  it('takes the source seat’s settlers shifted, without its object ids, and drops its own', () => {
    const entities = TerrainEntities.parse({
      humans: [
        { tribe: 'viking', role: 'woman', player: OPEN_SEAT, hx: 4, hy: 5, missionId: 3 },
        { tribe: 'viking', role: 'civilist', player: VILLAGE_SEAT, hx: 40, hy: 40 },
        { tribe: 'viking', role: 'collector', player: OPEN_SEAT, hx: 6, hy: 7, producedGood: 'wood' },
        { tribe: 'viking', role: 'soldier', player: FORTRESS, hx: 50, hy: 50 },
      ],
    });
    const humans = applyMapVariantEntities(entities, started).humans;

    expect(humans.map((h) => [h.player, h.role, h.hx, h.hy, h.missionId])).toEqual([
      [OPEN_SEAT, 'woman', 4, 5, 3],
      [OPEN_SEAT, 'collector', 6, 7, undefined],
      [FORTRESS, 'soldier', 50, 50, undefined],
      [VILLAGE_SEAT, 'woman', 14, 3, undefined],
      [VILLAGE_SEAT, 'collector', 16, 5, undefined],
    ]);
    expect(humans.at(-1)?.producedGood).toBe('wood');
    const offMap = { ...started, startSeats: [{ player: VILLAGE_SEAT, from: OPEN_SEAT, dx: -5, dy: 0 }] };
    expect(() => applyMapVariantEntities(entities, offMap)).toThrow(/leaves the map/);
  });

  it('takes the source seat’s papers and diplomacy locks in place of its own', () => {
    const script = MapScript.parse({
      ...SCRIPT,
      specialItems: [
        { player: OPEN_SEAT, kind: PLACE_HOUSE, param: HOUSE },
        { player: VILLAGE_SEAT, kind: PLACE_ANY, param: 0 },
        { player: OPEN_SEAT, kind: PLACE_ANY, param: 0 },
      ],
      relationFlags: [
        { kind: 'notChangeable', a: OPEN_SEAT, b: FORTRESS },
        { kind: 'hide', a: FORTRESS, b: OPEN_SEAT },
        { kind: 'notChangeable', a: OPEN_SEAT, b: VILLAGE_SEAT },
        { kind: 'hide', a: VILLAGE_SEAT, b: FORTRESS },
      ],
    });
    const patched = applyMapVariantScript(script, started);

    expect(patched.specialItems).toEqual([
      { player: OPEN_SEAT, kind: PLACE_HOUSE, param: HOUSE },
      { player: OPEN_SEAT, kind: PLACE_ANY, param: 0 },
      { player: VILLAGE_SEAT, kind: PLACE_HOUSE, param: HOUSE },
      { player: VILLAGE_SEAT, kind: PLACE_ANY, param: 0 },
    ]);
    expect(patched.relationFlags).toEqual([
      { kind: 'notChangeable', a: OPEN_SEAT, b: FORTRESS },
      { kind: 'hide', a: FORTRESS, b: OPEN_SEAT },
      { kind: 'notChangeable', a: VILLAGE_SEAT, b: FORTRESS },
      { kind: 'hide', a: FORTRESS, b: VILLAGE_SEAT },
    ]);
  });

  it('refuses a seat started twice or from another start seat', () => {
    const row = { player: VILLAGE_SEAT, from: OPEN_SEAT, dx: 0, dy: 0 };
    const twice = { ...started, startSeats: [row, row] };
    expect(() => applyMapVariantScript(SCRIPT, twice)).toThrow(/starts seat 1 twice/);
    const chained = { ...started, startSeats: [row, { player: 2, from: VILLAGE_SEAT, dx: 0, dy: 0 }] };
    expect(() => applyMapVariantScript(SCRIPT, chained)).toThrow(/from start seat 1/);
  });
});

describe('applyMapVariantSlots', () => {
  it('re-reads only the replaced seats of a map index roster', () => {
    const slots = mapLobbySlots(SCRIPT);
    const patched = applyMapVariantSlots(slots, VARIANT);

    expect(patched[0]).toBe(slots[0]);
    expect(patched[1]).toMatchObject({ claimable: true, aiAllowed: true, noneAllowed: true });
  });
});

describe('applyMapVariantBriefing', () => {
  const OPENING = 0;
  const WON = 1;
  const text = (value: string) => ({ kind: 'text' as const, style: 'body' as const, text: value });
  const BRIEFING = MapBriefing.parse({
    texts: {
      pol: { [OPENING]: [text('start')], [WON]: [text('won')] },
      eng: { [OPENING]: [text('start')] },
      chs: { [OPENING]: [text('start')] },
    },
  });
  const told = MapVariant.parse({
    ...VARIANT,
    briefingPages: {
      [OPENING]: { pol: [text('tryb')], eng: [text('mode')] },
      [WON]: { eng: [text('victory')] },
    },
  });

  it('replaces the written pages in each language, a missing one read in its fallback', () => {
    const patched = applyMapVariantBriefing(BRIEFING, told);

    expect(patched.texts.pol?.[OPENING]).toEqual([text('tryb')]);
    expect(patched.texts.pol?.[WON]).toEqual([text('victory')]);
    expect(patched.texts.eng?.[OPENING]).toEqual([text('mode')]);
    expect(patched.texts.eng?.[WON]).toBeUndefined();
    expect(patched.texts.chs?.[OPENING]).toEqual([text('mode')]);
    expect(applyMapVariantBriefing(BRIEFING, VARIANT)).toBe(BRIEFING);
  });
});

describe('MapEscalation', () => {
  it('refuses a schedule or gear steps out of order, a seat targeted twice or a refill above its max', () => {
    const variant = MAP_VARIANTS.find((row) => row.escalation !== undefined);
    if (variant?.escalation === undefined) throw new Error('no committed escalation to vary');
    const { attacks, guard, gear } = variant.escalation;
    if (gear === undefined) throw new Error('no committed gear to vary');
    const target = attacks.targets[0];
    for (const bad of [
      { attacks: { ...attacks, launches: [...attacks.launches].reverse() } },
      { attacks: { ...attacks, targets: [target, target] } },
      { guard: { ...guard, refill: { ...guard.refill, baseMen: guard.refill.maxMen + 1 } } },
      { gear: { ...gear, steps: [...gear.steps].reverse() } },
    ]) {
      expect(MapEscalation.safeParse({ ...variant.escalation, ...bad }).success).toBe(false);
    }
  });
});

describe('MAP_VARIANTS', () => {
  it('holds at most one variant of each kind per map', () => {
    const keys = MAP_VARIANTS.map((variant) => `${variant.mapId}/${variant.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
