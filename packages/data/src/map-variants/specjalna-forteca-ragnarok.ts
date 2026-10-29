import type { MapVariantInput } from './schema.js';
import { SPECJALNA_FORTECA_RAGNAROK_BRIEFING } from './specjalna-forteca-ragnarok-briefing.js';

/** Mieszkańcy równiny and Górale, the two villages the authored map hands to whoever reaches them. */
const PLAIN_SEAT = 4;
const HIGHLAND_SEAT = 5;
/** The fortress seat and its keep: the `frank castle` the map's own AI rows test for at this point. */
const FORTRESS_SEAT = 6;
const KEEP = { houseType: 39, x: 250, y: 243, range: 10 };
/** The tribe and trades the map's own `CreateCreatures` lines spawn the fortress's men as. */
const FORTRESS_TRIBE = 2;
const SWORD_LONG = 35;
const SWORD_SHORT = 34;
const BOW_LONG = 41;

/** Each player seat, the raider camp the map sends against it, and that camp's authored Attack task:
 *  the seat's headquarters, the reach and the rally point. `landing` is the seat's sea landing: a sea
 *  node in the map's edge band the ship appears on, and the shore node nearest the headquarters that a
 *  small ship can dock at from the open sea and that is on the headquarters' own land. */
const RAIDS = [
  {
    seat: 0,
    raider: 7,
    x: 407,
    y: 263,
    rallyX: 289,
    rallyY: 254,
    landing: { spawnX: 490, spawnY: 219, x: 481, y: 263 },
  },
  {
    seat: 1,
    raider: 8,
    x: 129,
    y: 203,
    rallyX: 209,
    rallyY: 220,
    landing: { spawnX: 9, spawnY: 169, x: 65, y: 169 },
  },
  {
    seat: 2,
    raider: 9,
    x: 348,
    y: 159,
    rallyX: 286,
    rallyY: 204,
    landing: { spawnX: 351, spawnY: 9, x: 386, y: 84 },
  },
  {
    seat: 3,
    raider: 10,
    x: 138,
    y: 385,
    rallyX: 206,
    rallyY: 282,
    landing: { spawnX: 85, spawnY: 490, x: 108, y: 443 },
  },
  {
    seat: 4,
    raider: 11,
    x: 248,
    y: 120,
    rallyX: 240,
    rallyY: 191,
    landing: { spawnX: 213, spawnY: 9, x: 256, y: 103 },
  },
  {
    seat: 5,
    raider: 12,
    x: 310,
    y: 375,
    rallyX: 289,
    rallyY: 254,
    landing: { spawnX: 271, spawnY: 490, x: 294, y: 437 },
  },
];
const RAIDER_SEATS = RAIDS.map((raid) => raid.raider);
const RAID_RANGE = 120;
const RAID_PRIORITY = 100;
const RAID_STANCE = 1;
/** A raider program's slot that holds while its target still has a finished house in reach. */
const TARGET_STANDS_SLOT = 2;

/** Defend posts on open ground around the keep, inside its inner ring of towers, uncapped, so the
 *  growing guard stands in the fortress. */
const INNER_POSTS = [
  { x: 250, y: 232 },
  { x: 258, y: 250 },
  { x: 244, y: 250 },
  { x: 236, y: 236 },
];
const INNER_POST_PRIORITY = 5;
const INNER_POST_RANGE = 12;
/** The condition reference that always holds (`[AIData]`). */
const ALWAYS = 100000;

/** The fortress side's gear, by content good slug: the light and heavy armor pairs, the four combat
 *  amulets and the large healing draught, with the share of soldiers that draws each misc piece. */
const LIGHT_ARMOR = ['armor_wool', 'armor_leather'];
const HEAVY_ARMOR = ['armor_chain', 'armor_plate'];
const COMBAT_AMULETS = ['amulet_strength', 'amulet_defense', 'amulet_speed', 'amulet_crithit'];
const AMULET_CHANCE_PCT = 35;
const HEAL_DRAUGHT_CHANCE_PCT = 30;
/** How long a lost fortress catapult stays gone. */
const CATAPULT_RESPAWN_MINUTES = 10;

