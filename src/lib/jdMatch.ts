// JD matcher: paste a job description, get a structured fit assessment back.
//
// The assistant is asked to answer with a single JSON object. We validate it
// with Zod; on failure the caller retries once, then falls back to showing
// the raw prose. Gaps are a required part of the output, never hidden.

import { z } from 'zod';

export const RequirementSchema = z
  .object({
    requirement: z.string().min(1),
    status: z.enum(['met', 'partial', 'missing']),
    // One or two sentences. May carry citation tokens ([[proj:<slug>]]).
    evidence: z.string().min(1),
  })
  .strict();

export const JdMatchSchema = z
  .object({
    overall_fit: z.enum(['strong', 'moderate', 'partial', 'weak']),
    requirements: z.array(RequirementSchema).min(1),
    // Plain-language wrap-up, third person, names at least one real gap.
    summary: z.string().min(1),
  })
  .strict();

export type Requirement = z.infer<typeof RequirementSchema>;
export type JdMatch = z.infer<typeof JdMatchSchema>;

export const JD_MAX_CHARS = 6000;

const SCHEMA_HINT = `{
  "overall_fit": "strong" | "moderate" | "partial" | "weak",
  "requirements": [
    { "requirement": "<one requirement from the JD>",
      "status": "met" | "partial" | "missing",
      "evidence": "<why, in the third person, with a [[proj:<slug>]] or [[doc:about]] citation when the claim is factual>" }
  ],
  "summary": "<2-3 sentences, third person, naming at least one real gap>"
}`;

/** The user-turn content sent to /api/chat for a JD match request. */
export function buildJdMatchPrompt(jd: string): string {
  return `A recruiter pasted the job description below. Assess how Spandan fits it.

Reply with ONE JSON object and nothing else — no prose before or after, no code fence. Shape:

${SCHEMA_HINT}

Rules:
- Pull 4-8 concrete requirements from the JD (skills, years, responsibilities).
- "met" only when the corpus directly supports it, with a citation in evidence.
- "partial" when there is adjacent but not exact experience.
- "missing" when the corpus has nothing — say so plainly, no softening.
- Do not invent experience to fill a requirement. A missing requirement is a valid, expected answer.
- The summary must name at least one genuine gap.

--- JOB DESCRIPTION ---
${jd.trim().slice(0, JD_MAX_CHARS)}
--- END ---`;
}

/**
 * Find the first top-level JSON object in `text` and parse it. Tolerates a
 * ```json fence, leading/trailing prose, and braces that appear inside JSON
 * string values.
 */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

export type JdMatchParse =
  | { ok: true; data: JdMatch }
  | { ok: false; error: string };

export function parseJdMatch(text: string): JdMatchParse {
  const raw = extractJsonObject(text);
  if (raw === undefined) return { ok: false, error: 'No JSON object found in the response.' };

  const result = JdMatchSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, data: result.data };
}
