import { validateChatRequest, CONTACT_EMAIL } from './_lib/guards';
import {
  assembleMessages,
  CORPUS_VERSION,
  CORPUS_TOKEN_ESTIMATE,
} from './_lib/assembleMessages';
import { checkRateLimit } from './_lib/ratelimit';
import {
  openOllamaStream,
  parseNdjson,
  OLLAMA_MODEL,
  MAX_OUTPUT_TOKENS,
  JD_MAX_OUTPUT_TOKENS,
} from './_lib/ollamaStream';
import { sse, extractCitations } from './_lib/sse';
import { looksLikeRefusal, logRefusal } from './_lib/refusalLog';

export const config = { runtime: 'edge' };

const CONTEXT_WINDOW = Number(process.env.OLLAMA_CONTEXT_WINDOW ?? 128000);

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError('Method not allowed.', 405);

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) return jsonError('Server misconfigured: OLLAMA_API_KEY is not set.', 500);

  const rawBody = await req.text();
  const validation = validateChatRequest(rawBody);
  if (!validation.ok) return jsonError(validation.message, validation.status);
  const { messages, session_id, mode } = validation.data;

  const rl = await checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return jsonError(
      `Rate limit reached (${rl.reason}). Email ${CONTACT_EMAIL} to keep the conversation going.`,
      429,
    );
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const requestStart = Date.now();
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      let answer = '';
      let ttftMs = 0;
      const emitted = new Set<string>();

      try {
        const body = await openOllamaStream(
          assembleMessages(messages, mode),
          apiKey,
          abort.signal,
          mode === 'jd' ? JD_MAX_OUTPUT_TOKENS : MAX_OUTPUT_TOKENS,
        );

        for await (const chunk of parseNdjson(body)) {
          const delta = chunk.message?.content ?? '';
          if (delta) {
            if (ttftMs === 0) {
              ttftMs = Date.now() - requestStart;
              send('telemetry', {
                model: OLLAMA_MODEL,
                ttft_ms: ttftMs,
                corpus_tokens: CORPUS_TOKEN_ESTIMATE,
                corpus_version: CORPUS_VERSION,
                context_window: CONTEXT_WINDOW,
              });
            }
            answer += delta;
            send('token', { text: delta });
            for (const id of extractCitations(answer)) {
              if (!emitted.has(id)) {
                emitted.add(id);
                send('citation', { id });
              }
            }
          }

          if (chunk.done) {
            const tokensIn = chunk.prompt_eval_count ?? null;
            const tokensOut = chunk.eval_count ?? null;
            const cachedIn = chunk.prompt_eval_cached_count ?? null;
            send('telemetry', {
              model: OLLAMA_MODEL,
              ttft_ms: ttftMs,
              tokens_in: tokensIn,
              tokens_out: tokensOut,
              cached_tokens_in: cachedIn,
              cache: cachedIn == null ? 'unknown' : cachedIn > 0 ? 'hit' : 'miss',
              corpus_tokens: CORPUS_TOKEN_ESTIMATE,
              corpus_version: CORPUS_VERSION,
              context_window: CONTEXT_WINDOW,
              context_utilization:
                tokensIn != null && tokensOut != null
                  ? Math.round(((tokensIn + tokensOut) / CONTEXT_WINDOW) * 100)
                  : null,
              total_ms: chunk.total_duration ? Math.round(chunk.total_duration / 1e6) : null,
            });
          }
        }

        send('done', { citations: [...emitted] });
        if (looksLikeRefusal(answer)) await logRefusal(lastUserMessage, session_id);
      } catch (err) {
        send('error', {
          message: err instanceof Error ? err.message : 'The model backend failed.',
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
