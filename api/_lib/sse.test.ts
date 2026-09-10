import { describe, expect, it } from 'vitest';
import { sse, extractCitations } from './sse';

describe('sse', () => {
  it('frames an event with JSON data and a blank-line terminator', () => {
    expect(sse('token', { text: 'hi' })).toBe('event: token\ndata: {"text":"hi"}\n\n');
  });
});

describe('extractCitations', () => {
  it('pulls project and about citation ids', () => {
    expect(
      extractCitations('Spandan built QueryPilot [[proj:querypilot]] and wrote his bio [[doc:about]].'),
    ).toEqual(['proj:querypilot', 'doc:about']);
  });

  it('dedupes repeated ids, keeping first-seen order', () => {
    expect(
      extractCitations('[[proj:datasleuth]] ... more ... [[proj:querypilot]] ... [[proj:datasleuth]]'),
    ).toEqual(['proj:datasleuth', 'proj:querypilot']);
  });

  it('ignores malformed tokens', () => {
    expect(extractCitations('[[proj:Bad_Slug]] [[project:x]] [[doc:resume]] [[]]')).toEqual([]);
  });

  it('accepts single-bracket and fullwidth 【】 forms the model sometimes emits', () => {
    expect(extractCitations('education 【doc:about】 and [proj:keel] shipped')).toEqual([
      'doc:about',
      'proj:keel',
    ]);
  });

  it('returns nothing for citation-free text', () => {
    expect(extractCitations('No production Kubernetes experience.')).toEqual([]);
  });
});
