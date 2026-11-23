import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseOpenAiSse, openChatStream, configuredProviders, type LlmEvent } from './llm';

function streamOf(...byteChunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of byteChunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

const KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'OLLAMA_API_KEY', 'LLM_PROVIDERS'];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function clearKeys() {
  for (const k of KEYS) vi.stubEnv(k, '');
}

describe('parseOpenAiSse', () => {
  it('parses data lines split across chunks and ignores [DONE] and comments', async () => {
    const out = [];
    for await (const c of parseOpenAiSse(
      streamOf(
        ': keepalive\n\ndata: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choi',
        'ces":[{"delta":{"content":"lo"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\ndata: [DONE]\n\n',
      ),
    ))
      out.push(c);
    expect(out.map((c) => c.choices?.[0]?.delta?.content ?? '').join('')).toBe('Hello');
    expect(out.at(-1)?.usage?.prompt_tokens).toBe(5);
  });
});

describe('openChatStream', () => {
  it('reports only providers with a key', () => {
    clearKeys();
    vi.stubEnv('GROQ_API_KEY', 'g');
    vi.stubEnv('OLLAMA_API_KEY', 'o');
    expect(configuredProviders()).toEqual(['groq', 'ollama']);
  });

  it('falls through to the next provider when one refuses', async () => {
    clearKeys();
    vi.stubEnv('GEMINI_API_KEY', 'bad');
    vi.stubEnv('GROQ_API_KEY', 'good');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          streamOf(
            'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
            'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":1}}\n\ndata: [DONE]\n\n',
          ),
          { status: 200 },
        ),
      );

    const opened = await openChatStream([{ role: 'user', content: 'q' }], new AbortController().signal, 100);
    expect(opened.provider).toBe('groq');
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.groq.com');

    const events: LlmEvent[] = [];
    for await (const ev of opened.events) events.push(ev);
    expect(events[0]).toEqual({ type: 'delta', text: 'hi' });
    expect(events.at(-1)).toMatchObject({ type: 'done', usage: { tokensIn: 10, tokensOut: 1 } });
  });

  it('throws when every provider fails', async () => {
    clearKeys();
    vi.stubEnv('OLLAMA_API_KEY', 'x');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('payment required', { status: 402 }));
    await expect(
      openChatStream([{ role: 'user', content: 'q' }], new AbortController().signal, 100),
    ).rejects.toThrow(/All LLM providers failed/);
  });
});
