# Spandan Nagale — Agentic Systems

A single-page portfolio showcasing four multi-agent systems, built as a static site.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Framer Motion for the shared-layout card–modal transition
- Self-hosted fonts via `@fontsource` (Space Grotesk, Inter Tight, JetBrains Mono)
- No router, no backend served by Vercel yet — the site's visible cards still
  come from `src/data/projects.ts`, unrelated to the knowledge pipeline below

## Knowledge pipeline (for the site's upcoming AI assistant)

`content/about.md` and `content/projects.yaml` are the author-written source
of truth for a portfolio AI assistant (a separate, in-progress feature — see
`docs/superpowers/specs/2026-09-10-portfolio-ai-assistant.md`). `npm run
build:knowledge` reads them, enriches each project entry
from the GitHub API (description, languages, README, named key
files), validates everything with Zod, and writes `public/knowledge.json` —
the full corpus a future chat endpoint will load into its system prompt. It
runs at build time only, never at request time, and fails loudly (non-zero
exit) if a listed repo 404s, an author field is empty or a placeholder, or the
corpus grows past 60% of the target model's context window.

Requires `GITHUB_TOKEN` in `.env.local` (see `.env.example`) — a classic or
fine-grained personal access token with public-repo read access. Never
committed; `.env.local` is covered by the existing `*.local` gitignore rule.
A GitHub Action (`.github/workflows/refresh-knowledge.yml`) reruns this daily
and commits `public/knowledge.json` if its content hash changed.

### Why no vector database

The entire knowledge base is a handful of markdown-shaped documents (13
projects plus a bio) — currently well under half of even a modest model's
context window. Retrieval-augmented generation exists to solve a problem this
corpus doesn't have: a corpus too large to fit in one prompt. Adding a vector
store here would mean embedding, indexing, and querying content that already
fits comfortably in the system prompt as-is — introducing a real failure mode
(the wrong chunk retrieved, silently producing a wrong claim about a
candidate's career) to defend against a scale problem that doesn't exist. If
the corpus ever grows past what a single system prompt can hold, that's the
point at which chunking and retrieval would earn their complexity — not
before.

## Structure

```text
src/
  data/projects.ts     # all four projects, typed
  types.ts             # Project, FlowNode, FlowEdge
  lib/flowLayout.ts     # from-scratch layered (Sugiyama-style) DAG layout,
                         # shared by the workflow diagrams and mini thumbnails
  components/
    AgentCanvas.tsx     # ambient background graph, forms into a project's
                         # real pipeline shape when its modal is open
    WorkflowDiagram.tsx # data-driven SVG pipeline renderer with pan/zoom
                         # and an expand-to-fullscreen view
    ...
```

The workflow diagrams are fully data-driven — one layout engine renders all
four project graphs from their `nodes`/`edges` arrays, including branches,
retries, and rejection paths. No per-project coordinates are hardcoded.

## Local development

```bash
npm install
npm run dev
```

```bash
npm run build      # production build to dist/
npm run preview    # preview the production build locally
npm run lint        # oxlint
```

## Deployment

Deployed as a static site on Vercel. Framework preset: Vite. Build command
`npm run build`, output directory `dist`. Vercel's build does not need any
environment variables and does not regenerate `public/knowledge.json` — that
file is committed to the repo and kept fresh by the daily GitHub Action
(`.github/workflows/refresh-knowledge.yml`), which regenerates it and commits
if it changed, then triggers a Vercel redeploy. `npm run build:knowledge` is
intentionally not wired as a `prebuild` hook, so a normal `npm run build`
(including Vercel's) never needs `GITHUB_TOKEN` or makes a GitHub API call —
only the GitHub Action and local development do.
