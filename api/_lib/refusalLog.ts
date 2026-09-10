import { redis } from './ratelimit';
import { CONTACT_EMAIL } from './guards';

// A refusal is when the assistant declines because the corpus can't answer.
// The signal is the contact email plus a decline phrasing — the system prompt
// pairs the two, and normal answers never mention the email.
const DECLINE_RE =
  /\b(isn't in|not in|does(?:n't| not) (?:cover|contain|include|mention)|no (?:information|record|mention|details?)|can(?:'t| ?not) answer|outside (?:the|his) (?:corpus|portfolio)|do(?:n't| not) have|not (?:part of|included in|present in|covered)|no such (?:project|system))\b/i;

export function looksLikeRefusal(answer: string): boolean {
  return answer.includes(CONTACT_EMAIL) && DECLINE_RE.test(answer);
}

/** Best-effort: a logging failure must never break the user's response. */
export async function logRefusal(question: string, sessionId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.lpush(
      'chat:refusals',
      JSON.stringify({
        question: question.slice(0, 500),
        timestamp: new Date().toISOString(),
        session_id: sessionId,
      }),
    );
    await redis.ltrim('chat:refusals', 0, 999);
  } catch {
    // swallow — see doc comment
  }
}
