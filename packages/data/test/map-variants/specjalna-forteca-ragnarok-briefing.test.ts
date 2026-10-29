import { describe, expect, it } from 'vitest';
import { findMapVariant, LANGUAGES } from '../../src/index.js';

const OPENING_PAGE = '0';
const VICTORY_PAGE = '1';

describe('the Ragnarök briefing on specjalna_forteca', () => {
  const pages = findMapVariant('specjalna_forteca', 'ragnarok')?.briefingPages;

  it('writes both pages in every language, naming no time or band size the escalation data may tune', () => {
    if (pages === undefined) throw new Error('Ragnarök tells no briefing');
    for (const lang of LANGUAGES) {
      expect(pages[VICTORY_PAGE]?.[lang], `${lang} victory page`).toBeDefined();
      const blocks = pages[OPENING_PAGE]?.[lang] ?? [];
      const text = blocks.map((block) => (block.kind === 'text' ? block.text : '')).join('\n');
      expect(text, `${lang} opening page`).not.toBe('');
      expect(text, `${lang} names a number`).not.toMatch(/\d/u);
    }
  });
});