const MINUTE = 60;
const HALF_HOUR = 30 * MINUTE;
const HOUR = 60 * MINUTE;
/** The house mission object id the plain's headquarters is placed with, which its trade rows name. */
const PLAIN_HEADQUARTERS = 1;
const RAGNAROK_DEPOSIT_YIELD = 3;

/** The highlanders start with one woman, so the match would count their seat out at once. They get
 *  the plain's six men, placed off their headquarters (315, 378) as the plain's stand off its own. */
const HIGHLAND_MEN = { tribe: 'viking', role: 'civilist', hx: 318, hy: 388, count: 6 };

/** The authored map's seat 0-3 lobby offer, which Ragnarök extends to the two villages. */
const PLAYER_SEAT_OFFER = ['human', 'ai', 'none'] as const;

/** The raider camps' recurring flag waves, which Ragnarök replaces with its own attack schedule. */
const RAIDER_WAVE_MISSIONS = RAIDER_SEATS.flatMap((seat) => [
  `Generate 20 min P${seat}`,
  `Restart Timer P${seat}`,
]);

const result = (...values: string[]) => ({ key: 'result', values });
const reveal = (seat: number, x: number, y: number, radius: number) =>
  result('ExploreArea', String(seat), String(x), String(y), String(radius));
/** Each new player seat sees an ally's start area the way the authored seats 0-3 do. */
const revealToNewSeats = (x: number, y: number, radius: number) => [
  reveal(PLAIN_SEAT, x, y, radius),
  reveal(HIGHLAND_SEAT, x, y, radius),
];

/**
 * Ragnarök on Forteca: the plain's villagers (seat 4) and the highlanders (seat 5) play as ordinary
 * seats instead of waiting to be taken over, so their take-over missions, seat 4's trade post and the
 * authored raider waves go. Coordinates are the map's own `ExploreArea` areas.
 */
