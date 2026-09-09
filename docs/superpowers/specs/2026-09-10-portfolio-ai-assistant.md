# Portfolio AI Assistant — Spec

> Source: pasted implementation prompt from Spandan, 2026-09-10, with two
> decisions resolved during Step-0 inspection (see "Decisions" below).
> This spec is implemented phase-by-phase; each phase gets its own plan
> under `docs/superpowers/plans/`.

## Role and objective

An AI assistant for Spandan Nagale's engineering portfolio site. Visitors
are recruiters, hiring managers, and engineers evaluating him for GenAI/LLM
roles. The assistant answers questions about his background and projects,
grounded strictly in a curated knowledge base. It must never invent facts.

This is a hiring artifact, not a demo — code quality, grounding discipline,
and engineering judgment are part of what's being evaluated.

## Decisions made during Step 0 (repo inspection)

1. **LLM provider: Ollama Cloud**, not Groq. Key provided by Spandan
   (stored only in `.env.local`, never committed). `api/chat.ts` calls
   Ollama Cloud's API. Model list and prompt-caching support must be
   checked against Ollama Cloud's current docs, not assumed — findings go
   in the README regardless of outcome.
2. **`content/projects.yaml` is a new, separate knowledge source for the
   assistant only.** The existing `src/data/projects.ts` (4 projects:
   datasleuth, querypilot, crewai-research-pipeline, ml-agent — schema is
   `nodes`/`edges`/`highlights`/`howItWorks`, driving the visual DAG
   diagram cards) is untouched. The assistant's knowledge base covers all
   13 projects listed below; the 9 without a visual card produce citation
   chips that link out to GitHub/live URL instead of scrolling to a card.
3. Repo facts confirmed by inspection: Vite 8 + React 19 + Tailwind v4
   static SPA, no router, no backend, no env vars, no test framework, no
   `content/`/`api/`/`scripts/`/`.github/` directories yet. Design tokens
   in `src/index.css` lines 8-16: `--void #080b14`, `--panel #0f1524`,
   `--line #1e2a42`, `--flow #38e0d4` (teal), `--gate #f5a524` (amber),
   `--fault #ff5d73` (coral — retry/rejection only), `--text #e6edf7`,
   `--muted #7c8ba6`. Fonts: Space Grotesk (`font-display`), Inter Tight
   Variable (body), JetBrains Mono (`.mono-label`, 11px/500/uppercase/
   0.12em tracking). Background canvas is `AgentCanvas.tsx`: `fixed
   inset-0 z-0 pointer-events-none`, RAF loop paused on
   `visibilitychange`, no global event bus — new overlay UI just needs
   `z-10`+ (existing convention: content `z-10`, modal `z-50`).

## Non-negotiable constraints

- No vector database, no embeddings, no chunking — the whole corpus fits
  in one context window.
- Third person only. "Spandan built X", never "I built X".
- Every factual claim carries a citation token (`[[proj:<slug>]]` or
  `[[doc:about]]`). Uncited claims are stripped before render.
- Explicit refusal path: unknown → decline + point to his email.
- The system prompt is public, committed to the repo. No prompt-secrecy
  defenses.
- Reuse the existing design system exactly (tokens above). No new UI
  library.
- Knowledge is assembled at **build time only** — no runtime GitHub calls.

**Anti-goals:** voice input, cross-session memory, visitor auth, a
feedback/thumbs UI, a vector store, multi-language support, an avatar or
persona name.

## Live project URLs to add to the knowledge base

