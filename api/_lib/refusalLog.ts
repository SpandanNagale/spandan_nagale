import { redis } from './ratelimit';
import { CONTACT_EMAIL } from './guards';

// A refusal is when the assistant declines because the corpus can't answer.
// The signal is the contact email plus a decline phrasing — the system prompt
// pairs the two, and normal answers never mention the email.
// Kept in sync with evals/assertions.ts DECLINE_RE. Broad on purpose — the
// assistant phrases a decline many ways, and a missed one means a real gap
// never reaches the weekly refusal digest. `['’]?` tolerates both the
// straight and the typographic apostrophe the model emits ("doesn't"/"doesn't").
const DECLINE_RE =
  /\b(is\s?n['’]?t (?:in|available|documented|listed|covered|part|something|disclosed)|not in the|does\s?n['’]?t (?:cover|contain|include|mention|list|have|appear|disclose|show)|do(?:es)? not (?:cover|contain|include|mention|list|have|disclose)|no (?:information|record|mention|details?|published|public|documented|data)\b|not aware of|not (?:available|documented|listed|covered|mentioned|disclosed|part of|included in|present in)|the (?:available|provided) (?:information|data|portfolio|corpus)|can\s?not (?:answer|find|confirm|locate|disclose|provide|share|give|help)|can['’]?t (?:answer|find|confirm|locate|provide|share|give|help|disclose|discuss)|could\s?n['’]?t (?:find|confirm|locate)|unable to (?:find|confirm|locate|answer)|ha(?:s\s?n['’]?t|s not|ve not) (?:published|built|created|released|worked|done|disclosed|shared)|outside (?:the|his|its) (?:corpus|portfolio|scope)|do\s?n['’]?t have|no such (?:project|system|paper|role|award)|nothing (?:in|about)|not something (?:this|the))/i;

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
