import type { MapVariantInput } from './schema.js';

/** Mieszkańcy równiny and Górale, the two villages the authored map hands to whoever reaches them. */
const PLAIN_SEAT = 4;
const HIGHLAND_SEAT = 5;
/** The fortress's raider camps, one per player seat. */
const RAIDER_SEATS = [7, 8, 9, 10, 11, 12];
/** The house mission object id the plain's headquarters is placed with, which its trade rows name. */
const PLAIN_HEADQUARTERS = 1;
const RAGNAROK_DEPOSIT_YIELD = 3;

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
    neutralizedMissions: ['Changezu_P4', 'Changezu_P5', 'Start Attack 60 min', ...RAIDER_WAVE_MISSIONS],
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
  },
  depositYield: {
    gold: RAGNAROK_DEPOSIT_YIELD,
    iron: RAGNAROK_DEPOSIT_YIELD,
    mushroom: RAGNAROK_DEPOSIT_YIELD,
  },
};
