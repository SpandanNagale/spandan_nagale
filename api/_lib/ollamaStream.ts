// Talks to Ollama Cloud's native chat API (https://ollama.com/api/chat).
// It is NOT OpenAI-compatible and NOT SSE — it streams newline-delimited JSON,
// one object per token-ish chunk, then a final object with done:true and
// timing/token counts.

const OLLAMA_URL = 'https://ollama.com/api/chat';

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gpt-oss:120b';
export const MAX_OUTPUT_TOKENS = 700;

export interface OllamaChunk {
  // `thinking` (reasoning models like gpt-oss) is deliberately not consumed —
  // only `content` reaches the client.
  message?: { role?: string; content?: string; thinking?: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  /** How many prompt tokens Ollama Cloud served from its prefix cache. */
  prompt_eval_cached_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

export async function openOllamaStream(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
      // Grounded factual Q&A — no chain-of-thought wanted. Reasoning models
      // (gpt-oss) may still emit some `thinking`; it's dropped downstream.
      think: false,
      options: { num_predict: MAX_OUTPUT_TOKENS },
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama Cloud responded ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.body;
}

/** Parse an NDJSON byte stream into chunk objects. Tolerates chunk boundaries
 * splitting a line and a missing trailing newline. */
export async function* parseNdjson(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<OllamaChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield JSON.parse(line) as OllamaChunk;
      }
    }
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as OllamaChunk;
  } finally {
    reader.releaseLock();
  }
}
