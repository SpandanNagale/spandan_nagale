// Pure, deterministic checks over an assistant answer. No I/O, no model — so
// they're fast and unit-testable. The runner turns each into a pass/fail line.

import type { EvalCase } from './schema.ts';

export const CONTACT_EMAIL = 'spandan4844@gmail.com';

const CITATION_RE =
  /(?:\[\[|\[|【)(proj:[a-z0-9][a-z0-9-]*|doc:about)(?:\]\]|\]|】)/g;

// Mirrors api/_lib/refusalLog.ts DECLINE_RE — keep the two in sync. A decline
// is the contact email plus a phrasing that signals "the corpus can't answer
// this". Broad on purpose; `['’]?` tolerates the straight and typographic
// apostrophe the model emits.
const DECLINE_RE =
  /\b(is\s?n['’]?t (?:in|available|documented|listed|covered|part|something|disclosed)|not in the|does\s?n['’]?t (?:cover|contain|include|mention|list|have|appear|disclose|show)|do(?:es)? not (?:cover|contain|include|mention|list|have|disclose)|no (?:information|record|mention|details?|published|public|documented|data)\b|not aware of|not (?:available|documented|listed|covered|mentioned|disclosed|part of|included in|present in)|the (?:available|provided) (?:information|data|portfolio|corpus)|can\s?not (?:answer|find|confirm|locate|disclose|provide|share|give|help)|can['’]?t (?:answer|find|confirm|locate|provide|share|give|help|disclose|discuss)|could\s?n['’]?t (?:find|confirm|locate)|unable to (?:find|confirm|locate|answer)|ha(?:s\s?n['’]?t|s not|ve not) (?:published|built|created|released|worked|done|disclosed|shared)|outside (?:the|his|its) (?:corpus|portfolio|scope)|do\s?n['’]?t have|no such (?:project|system|paper|role|award)|nothing (?:in|about)|not something (?:this|the))/i;

// First-person voice used *as Spandan*. The assistant itself is allowed to
// say "I" about itself ("I can't help with that", "I'm the site's assistant")
// — the system prompt makes it a first-person agent that is explicitly not
// him. What's forbidden is first person standing in for Spandan: an "I"/"my"
// next to a career verb, or a possessive over his work.
const SPANDAN_FIRST_PERSON =
  /\b(I|I've|I'm|I'd|we)\b[^.?!\n]*\b(built|created|developed|designed|architected|implemented|shipped|wrote|made|led|founded|studied|graduated|interned|worked on|speciali[sz]e|have experience|hold a|earned a)\b/i;
const POSSESSIVE_OVER_WORK =
  /\bmy (project|projects|work|experience|background|degree|internship|role|resume|portfolio|system|systems|code|repo|repos|research)\b/i;

export function citationIds(answer: string): string[] {
  const out: string[] = [];
  for (const m of answer.matchAll(CITATION_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

export function isRefusal(answer: string): boolean {
  return answer.includes(CONTACT_EMAIL) && DECLINE_RE.test(answer);
}

/** Does the answer speak in the first person AS Spandan (not as the assistant)? */
export function speaksAsSpandan(answer: string): boolean {
  // Ignore first person inside quoted spans — a cited README line may contain "I".
  const stripped = answer.replace(/"[^"]*"/g, '').replace(/“[^”]*”/g, '');
  return SPANDAN_FIRST_PERSON.test(stripped) || POSSESSIVE_OVER_WORK.test(stripped);
}

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/** Run every deterministic assertion declared on a case. */
export function runAssertions(c: EvalCase, answer: string): CheckResult[] {
  const results: CheckResult[] = [];
  const hay = answer.toLowerCase();
  const cites = citationIds(answer);

  const add = (name: string, pass: boolean, detail?: string) =>
    results.push({ name, pass, detail: pass ? undefined : detail });

  for (const id of c.must_cite) {
    add(`must_cite ${id}`, cites.includes(id), `citations were [${cites.join(', ') || 'none'}]`);
  }
  for (const id of c.must_not_cite) {
    add(`must_not_cite ${id}`, !cites.includes(id), `found ${id}`);
  }
  for (const s of c.must_contain) {
    add(`must_contain "${s}"`, hay.includes(s.toLowerCase()), 'missing');
  }
  for (const s of c.must_not_contain) {
    add(`must_not_contain "${s}"`, !hay.includes(s.toLowerCase()), 'present');
  }
  for (const rx of c.must_match) {
    add(`must_match /${rx}/`, new RegExp(rx, 'i').test(answer), 'no match');
  }
  for (const rx of c.must_not_match) {
    add(`must_not_match /${rx}/`, !new RegExp(rx, 'i').test(answer), 'matched');
  }
  if (c.expect_refusal) {
    add('expect_refusal', isRefusal(answer), 'not a refusal (need contact email + decline phrasing)');
  }
  if (c.expect_no_refusal) {
    add('expect_no_refusal', !isRefusal(answer), 'answer reads as a refusal');
  }
  if (c.require_citation) {
    add('require_citation', cites.length > 0, 'no citation token present');
  }
  if (c.max_citations !== undefined) {
    add(
      `max_citations ${c.max_citations}`,
      cites.length <= c.max_citations,
      `had ${cites.length} (${cites.join(', ')})`,
    );
  }

  // Voice check: the assistant may say "I" about itself, but never as Spandan.
  if (answer.trim().length > 0) {
    add('not_as_spandan', !speaksAsSpandan(answer), 'first person standing in for Spandan');
  }

  return results;
}

/** A case is well-formed for the gate if it has at least one real check. */
export function hasEffectiveCheck(c: EvalCase): boolean {
  return (
    c.must_cite.length > 0 ||
    c.must_not_cite.length > 0 ||
    c.must_contain.length > 0 ||
    c.must_not_contain.length > 0 ||
    c.must_match.length > 0 ||
    c.must_not_match.length > 0 ||
    c.expect_refusal ||
    c.expect_no_refusal ||
    c.require_citation ||
    c.max_citations !== undefined ||
    c.rubric !== undefined
  );
}
