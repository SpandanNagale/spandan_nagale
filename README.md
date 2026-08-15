# Spandan Nagale — Agentic Systems

A single-page portfolio showcasing four multi-agent systems, built as a static site.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Framer Motion for the shared-layout card–modal transition
- Self-hosted fonts via `@fontsource` (Space Grotesk, Inter Tight, JetBrains Mono)
- No router, no backend, no env vars — all content lives in `src/data/projects.ts`

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
`npm run build`, output directory `dist`. No environment variables required.
