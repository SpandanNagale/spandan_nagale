import { afterEach, describe, expect, it } from 'vitest';
import { estimateTokens, exceedsContextBudget, getModelContextWindowTokens } from './tokenEstimate';

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

describe('getModelContextWindowTokens', () => {
  const ORIGINAL_ENV = process.env.KNOWLEDGE_CONTEXT_WINDOW;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.KNOWLEDGE_CONTEXT_WINDOW;
    else process.env.KNOWLEDGE_CONTEXT_WINDOW = ORIGINAL_ENV;
  });

  it('defaults to 128000 when the env var is unset', () => {
    delete process.env.KNOWLEDGE_CONTEXT_WINDOW;
    expect(getModelContextWindowTokens()).toBe(128000);
  });

  it('reads the env var when set, reflecting changes made after module load', () => {
    process.env.KNOWLEDGE_CONTEXT_WINDOW = '999';
    expect(getModelContextWindowTokens()).toBe(999);
  });
});
