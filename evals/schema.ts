import { z } from 'zod';

// One eval case = one question put to the real assistant, plus the checks its
// answer must pass. Deterministic checks are the blocking gate; a `rubric`
// adds an LLM-as-judge pass on top (used where "is this actually grounded and
// correct" can't be pattern-matched).
//
// The discipline here is borrowed from Spandan's Assay project: don't trust a
// single judge score. Every case has at least one deterministic assertion, and
// the judge only ever runs alongside them, never instead of them.

export const CATEGORIES = [
  'grounded', // real project / bio question — must cite, must not refuse
  'refusal', // non-existent project or tech — must decline + give the email
  'gap', // real skill he lacks — must acknowledge the absence, not claim it
  'offtopic', // outside the assistant's purpose — must redirect
  'injection', // prompt-injection / persona / prompt-extraction attempt
  'comparison', // two real projects — must cite both
] as const;

export const EvalCaseSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(CATEGORIES),
    question: z.string().min(1),
    /** Turns to send before `question`, for multi-turn cases. */
    history: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) }))
      .default([]),

    // --- deterministic assertions (all optional, but the runner requires at
    //     least one effective check per case) ---

    /** Citation ids that MUST all appear, e.g. ["proj:querypilot"]. */
    must_cite: z.array(z.string()).default([]),
    /** Citation ids that must NOT appear (e.g. a fabricated-adjacent project). */
    must_not_cite: z.array(z.string()).default([]),
    /** Case-insensitive substrings the answer MUST contain. */
    must_contain: z.array(z.string()).default([]),
    /** Case-insensitive substrings the answer must NOT contain. */
    must_not_contain: z.array(z.string()).default([]),
    /** Regexes (any-match) the answer MUST satisfy. */
    must_match: z.array(z.string()).default([]),
    /** Regexes the answer must NOT satisfy. */
    must_not_match: z.array(z.string()).default([]),
    /** The answer must be a refusal: contact email + a decline phrasing. */
    expect_refusal: z.boolean().default(false),
    /** The answer must NOT be a refusal. */
    expect_no_refusal: z.boolean().default(false),
    /** Upper bound on distinct citation tokens (refusals should cite little). */
    max_citations: z.number().int().nonnegative().optional(),
    /** At least one citation token must be present. */
    require_citation: z.boolean().default(false),

    /** LLM-as-judge rubric. When set, a judge pass/fail is also required. */
    rubric: z.string().optional(),
  })
  .strict();

export const EvalSuiteSchema = z.object({
  cases: z.array(EvalCaseSchema).min(1),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalCategory = (typeof CATEGORIES)[number];
