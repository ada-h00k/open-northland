import { describe, expect, it } from 'vitest';
import { findMapVariant, LANGUAGES } from '../../src/index.js';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const CLOCK_MINUTE_DIGITS = 2;

/** Game time as the briefing writes it, `h:mm`. */
function clock(seconds: number): string {
  const minutes = seconds / SECONDS_PER_MINUTE;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${hours}:${String(minutes % MINUTES_PER_HOUR).padStart(CLOCK_MINUTE_DIGITS, '0')}`;
}

describe('the Ragnarök briefing on specjalna_forteca', () => {
  const variant = findMapVariant('specjalna_forteca', 'ragnarok');
  const escalation = variant?.escalation;
  const append = variant?.briefingAppend;

  it('tells, in every language, the times and band sizes the escalation runs', () => {
    if (escalation === undefined || append === undefined) throw new Error('Ragnarök tells no briefing');
    const { launches } = escalation.attacks;
    const firstLanding = launches.find((row) => row.seaMen > 0);
    if (firstLanding === undefined) throw new Error('no landing wave');
    const told = [
      clock(launches[0]?.atSeconds ?? -1),
      ...new Set(launches.map((row) => String(row.landMen))),
      clock(firstLanding.atSeconds),
      String(firstLanding.seaMen),
      ...(escalation.gear?.steps ?? []).map((step) => clock(step.atSeconds)),
    ];
    for (const lang of LANGUAGES) {
      const blocks = append.texts[lang] ?? [];
      const text = blocks.map((block) => (block.kind === 'text' ? block.text : '')).join('\n');
      for (const fact of told) expect(text, `${lang} tells ${fact}`).toContain(fact);
    }
  });
});
