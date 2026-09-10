// Talks to a running /api/chat exactly like the browser does — so the eval
// exercises the real system prompt, guards, mode routing and SSE framing,
// not a reimplementation of them.

export interface AskResult {
  answer: string;
  telemetry: Record<string, unknown> | null;
  errored: boolean;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export async function ask(
  baseUrl: string,
  turns: Turn[],
  mode: 'chat' | 'jd' = 'chat',
  timeoutMs = 90_000,
): Promise<AskResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: `eval-${Date.now()}-${Math.random().toString(36).slice(2)}`, mode, messages: turns }),
      signal: ac.signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      return { answer: `HTTP ${res.status}: ${body.slice(0, 200)}`, telemetry: null, errored: true };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let answer = '';
    let telemetry: Record<string, unknown> | null = null;
    let errored = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (data.length === 0) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(data.join('\n'));
        } catch {
          continue;
        }
        if (event === 'token' && parsed && typeof parsed === 'object' && 'text' in parsed) {
          answer += String((parsed as { text: unknown }).text ?? '');
        } else if (event === 'telemetry' && parsed && typeof parsed === 'object') {
          telemetry = { ...(telemetry ?? {}), ...(parsed as Record<string, unknown>) };
        } else if (event === 'error') {
          errored = true;
        }
      }
    }
    return { answer, telemetry, errored };
  } finally {
    clearTimeout(timer);
  }
}
