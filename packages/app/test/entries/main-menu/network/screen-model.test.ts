import { describe, expect, it } from 'vitest';
import { escapeLeavesRoom, worldTitle } from '../../../../src/entries/main-menu/network/model.js';

describe('escapeLeavesRoom', () => {
  it('lets Esc clear a chat line still being written and leaves the room from anywhere else', () => {
    const field = (tagName: string, value: string) => ({ tagName, value }) as unknown as EventTarget;
    expect(escapeLeavesRoom(field('INPUT', 'hej'))).toBe(false);
    expect(escapeLeavesRoom(field('INPUT', ''))).toBe(true);
    expect(escapeLeavesRoom(field('SELECT', 'computer'))).toBe(true);
    expect(escapeLeavesRoom({ tagName: 'SECTION' } as unknown as EventTarget)).toBe(true);
    expect(escapeLeavesRoom(null)).toBe(true);
  });
});

describe('worldTitle', () => {
  const mapNames = new Map([['arabian', { pol: 'ARABSKIE WYSPY', eng: 'ARABIAN ISLANDS' }]]);

  it("names the room's map or scene in the player's language", () => {
    expect(worldTitle({ kind: 'map', mapId: 'arabian' }, mapNames, 'eng')).toBe('ARABIAN ISLANDS');
    expect(worldTitle({ kind: 'map', mapId: 'arabian' }, mapNames, 'pol')).toBe('ARABSKIE WYSPY');
    expect(worldTitle({ kind: 'scene', sceneId: 'sandbox' }, mapNames, 'eng')).toBe('Open sandbox');
  });

  it('adds the variant’s localized label for a room that plays one', () => {
    const ragnarok = { kind: 'map', mapId: 'arabian', variant: 'ragnarok' } as const;
    expect(worldTitle(ragnarok, mapNames, 'eng')).toBe('ARABIAN ISLANDS · Ragnarök');
    expect(worldTitle({ ...ragnarok, mapId: 'unlisted' }, mapNames, 'rus')).toBe('unlisted · Рагнарёк');
    expect(worldTitle({ ...ragnarok, variant: 'unknown' }, mapNames, 'pol')).toBe('ARABSKIE WYSPY · unknown');
  });

  it('falls back to the id before the map listing answers or for an unknown world', () => {
    expect(worldTitle({ kind: 'map', mapId: 'unlisted' }, new Map(), 'eng')).toBe('unlisted');
    expect(worldTitle({ kind: 'scene', sceneId: 'no-such-scene' }, mapNames, 'eng')).toBe('no-such-scene');
  });
});