- `contextlens` → live_url `https://context-lense.vercel.app/`
- Streamlit app `https://qpjzctwb6nntdeaedg6zzr.streamlit.app/` → slug
  **TBD, ask Spandan** which of the 13 projects this deployment belongs to
  (or if it's a 14th project not yet listed).

## Phase 1 — Knowledge pipeline (this plan)

`scripts/build-knowledge.ts`, run via `npm run build:knowledge`, wired as
an npm `prebuild` step.

**Inputs:**
- `content/about.md` — [AUTHOR] bio, education, work history, location,
  availability, contact.
- `content/projects.yaml` — [AUTHOR] one entry per project, authoritative;
  GitHub only enriches it.
- GitHub API (`GITHUB_TOKEN`) for each repo listed in `projects.yaml`.

**Per-repo enrichment (fetch, never invent):** description, primary +
secondary languages with byte counts, last commit date, star count,
top-level file tree (2 levels deep, max 200 entries), README raw content,
contents of files listed under that project's `key_files`.

**`content/projects.yaml` schema:**

```yaml
- slug: querypilot
  name: QueryPilot
  repo: SpandanNagale/QueryPilot   # omit if private or non-existent
  live_url: null
  status: complete | in-progress | archived
  one_liner: Text-to-SQL LangGraph agent with AST-level safety gating.
  stack: [LangGraph, sqlglot, SQLite, Python]
  design_rationale: >
    3-6 sentences. What was hard, what was rejected and why, the tradeoff.
  metrics:
    - label: Adversarial safety tests passed
      value: "40/40"
  key_files:
    - path: src/graph/validator.py
      why: AST validation and the destructive-operation gate
  talking_points:
    - q: Why sqlglot instead of just prompting the model to be safe?
      a: ...
```

**Output:** `public/knowledge.json` — `corpus_version` (content hash),
`generated_at` timestamp, assembled `documents[]` (id format `proj:<slug>`
or `doc:about`, matching citation tokens), `token_estimate`.

**Build fails when:** a listed repo 404s, an `[AUTHOR]` field is empty or
a placeholder, or `token_estimate` exceeds 60% of the model's context
window (context-window constant is provisional until Phase 2 picks the
exact Ollama Cloud model — see plan).

**13 project slugs to seed** (ask Spandan for `design_rationale`,
`talking_points`, and any uncertain `status`/`repo`/`live_url` — never
paraphrase a README into these fields):
`keel`, `ml-agent`, `datasleuth`, `querypilot`, `docintel`, `marathigpt`,
`veritas`, `self-healing-rag`, `crewai-research-pipeline`, `jarvis`,
`contextlens`, `assay` (status: archived), `sieve` (status: ask).

### `.github/workflows/refresh-knowledge.yml`

Daily cron + `workflow_dispatch`. Rebuilds knowledge, commits
`knowledge.json` if the hash changed, triggers a Vercel deploy. (Phase 4
extends this workflow to also run the eval suite and fail loudly on
regression — not part of Phase 1, since evals don't exist yet.)

## Phase 2 — Serving layer (future plan)

`api/chat.ts` Vercel Edge Function, SSE streaming, Ollama Cloud provider,
Upstash Redis rate limiting (10 msg/10min, 40/day per IP; 15 turns/session
cap), `prompts/system.md` per the spec's exact text, refusal logging.

## Phase 3 — Frontend (future plan)

`ChatPanel`, `CitationChip` (client-side claim-stripping filter with unit
tests), `TelemetryStrip`, `JDMatcher` (Zod-validated structured JD-fit
output, retry-once-then-prose fallback).

## Phase 4 — Evaluation (future plan)

`evals/questions.yaml` (50+ cases), `npm run eval` as a blocking CI gate,
weekly refusal-log digest. Check whether Assay's existing eval harness
interface fits before writing a new grader.

## Acceptance criteria (whole project)

- `npm run build:knowledge` produces valid `knowledge.json`; fails on
  missing `[AUTHOR]` fields or a dead repo.
- TTFT under 1.5s on a warm edge function.
- Every claim-bearing sentence has a working citation chip; clicking
  scrolls to the right project card (or links out, for the 9 cardless
  projects).
- Non-existent project → refusal, never confirmation.
- Skill gap → direct acknowledgment + nearest real adjacent work.
- Rate limits verified: 11th message in 10 minutes rejected gracefully.
- JD matcher returns schema-valid JSON for 3 real JDs, reports ≥1 honest
  gap in each.
- `npm run eval` passes 50/50, blocks CI on failure.
- Assistant is keyboard-navigable, doesn't break the canvas background or
  mobile layout.
- README documents why there is no vector database.

## Working agreement

- Build order: knowledge pipeline → API → chat UI → citations → telemetry
  → JD matcher → evals. Each phase runs end-to-end before the next
  begins. Diff summary + approval at each phase boundary.
- Never write `design_rationale`, `talking_points`, or any biographical
  fact — ask Spandan.
- If a constraint seems wrong once in the code, say so and explain —
  don't silently route around it.
