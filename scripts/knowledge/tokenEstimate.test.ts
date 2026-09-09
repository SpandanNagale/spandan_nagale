import { describe, expect, it } from 'vitest';
import { estimateTokens, exceedsContextBudget } from './tokenEstimate';

describe('estimateTokens', () => {
  it('estimates roughly 4 characters per token', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1);
  });

  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('exceedsContextBudget', () => {
  it('is false comfortably under the 60% budget', () => {
    expect(exceedsContextBudget(1000, 10000)).toBe(false);
  });

  it('is true just over the 60% budget', () => {
    expect(exceedsContextBudget(6001, 10000)).toBe(true);
  });

  it('is false exactly at the 60% budget', () => {
    expect(exceedsContextBudget(6000, 10000)).toBe(false);
  });
});
