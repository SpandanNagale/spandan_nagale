import { describe, expect, it } from 'vitest';
import {
  assembleMessages,
  SYSTEM_MESSAGE,
  CORPUS_VERSION,
  CORPUS_TOKEN_ESTIMATE,
} from './assembleMessages';
import { SYSTEM_PROMPT_PREFIX } from './systemPrompt';

describe('SYSTEM_MESSAGE', () => {
  it('leads with the static prompt prefix (so a provider prefix-cache can hit it)', () => {
    expect(SYSTEM_MESSAGE.startsWith(SYSTEM_PROMPT_PREFIX)).toBe(true);
  });

  it('embeds the real corpus after the prefix', () => {
    const body = SYSTEM_MESSAGE.slice(SYSTEM_PROMPT_PREFIX.length);
    expect(body).toContain('[doc:about]');
    expect(body).toContain('[proj:querypilot]');
    expect(body.length).toBeGreaterThan(10_000);
  });

  it('exposes the corpus version and token estimate from knowledge.json', () => {
    expect(CORPUS_VERSION).toMatch(/^[0-9a-f]{12}$/);
    expect(CORPUS_TOKEN_ESTIMATE).toBeGreaterThan(0);
  });
});

describe('assembleMessages', () => {
  it('prepends a single system message and preserves user turns in order', () => {
    const out = assembleMessages([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ]);
    expect(out[0].role).toBe('system');
    expect(out[0].content).toBe(SYSTEM_MESSAGE);
    expect(out.slice(1)).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ]);
  });
});