export const SPECJALNA_FORTECA_RAGNAROK: MapVariantInput = {
  mapId: 'specjalna_forteca',
  kind: 'ragnarok',
  script: {
    slotOptions: [
      { player: PLAIN_SEAT, allowed: [...PLAYER_SEAT_OFFER] },
      { player: HIGHLAND_SEAT, allowed: [...PLAYER_SEAT_OFFER] },
    ],
    neutralizedMissions: [
      'Changezu_P4',
      'Changezu_P5',
      'Start Attack 60 min',
      ...RAIDER_WAVE_MISSIONS,
      // The fortress's 65-second refill pulse: the escalation's guard refill takes it over.
      'Defend Timer',
      'Defend Timer Restart',
    ],
    appendedResults: [
      {
        mission: 'MissionWon',
        results: [result('MissionWon', String(PLAIN_SEAT)), result('MissionWon', String(HIGHLAND_SEAT))],
      },
      {
        mission: 'Alle AI´s sichtbar',
        results: [
          ...revealToNewSeats(245, 246, 40),
          reveal(PLAIN_SEAT, 308, 377, 25),
          reveal(HIGHLAND_SEAT, 250, 112, 25),
        ],
      },
      { mission: 'Explore 0', results: revealToNewSeats(428, 265, 25) },
      { mission: 'Explore 1', results: revealToNewSeats(125, 193, 25) },
      { mission: 'Explore 2', results: revealToNewSeats(352, 155, 25) },
      { mission: 'Explore 3', results: revealToNewSeats(133, 389, 25) },
    ],
    droppedTradeHouses: [PLAIN_HEADQUARTERS],
    appendedAiTasks: [
      {
        player: FORTRESS_SEAT,
        tasks: INNER_POSTS.map((post) => ({
          kind: 'defend' as const,
          priority: INNER_POST_PRIORITY,
          condition: ALWAYS,
          ...post,
          range: INNER_POST_RANGE,
          min: 0,
          max: 0,
        })),
      },
      // The authored Attack holds only while no enemy soldier stands near the keep; this twin holds
      // while the target stands, so one seat's men at the walls do not keep every raid at home.
      ...RAIDS.map((raid) => ({
        player: raid.raider,
        tasks: [
          {
            kind: 'attack' as const,
            priority: RAID_PRIORITY,
            condition: TARGET_STANDS_SLOT,
            x: raid.x,
            y: raid.y,
            range: RAID_RANGE,
            min: 0,
            max: 0,
            rallyX: raid.rallyX,
            rallyY: raid.rallyY,
            stance: RAID_STANCE,
          },
        ],
      })),
    ],
  },
  startHumans: Array.from({ length: HIGHLAND_MEN.count }, () => ({
    tribe: HIGHLAND_MEN.tribe,
    role: HIGHLAND_MEN.role,
    player: HIGHLAND_SEAT,
    hx: HIGHLAND_MEN.hx,
    hy: HIGHLAND_MEN.hy,
  })),
  depositYield: {
    gold: RAGNAROK_DEPOSIT_YIELD,
    iron: RAGNAROK_DEPOSIT_YIELD,
    mushroom: RAGNAROK_DEPOSIT_YIELD,
  },
  briefingAppend: SPECJALNA_FORTECA_RAGNAROK_BRIEFING,
  // Starter numbers proposed for the owner.
  escalation: {
    keep: { seat: FORTRESS_SEAT, ...KEEP },
    tribe: FORTRESS_TRIBE,
    jobMix: [
      { job: SWORD_LONG, weight: 2 },
      { job: SWORD_SHORT, weight: 1 },
      { job: BOW_LONG, weight: 2 },
    ],
    attacks: {
      launches: [
        { atSeconds: 40 * MINUTE, landMen: 10, seaMen: 0 },
        { atSeconds: 65 * MINUTE, landMen: 20, seaMen: 0 },
        { atSeconds: 90 * MINUTE, landMen: 30, seaMen: 20 },
        { atSeconds: 2 * HOUR, landMen: 60, seaMen: 0 },
        { atSeconds: 150 * MINUTE, landMen: 60, seaMen: 20 },
      ],
      // Waves 6, 7, ...: the odd ones bring a landing.
      repeat: {
        everySeconds: HALF_HOUR,
        waves: [
          { landMen: 60, seaMen: 0 },
          { landMen: 60, seaMen: 20 },
        ],
      },
      endAfterSeconds: 12 * MINUTE,
      targets: RAIDS.map(({ seat, raider, x, y, landing }) => ({ seat, raider, x, y, landing })),
    },
    guard: {
      base: 140,
      perSeatStep: 5,
      stepSeconds: HALF_HOUR,
      perSeatMax: 30,
      // The map's own pulse, then a faster one.
      refill: [
        { fromSeconds: 0, everySeconds: 65, men: 3 },
        { fromSeconds: HOUR, everySeconds: 40, men: 4 },
      ],
    },
    gear: {
      seats: [FORTRESS_SEAT, ...RAIDER_SEATS],
      steps: [
        {
          atSeconds: HOUR,
          noticeKey: 'ragnarok.gear.lightArmor',
          grants: [{ goods: LIGHT_ARMOR }, { goods: ['shoes'] }],
        },
        { atSeconds: 2 * HOUR, noticeKey: 'ragnarok.gear.heavyArmor', grants: [{ goods: HEAVY_ARMOR }] },
        {
          atSeconds: 150 * MINUTE,
          noticeKey: 'ragnarok.gear.amulets',
          grants: [{ goods: COMBAT_AMULETS, chancePct: AMULET_CHANCE_PCT }],
        },
        {
          atSeconds: 3 * HOUR,
          noticeKey: 'ragnarok.gear.healDraughts',
          grants: [{ goods: ['potion_heal_big'], chancePct: HEAL_DRAUGHT_CHANCE_PCT }],
        },
      ],
    },
    landings: { vehicle: 'ship_small', noticeKey: 'ragnarok.landing' },
    catapults: { respawnSeconds: CATAPULT_RESPAWN_MINUTES * MINUTE },
    // Owner ruling: a computer seat starts building up with every man it has.
    demobilizeComputerSeats: true,
  },
};
