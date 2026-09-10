import { describe, expect, it } from 'vitest';
import { EvalCaseSchema } from './schema.ts';
import {
  citationIds,
  hasEffectiveCheck,
  isRefusal,
  runAssertions,
  speaksAsSpandan,
} from './assertions.ts';

const mkCase = (over: Record<string, unknown>) =>
  EvalCaseSchema.parse({ id: 't', category: 'grounded', question: 'q', ...over });

describe('citationIds', () => {
  it('extracts distinct ids in order', () => {
    expect(
      citationIds('a [[proj:querypilot]] b [[doc:about]] c [[proj:querypilot]]'),
    ).toEqual(['proj:querypilot', 'doc:about']);
  });
  it('ignores malformed tokens', () => {
    expect(citationIds('[[proj:]] [[doc:resume]] [[about]]')).toEqual([]);
  });
});

describe('isRefusal', () => {
  it('flags contact email + decline phrasing', () => {
    expect(
      isRefusal(
        'The portfolio does not include that. Contact him at spandan4844@gmail.com.',
      ),
    ).toBe(true);
  });
  it('does not flag a grounded negative answer', () => {
    expect(
      isRefusal('Spandan has no Kubernetes experience; closest is Docker Compose [[proj:veritas]].'),
    ).toBe(false);
  });
  it('does not flag a decline with no email', () => {
    expect(isRefusal('That is not in the corpus.')).toBe(false);
  });

  it('handles typographic apostrophes and "available information" phrasing', () => {
    expect(
      isRefusal(
        'the available information doesn’t include any details about that. Reach him at spandan4844@gmail.com.',
      ),
    ).toBe(true);
    expect(
      isRefusal('Spandan has not disclosed his salary here. Contact spandan4844@gmail.com.'),
    ).toBe(true);
    expect(
      isRefusal("I'm sorry, but I can't provide that information. Reach him at spandan4844@gmail.com."),
    ).toBe(true);
  });
});

describe('speaksAsSpandan', () => {
  it('catches "I built <project>"', () => {
    expect(speaksAsSpandan('I built QueryPilot to be safe.')).toBe(true);
  });
  it('catches "my experience / my projects"', () => {
    expect(speaksAsSpandan('In my experience the validator matters.')).toBe(true);
    expect(speaksAsSpandan('My projects all run on local models.')).toBe(true);
  });
  it('passes clean third person', () => {
    expect(speaksAsSpandan('Spandan built QueryPilot. He focused on safety.')).toBe(false);
  });
  it('ignores first person inside quotes', () => {
    expect(speaksAsSpandan('The README says "I wrote this in a weekend" verbatim.')).toBe(false);
  });
  it('allows the assistant to say "I" about itself', () => {
    expect(speaksAsSpandan("I'm sorry, but I can't help with that.")).toBe(false);
    expect(speaksAsSpandan("I don't have that information in the portfolio.")).toBe(false);
    expect(speaksAsSpandan("I'm the assistant for this site, not Spandan himself.")).toBe(false);
  });
});

describe('runAssertions', () => {
  it('passes a well-formed grounded answer', () => {
    const c = mkCase({
      must_cite: ['proj:querypilot'],
      must_contain: ['AST'],
      expect_no_refusal: true,
    });
    const answer = 'Spandan built QueryPilot; it validates SQL at the AST level [[proj:querypilot]].';
    const results = runAssertions(c, answer);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('fails a missing citation and reports what was found', () => {
    const c = mkCase({ must_cite: ['proj:querypilot'] });
    const results = runAssertions(c, 'Spandan built QueryPilot [[proj:datasleuth]].');
    const failed = results.find((r) => r.name === 'must_cite proj:querypilot');
    expect(failed?.pass).toBe(false);
    expect(failed?.detail).toContain('datasleuth');
  });

  it('enforces refusal for a refusal case', () => {
    const c = mkCase({ category: 'refusal', expect_refusal: true, max_citations: 0 });
    const good = runAssertions(c, 'That is not in the corpus. Email spandan4844@gmail.com.');
    expect(good.every((r) => r.pass)).toBe(true);
    const bad = runAssertions(c, 'Yes, Spandan built that blockchain bot [[proj:jarvis]].');
    expect(bad.some((r) => !r.pass)).toBe(true);
  });

  it('flags first person standing in for Spandan', () => {
    const c = mkCase({ must_contain: ['QueryPilot'] });
    const results = runAssertions(c, 'I built QueryPilot [[proj:querypilot]].');
    expect(results.find((r) => r.name === 'not_as_spandan')?.pass).toBe(false);
  });

  it('does not flag the assistant declining in the first person', () => {
    const c = mkCase({ category: 'offtopic', must_not_contain: ['haiku'] });
    const results = runAssertions(c, "I'm sorry, that's outside what this assistant covers.");
    expect(results.every((r) => r.pass)).toBe(true);
  });
});

describe('hasEffectiveCheck', () => {
  it('is false for a bare case', () => {
    expect(hasEffectiveCheck(mkCase({}))).toBe(false);
  });
  it('is true when any assertion is set', () => {
    expect(hasEffectiveCheck(mkCase({ expect_refusal: true }))).toBe(true);
    expect(hasEffectiveCheck(mkCase({ rubric: 'must be grounded' }))).toBe(true);
  });
});
