// Request-shape and abuse guards, all synchronous and pure so they're
// unit-testable without the edge runtime. Persona/"ignore your rules" attempts
// are deliberately NOT stripped here — the system prompt handles them, and the
// spec is explicit that there are no prompt-secrecy defenses.

export const MAX_BODY_BYTES = 2048;
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_SESSION_TURNS = 15;
export const CONTACT_EMAIL = 'spandan4844@gmail.com';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface ChatRequest {
  messages: ChatMessage[];
  session_id: string;
}

export type ValidationResult =
  | { ok: true; data: ChatRequest }
  | { ok: false; status: number; message: string };

export function validateChatRequest(rawBody: string): ValidationResult {
  // Byte length, not string length — a multi-byte payload can exceed the cap
  // while `.length` looks fine.
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, message: 'Request body too large.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, status: 400, message: 'Body must be a JSON object.' };
  }

  const { messages, session_id } = parsed as Record<string, unknown>;

  if (typeof session_id !== 'string' || session_id.length === 0 || session_id.length > 128) {
    return { ok: false, status: 400, message: 'Missing or invalid session_id.' };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, status: 400, message: 'messages must be a non-empty array.' };
  }

  const clean: ChatMessage[] = [];
  for (const m of messages) {
    if (typeof m !== 'object' || m === null) {
      return { ok: false, status: 400, message: 'Each message must be an object.' };
    }
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, status: 400, message: 'Each message role must be "user" or "assistant".' };
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, status: 400, message: 'Each message needs non-empty string content.' };
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, status: 400, message: `Each message must be under ${MAX_MESSAGE_CHARS} characters.` };
    }
    clean.push({ role, content });
  }

  const userTurns = clean.filter((m) => m.role === 'user').length;
  if (userTurns > MAX_SESSION_TURNS) {
    return {
      ok: false,
      status: 429,
      message: `This conversation has hit its ${MAX_SESSION_TURNS}-message limit. Email ${CONTACT_EMAIL} to keep talking.`,
    };
  }

  return { ok: true, data: { messages: clean, session_id } };
}
