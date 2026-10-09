import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, resetRateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './ratelimit';

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimit());

  it(`allows ${RATE_LIMIT_MAX} requests per window, then blocks`, () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit('1.2.3.4', 1000).allowed).toBe(true);
    }
    expect(checkRateLimit('1.2.3.4', 1000)).toMatchObject({ allowed: false });
  });

  it('tracks each IP separately', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit('a', 0);
    expect(checkRateLimit('a', 0).allowed).toBe(false);
    expect(checkRateLimit('b', 0).allowed).toBe(true);
  });

  it('resets once the window passes', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit('a', 0);
    expect(checkRateLimit('a', RATE_LIMIT_WINDOW_MS - 1).allowed).toBe(false);
    expect(checkRateLimit('a', RATE_LIMIT_WINDOW_MS).allowed).toBe(true);
  });
});
