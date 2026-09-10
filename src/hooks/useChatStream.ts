import { useCallback, useRef, useState } from 'react';
import { readSse } from '../lib/sseClient';

export interface Telemetry {
  model?: string;
  ttft_ms?: number;
  tokens_in?: number | null;
  tokens_out?: number | null;
  cached_tokens_in?: number | null;
  cache?: 'hit' | 'miss' | 'unknown';
  corpus_tokens?: number;
  corpus_version?: string;
  context_window?: number;
  context_utilization?: number | null;
  total_ms?: number | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  /** Raw model text, citation tokens intact. Rendering applies the filter. */
  content: string;
  /** Set on assistant turns once the stream closes. */
  citations?: string[];
  /** True if the stream errored partway. */
  errored?: boolean;
}

export type ChatStatus = 'idle' | 'streaming' | 'error';

const ENDPOINT = '/api/chat';
const SID_KEY = 'spandan-chat-sid';

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

interface OneShotResult {
  text: string;
  telemetry: Telemetry | null;
  errored: boolean;
}

/**
 * Consume one /api/chat SSE response. Returns the concatenated assistant text
 * plus the final telemetry frame. `onToken` streams partial text to the UI.
 */
async function consume(
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal,
  onToken?: (full: string) => void,
  onTelemetry?: (t: Telemetry) => void,
  mode: 'chat' | 'jd' = 'chat',
): Promise<OneShotResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, session_id: sessionId(), mode }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(detail);
  }

  let text = '';
  let telemetry: Telemetry | null = null;
  let errored = false;

  for await (const { event, data } of readSse(res.body)) {
    if (event === 'token' && data && typeof data === 'object' && 'text' in data) {
      text += String((data as { text: unknown }).text ?? '');
      onToken?.(text);
    } else if (event === 'telemetry' && data && typeof data === 'object') {
      telemetry = { ...(telemetry ?? {}), ...(data as Telemetry) };
      onTelemetry?.(telemetry);
    } else if (event === 'error') {
      errored = true;
      const msg =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : 'The model backend failed.';
      if (!text) throw new Error(msg);
      text += `\n\n_(interrupted: ${msg})_`;
    } else if (event === 'done') {
      break;
    }
  }

  return { text, telemetry, errored };
}

export function useChatStream() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef('');

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (input: string) => {
      const question = input.trim();
      if (!question || status === 'streaming') return;

      const history = [...turns, { role: 'user' as const, content: question }];
      setTurns(history);
      draftRef.current = '';
      setDraft('');
      setError(null);
      setStatus('streaming');

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const { text, telemetry: tel, errored } = await consume(
          history.map((t) => ({ role: t.role, content: t.content })),
          ac.signal,
          (full) => {
            draftRef.current = full;
            setDraft(full);
          },
          setTelemetry,
        );
        setTurns([...history, { role: 'assistant', content: text, errored }]);
        if (tel) setTelemetry(tel);
        setStatus(errored ? 'error' : 'idle');
      } catch (err) {
        if (ac.signal.aborted) {
          // User pressed stop: keep whatever streamed as a settled turn.
          const partial = draftRef.current;
          if (partial) {
            setTurns([...history, { role: 'assistant', content: partial, errored: true }]);
          }
          setStatus('idle');
          return;
        }
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setStatus('error');
      } finally {
        draftRef.current = '';
        setDraft('');
        abortRef.current = null;
      }
    },
    [status, turns],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setDraft('');
    setError(null);
    setStatus('idle');
  }, []);

  return { turns, draft, telemetry, status, error, send, stop, reset };
}

/** One-off call that does not touch the chat transcript — used by the JD matcher. */
export async function runOneShot(
  userContent: string,
  signal: AbortSignal,
  onToken?: (full: string) => void,
  mode: 'chat' | 'jd' = 'chat',
): Promise<OneShotResult> {
  return consume([{ role: 'user', content: userContent }], signal, onToken, undefined, mode);
}
