import { describe, expect, it } from 'vitest';
import {
  parseCitations,
  stripCitationTokens,
  stripUncitedClaims,
} from './citations';

describe('parseCitations', () => {
  it('pulls distinct ids in first-seen order', () => {
    const text =
      'Spandan built QueryPilot [[proj:querypilot]] and DataSleuth [[proj:datasleuth]]. ' +
      'QueryPilot [[proj:querypilot]] again, and his bio [[doc:about]].';
    expect(parseCitations(text)).toEqual([
      'proj:querypilot',
      'proj:datasleuth',
      'doc:about',
    ]);
  });

  it('ignores malformed tokens', () => {
    expect(parseCitations('[[proj:]] [[about]] [[doc:resume]] [[ proj:x ]]')).toEqual([]);
  });

  it('returns [] when there are no tokens', () => {
    expect(parseCitations('No citations here.')).toEqual([]);
  });
});

describe('stripCitationTokens', () => {
  it('removes tokens and tidies the space before punctuation', () => {
    expect(
      stripCitationTokens('Spandan shipped Veritas [[proj:veritas]]. It runs locally [[proj:veritas]].'),
    ).toBe('Spandan shipped Veritas. It runs locally.');
  });

  it('collapses doubled spaces left mid-sentence', () => {
    expect(stripCitationTokens('He used [[proj:keel]] Streamlit for the UI.')).toBe(
      'He used Streamlit for the UI.',
    );
  });
});

describe('stripUncitedClaims', () => {
  it('keeps sentences that carry a citation', () => {
    const answer =
      'Spandan built QueryPilot, a text-to-SQL agent [[proj:querypilot]]. ' +
      'It gates every destructive query behind a human approval step [[proj:querypilot]].';
    const { text, removed } = stripUncitedClaims(answer);
    expect(removed).toEqual([]);
    expect(text).toBe(answer);
  });

  it('removes a claim about Spandan that has no citation', () => {
    const answer =
      'Spandan built QueryPilot [[proj:querypilot]]. He also led a 20-person team at Google.';
    const { text, removed } = stripUncitedClaims(answer);
    expect(removed).toEqual(['He also led a 20-person team at Google.']);
    expect(text).toBe('Spandan built QueryPilot [[proj:querypilot]].');
  });

  it('keeps the refusal / "not in the corpus" path even with no citation', () => {
    const answer =
      'The portfolio does not include a payments system. ' +
      'You can contact Spandan directly at spandan4844@gmail.com.';
    const { text, removed } = stripUncitedClaims(answer);
    expect(removed).toEqual([]);
    expect(text).toBe(answer);
  });

  it('keeps a stated skill gap phrased as an absence', () => {
    const answer =
      'Spandan has no production Kubernetes experience. ' +
      'The closest is Docker Compose with GPU passthrough in Veritas [[proj:veritas]].';
    const { removed } = stripUncitedClaims(answer);
    expect(removed).toEqual([]);
  });

  it('keeps connective / meta sentences with no subject reference', () => {
    const answer =
      'Here is a short summary. Spandan focuses on agentic systems [[doc:about]]. That is the gist.';
    const { text } = stripUncitedClaims(answer);
    expect(text).toContain('Here is a short summary.');
    expect(text).toContain('That is the gist.');
  });

  it('keeps a question even when it names him', () => {
    const answer = 'What has Spandan shipped recently? He shipped eight systems [[doc:about]].';
    const { removed } = stripUncitedClaims(answer);
    expect(removed).toEqual([]);
  });

  it('strips multiple un-cited claims and keeps the rest intact', () => {
    const answer =
      'Spandan built DataSleuth [[proj:datasleuth]]. He also invented a new database. ' +
      'His system verifies its own findings [[proj:datasleuth]]. He won a Turing Award.';
    const { text, removed } = stripUncitedClaims(answer);
    expect(removed).toEqual(['He also invented a new database.', 'He won a Turing Award.']);
    expect(text).toBe(
      'Spandan built DataSleuth [[proj:datasleuth]]. His system verifies its own findings [[proj:datasleuth]].',
    );
  });
});
