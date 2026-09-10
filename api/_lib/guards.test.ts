import { describe, expect, it } from 'vitest';
import { validateChatRequest, MAX_MESSAGE_CHARS, MAX_SESSION_TURNS } from './guards';

const okBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    session_id: 'sess-123',
    messages: [{ role: 'user', content: 'What is his strongest agentic project?' }],
    ...over,
  });

describe('validateChatRequest', () => {
  it('accepts a well-formed request', () => {
    const r = validateChatRequest(okBody());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.session_id).toBe('sess-123');
      expect(r.data.messages).toHaveLength(1);
    }
  });

  it('rejects a body over 2 KB with 413', () => {
    const big = JSON.stringify({
      session_id: 's',
      messages: [{ role: 'user', content: 'x'.repeat(3000) }],
    });
    const r = validateChatRequest(big);
    expect(r).toMatchObject({ ok: false, status: 413 });
  });

  it('rejects invalid JSON with 400', () => {
    expect(validateChatRequest('{not json')).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a missing session_id', () => {
    expect(validateChatRequest(okBody({ session_id: undefined }))).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('rejects an empty messages array', () => {
    expect(validateChatRequest(okBody({ messages: [] }))).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a message over the character cap', () => {
    const r = validateChatRequest(
      okBody({ messages: [{ role: 'user', content: 'a'.repeat(MAX_MESSAGE_CHARS + 1) }] }),
    );
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects an unknown role', () => {
    expect(
      validateChatRequest(okBody({ messages: [{ role: 'system', content: 'hi' }] })),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects blank / whitespace-only content', () => {
    expect(
      validateChatRequest(okBody({ messages: [{ role: 'user', content: '   ' }] })),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects more than the session turn cap of user messages with 429 and the contact email', () => {
    const messages = Array.from({ length: MAX_SESSION_TURNS + 1 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));
    // ensure > MAX_SESSION_TURNS user turns
    const userHeavy = Array.from({ length: MAX_SESSION_TURNS + 1 }, () => ({
      role: 'user' as const,
      content: 'q',
    }));
    const r = validateChatRequest(okBody({ messages: userHeavy }));
    expect(r).toMatchObject({ ok: false, status: 429 });
    if (!r.ok) expect(r.message).toContain('spandan4844@gmail.com');
    // sanity: a mixed list at the boundary is fine
    expect(validateChatRequest(okBody({ messages }))).toMatchObject({ ok: true });
  });
});
