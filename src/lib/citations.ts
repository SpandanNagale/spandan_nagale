// Client-side grounding guard.
//
// The system prompt requires every factual claim about Spandan to carry a
// citation token — [[proj:<slug>]] or [[doc:about]]. This module is the
// last line of defence in the browser: it parses those tokens and strips
// claim-bearing sentences that arrived with none, so an un-grounded slip
// from the model never renders as if it were sourced.
//
// It is deliberately CONSERVATIVE. It only removes a sentence when that
// sentence refers to Spandan (by name or third-person pronoun) AND carries
// no citation AND is not a refusal / meta sentence. Connective text,
// questions, and the "not in the corpus, email him" decline path are all
// kept untouched.

export const CONTACT_EMAIL = 'spandan4844@gmail.com';

/** Matches a single citation token. `proj:` slugs are lowercase kebab; the
 * only doc token is `doc:about`. Canonical form is [[...]], but the model
 * sometimes emits a single bracket or a fullwidth 【...】 pair — accept those
 * too so a citation is never silently dropped. Global + capturing for matchAll. */
export const CITATION_RE =
  /(?:\[\[|\[|【)(proj:[a-z0-9][a-z0-9-]*|doc:about)(?:\]\]|\]|】)/g;

/** All distinct citation ids in `text`, in first-seen order. */
export function parseCitations(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/** Remove every citation token, collapsing the whitespace they leave behind. */
export function stripCitationTokens(text: string): string {
  return text
    .replace(CITATION_RE, '')
    .replace(/ +([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
}

// A sentence "refers to Spandan" if it names him or uses a third-person
// subject/object pronoun. That is the population of sentences the grounding
// rule applies to.
const REFERS_TO_SUBJECT = /\b(Spandan|he|his|him)\b/i;

// Sentences we never strip even without a citation: the explicit refusal
// path, and meta/connective lines.
const REFUSAL_OR_META =
  /(not (?:in|part of|covered|included|present)|does(?:n't| not) (?:cover|contain|include|mention)|no (?:information|record|mention|details?)|isn't in the (?:corpus|portfolio)|outside (?:the|his) (?:corpus|portfolio)|can(?:'t| ?not) answer|no such (?:project|system))/i;

// A stated skill gap is allowed to stand without a citation — the system
// prompt's GAPS rule attaches the citation to the nearest *real* thing, not
// to the absence. Recognised as a negation word sitting next to an
// experience/skill word.
const GAP_NEGATION =
  /\b(no|not|n't|never|little|limited|lacks?|lacking|without|hasn't|haven't|doesn't|don't|didn't|isn't|aren't|wasn't)\b/i;
const GAP_SKILL_WORD =
  /\b(experience|exposure|background|worked?|work|built|build|using|used?|shipped?|ship|done|familiar|familiarity|knowledge|production|hands-on|deployed?|expertise|projects?)\b/i;

/** Split into sentences, keeping each sentence's trailing punctuation and the
 * whitespace that follows attached to it, so `pieces.join('')` reproduces the
 * input exactly. Newline runs are kept as their own separators so list /
 * paragraph structure survives. */
export function splitSentences(text: string): string[] {
  const parts = text.split(/([.!?]+["')\]]*[ \t]+|\n+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const piece = (parts[i] ?? '') + (parts[i + 1] ?? '');
    if (piece.length > 0) out.push(piece);
  }
  return out;
}

export interface StripResult {
  /** The answer with un-cited claim sentences removed. */
  text: string;
  /** The sentences that were removed, for debugging / telemetry. */
  removed: string[];
}

/**
 * Strip claim-bearing sentences that carry no citation token.
 *
 * A sentence is removed only when ALL of these hold:
 *  - it mentions Spandan by name or third-person pronoun,
 *  - it contains no citation token,
 *  - it is not a refusal / "not in the corpus" sentence,
 *  - it is not a bare question.
 */
export function stripUncitedClaims(answer: string): StripResult {
  const pieces = splitSentences(answer);
  const removed: string[] = [];

  const kept = pieces.filter((piece) => {
    const s = piece.trim();
    if (s.length === 0) return true;
    if (CITATION_RE.test(s)) {
      CITATION_RE.lastIndex = 0;
      return true;
    }
    CITATION_RE.lastIndex = 0;
    if (!REFERS_TO_SUBJECT.test(s)) return true;
    if (REFUSAL_OR_META.test(s)) return true;
    if (GAP_NEGATION.test(s) && GAP_SKILL_WORD.test(s)) return true;
    if (s.includes(CONTACT_EMAIL)) return true;
    if (s.endsWith('?')) return true;
    removed.push(s);
    return false;
  });

  return { text: kept.join('').replace(/\n{3,}/g, '\n\n').trim(), removed };
}
