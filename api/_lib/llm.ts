// Provider-agnostic streaming chat. Ollama Cloud is no longer free, so the
// assistant tries every provider that has a key configured, in order, and
// falls through to the next one when a provider refuses the request (bad key,
// out of credit, rate-limited, prompt too large for its tier...).
//
// Order (override with LLM_PROVIDERS="groq,gemini,..."):
//   1. gemini      GEMINI_API_KEY      free tier, 1M context: fits the ~50K-token corpus easily
//   2. groq        GROQ_API_KEY        fast; free tier TPM limits may reject the full corpus
//   3. openrouter  OPENROUTER_API_KEY
//   4. ollama      OLLAMA_API_KEY      Ollama Cloud (now paid)
//
// Gemini, Groq and OpenRouter all speak the OpenAI chat-completions SSE
// protocol; Ollama Cloud streams its own NDJSON (see ollamaStream.ts).

import { openOllamaStream, parseNdjson, JD_MAX_OUTPUT_TOKENS } from './ollamaStream';

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'ollama';

export interface StreamUsage {
  tokensIn: number | null;
  tokensOut: number | null;
  cachedIn: number | null;
  totalMs: number | null;
}

/** Normalized stream event: a text delta, or the final usage report. */
export type LlmEvent = { type: 'delta'; text: string } | { type: 'done'; usage: StreamUsage };

export interface OpenedStream {
  provider: ProviderId;
  model: string;
  events: AsyncGenerator<LlmEvent>;
}

type ChatMessage = { role: string; content: string };

interface OpenAiCompatProvider {
  id: Exclude<ProviderId, 'ollama'>;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  url: string;
  extraBody?: Record<string, unknown>;
}

const OPENAI_COMPAT: Record<OpenAiCompatProvider['id'], OpenAiCompatProvider> = {
  gemini: {
    id: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-flash-latest',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    // Grounded Q&A over a fixed corpus: keep thinking as low as the model allows.
    extraBody: { reasoning_effort: 'low' },
  },
  groq: {
    id: 'groq',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-120b',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    extraBody: { reasoning_effort: 'low', include_reasoning: false },
  },
  openrouter: {
    id: 'openrouter',
    keyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'openai/gpt-oss-120b',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    extraBody: { reasoning: { effort: 'low', exclude: true } },
  },
};

const DEFAULT_ORDER: ProviderId[] = ['gemini', 'groq', 'openrouter', 'ollama'];

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function providerOrder(): ProviderId[] {
  const raw = env('LLM_PROVIDERS');
  if (!raw) return DEFAULT_ORDER;
  const known = new Set<string>(DEFAULT_ORDER);
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderId => known.has(s));
}

function keyFor(id: ProviderId): string | undefined {
  return id === 'ollama' ? env('OLLAMA_API_KEY') : env(OPENAI_COMPAT[id].keyEnv);
}

export function modelFor(id: ProviderId): string {
  if (id === 'ollama') return env('OLLAMA_MODEL') ?? 'gpt-oss:120b';
  const p = OPENAI_COMPAT[id];
  return env(p.modelEnv) ?? p.defaultModel;
}

/** Providers that have a key set, in try order. */
export function configuredProviders(): ProviderId[] {
  return providerOrder().filter((id) => keyFor(id));
}

/**
 * Open a streaming chat against the first configured provider that accepts
 * the request. Throws (with every provider's error) if none does.
 */
export async function openChatStream(
  messages: ChatMessage[],
  signal: AbortSignal,
  maxTokens: number,
): Promise<OpenedStream> {
  const providers = configuredProviders();
  if (providers.length === 0) {
    throw new Error(
      'No LLM API key set (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY or OLLAMA_API_KEY).',
    );
  }
  const capped = Math.min(maxTokens, JD_MAX_OUTPUT_TOKENS);
  const errors: string[] = [];

  for (const id of providers) {
    if (signal.aborted) break;
    const apiKey = keyFor(id)!;
    const model = modelFor(id);
    try {
      if (id === 'ollama') {
        const body = await openOllamaStream(messages, apiKey, signal, capped, model);
        return { provider: id, model, events: ollamaEvents(body) };
      }
      const body = await openOpenAiCompatStream(OPENAI_COMPAT[id], model, messages, apiKey, signal, capped);
      return { provider: id, model, events: openAiEvents(body) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[llm] ${id} (${model}) failed, trying next provider: ${msg}`);
      errors.push(`${id}: ${msg}`);
    }
  }
  throw new Error(`All LLM providers failed — ${errors.join(' | ')}`);
}

/** Non-streaming completion (used by the eval judge). Same fallback order. */
export async function completeChat(
  messages: ChatMessage[],
  maxTokens: number,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ provider: ProviderId; model: string; text: string }> {
  const opened = await openChatStream(messages, signal, maxTokens);
  let text = '';
  for await (const ev of opened.events) if (ev.type === 'delta') text += ev.text;
  return { provider: opened.provider, model: opened.model, text };
}

async function openOpenAiCompatStream(
  p: OpenAiCompatProvider,
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  signal: AbortSignal,
  maxTokens: number,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: maxTokens,
      ...p.extraBody,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.body;
}

interface OpenAiChunk {
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } | null;
  error?: { message?: string };
}

/** Parse an OpenAI-style SSE byte stream (`data: {...}` lines, `data: [DONE]`). */
export async function* parseOpenAiSse(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenAiChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = function* (line: string): Generator<OpenAiChunk> {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return; // comments (": keepalive"), event:, blanks
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    yield JSON.parse(data) as OpenAiChunk;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        yield* handle(line);
      }
    }
    if (buffer) yield* handle(buffer);
  } finally {
    reader.releaseLock();
  }
}

async function* openAiEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<LlmEvent> {
  const started = Date.now();
  let usage: StreamUsage = { tokensIn: null, tokensOut: null, cachedIn: null, totalMs: null };
  for await (const chunk of parseOpenAiSse(body)) {
    if (chunk.error) throw new Error(chunk.error.message ?? 'provider stream error');
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) yield { type: 'delta', text };
    if (chunk.usage) {
      usage = {
        tokensIn: chunk.usage.prompt_tokens ?? null,
        tokensOut: chunk.usage.completion_tokens ?? null,
        cachedIn: chunk.usage.prompt_tokens_details?.cached_tokens ?? null,
        totalMs: null,
      };
    }
  }
  yield { type: 'done', usage: { ...usage, totalMs: Date.now() - started } };
}

async function* ollamaEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<LlmEvent> {
  for await (const chunk of parseNdjson(body)) {
    const text = chunk.message?.content;
    if (text) yield { type: 'delta', text };
    if (chunk.done) {
      yield {
        type: 'done',
        usage: {
          tokensIn: chunk.prompt_eval_count ?? null,
          tokensOut: chunk.eval_count ?? null,
          cachedIn: chunk.prompt_eval_cached_count ?? null,
          totalMs: chunk.total_duration ? Math.round(chunk.total_duration / 1e6) : null,
        },
      };
      return;
    }
  }
}
