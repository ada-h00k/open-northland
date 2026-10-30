import type { SimEvent } from '@open-northland/sim';
import { describe, expect, it } from 'vitest';
import { NOTICE_SHOWN_MS, NoticeQueue, siegeNoticesOf } from '../../../src/view/escalation/notices.js';

describe('siegeNoticesOf', () => {
  it('announces each attack launch under the variant’s key, every landing and gear step, and reports an unknown key', () => {
    const unknown: string[] = [];
    const events: SimEvent[] = [
      { kind: 'mapEscalationAttackLaunched', wave: 1, seats: [0] },
      { kind: 'mapEscalationAttackLaunched', wave: 2, seats: [0] },
      { kind: 'mapEscalationLanding', wave: 3, seats: [0], noticeKey: 'forteca.landing' },
      { kind: 'mapEscalationGearStep', step: 1, noticeKey: 'forteca.gear.lightArmor' },
      { kind: 'mapEscalationGearStep', step: 2, noticeKey: 'other.key' },
    ];
    expect(siegeNoticesOf(events, 'forteca.attack', (key) => unknown.push(key))).toEqual([
      'fortecaAttack',
      'fortecaAttack',
      'fortecaLanding',
      'fortecaLightArmor',
    ]);
    expect(unknown).toEqual(['other.key']);
    expect(siegeNoticesOf(events.slice(0, 1), undefined, () => {})).toEqual([]);
  });
});

describe('NoticeQueue', () => {
  it('shows one notice at a time for its span, then the next, dropping a repeat that still waits', () => {
    const queue = new NoticeQueue<string>();
    expect(queue.current(0)).toBeNull();
    queue.push('a');
    queue.push('b');
    queue.push('b');
    expect(queue.current(10)?.notice).toBe('a');
    expect(queue.current(10 + NOTICE_SHOWN_MS - 1)?.notice).toBe('a');
    expect(queue.current(10 + NOTICE_SHOWN_MS)?.notice).toBe('b');
    expect(queue.current(10 + 2 * NOTICE_SHOWN_MS)).toBeNull();
  });
});
