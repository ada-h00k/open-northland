import type { SimEvent } from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import { NOTICE_SHOWN_MS, NoticeQueue, siegeNoticesOf } from '../../../src/view/escalation/notices.js';

describe('siegeNoticesOf', () => {
  it('announces every attack launch, every landing and each gear step, and reports an unknown key', () => {
    const unknown: string[] = [];
    const events: SimEvent[] = [
      { kind: 'mapEscalationAttackLaunched', wave: 1, seats: [0] },
      { kind: 'mapEscalationAttackLaunched', wave: 2, seats: [0] },
      { kind: 'mapEscalationLanding', wave: 3, seats: [0], noticeKey: 'ragnarok.landing' },
      { kind: 'mapEscalationGearStep', step: 1, noticeKey: 'ragnarok.gear.lightArmor' },
      { kind: 'mapEscalationGearStep', step: 2, noticeKey: 'other.key' },
    ];
    expect(siegeNoticesOf(events, (key) => unknown.push(key))).toEqual([
      'attack',
      'attack',
      'landing',
      'lightArmor',
    ]);
    expect(unknown).toEqual(['other.key']);
  });
});

describe('NoticeQueue', () => {
  it('shows one notice at a time for its span, then the next, dropping a repeat that still waits', () => {
    const queue = new NoticeQueue<string>();
    expect(queue.current(0)).toBeNull();
    queue.push('a');
    queue.push('b');
    queue.push('b');
    expect(queue.current(10)).toBe('a');
    expect(queue.current(10 + NOTICE_SHOWN_MS - 1)).toBe('a');
    expect(queue.current(10 + NOTICE_SHOWN_MS)).toBe('b');
    expect(queue.current(10 + 2 * NOTICE_SHOWN_MS)).toBeNull();
  });
});
