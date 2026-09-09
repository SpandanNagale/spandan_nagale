# Knowledge Pipeline Implementation Plan (Phase 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Task 9 is different from the others — it is not code.** It requires
> asking Spandan directly for biographical and project content. Do not
> dispatch Task 9 to a fresh subagent with no conversation context; it
> must run with a human in the loop. Tasks 1-8 are ordinary TDD code
> tasks and are fine to dispatch.

**Goal:** Build `scripts/build-knowledge.ts`, a build-time-only pipeline
that reads `content/about.md` + `content/projects.yaml`, enriches project
entries from the GitHub API, validates everything, and writes
`public/knowledge.json` — the single corpus the Phase 2 chat API will load
into its system prompt.

**Architecture:** Pure, independently-testable modules
(`scripts/knowledge/schema.ts`, `tokenEstimate.ts`, `github.ts`,
`buildCorpus.ts`) composed by one orchestrator (`scripts/knowledge/run.ts`)
that a thin CLI (`scripts/build-knowledge.ts`) invokes with real
filesystem paths, `process.env.GITHUB_TOKEN`, and the global `fetch`. The
orchestrator takes all its dependencies as parameters so it can be unit
tested against fixture files with a mocked `fetch` — no network calls in
the test suite.

**Tech Stack:** Node (via `tsx`, matching the existing `"type": "module"`
ESM setup), `zod` for schema validation, `yaml` for parsing
`content/projects.yaml`, `dotenv` for loading `.env.local`, `vitest` as
the test runner (new to this repo — chosen over jest for its native Vite
integration).

**Spec:** `docs/superpowers/specs/2026-09-10-portfolio-ai-assistant.md`
(Phase 1 section + Decisions + Non-negotiable constraints). Read both
before starting.

## Global Constraints

- No vector database, no embeddings, no chunking — the whole corpus is
  one JSON file assembled at build time.
- Knowledge is assembled at **build time only** — `scripts/build-knowledge.ts`
  never runs during a request; it runs via `npm run build:knowledge`
  (wired as `prebuild`) and in the daily GitHub Action.
- Build **fails loudly** (non-zero exit, clear error message) when: a
  listed repo 404s, an `[AUTHOR]` field is empty/placeholder, or
  `token_estimate` exceeds 60% of the model's context window.
- Never write `design_rationale`, `talking_points`, `one_liner`, or any
  other biographical/project fact yourself — ask Spandan (Task 9).
- Reuse existing repo conventions: ESM (`"type": "module"`), TypeScript
  strict-ish settings matching `tsconfig.app.json`/`tsconfig.node.json`,
  no new linter (oxlint stays authoritative), Windows-safe paths (this
  repo is developed on Windows — use `node:path` helpers, never hardcode
  `/`-only paths in code, though forward slashes in YAML `path` fields are
  fine since they're just data).

---

## File Structure

```
content/
  about.md                 # [AUTHOR] — Task 9
  projects.yaml             # [AUTHOR] + machine-derived — Task 9
scripts/
  build-knowledge.ts        # thin CLI entry — Task 7
  knowledge/
    schema.ts               # Zod schemas — Task 2
    schema.test.ts
    tokenEstimate.ts         # token heuristic + budget check — Task 3
    tokenEstimate.test.ts
    github.ts                # GitHub REST enrichment, fetch injected — Task 4
    github.test.ts
    buildCorpus.ts            # pure corpus assembly — Task 5
    buildCorpus.test.ts
    run.ts                    # orchestrator, all deps injected — Task 6
    run.test.ts
public/
  knowledge.json             # generated output, committed to git
.github/workflows/
  refresh-knowledge.yml      # daily cron — Task 8
.env.example                 # Task 1
vitest.config.ts             # Task 1
tsconfig.scripts.json        # Task 1
package.json                 # modified — Task 1
tsconfig.json                # modified — Task 1
```

---

### Task 1: Dependencies, test runner, and script scaffolding

**Files:**
- Create: `vitest.config.ts`
- Create: `tsconfig.scripts.json`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `npm run test` (vitest), `npm run build:knowledge` (runs
  `scripts/build-knowledge.ts` via `tsx`), `npm run prebuild` (npm's
  lifecycle hook, auto-runs before `npm run build`).

- [ ] **Step 1: Install dependencies**

Run: `npm install -D zod yaml tsx vitest dotenv`

Expected: `package.json` `devDependencies` gains `zod`, `yaml`, `tsx`,
`vitest`, `dotenv` with whatever versions npm resolves (do not hand-write
version numbers).

- [ ] **Step 2: Add npm scripts**

Edit `package.json`'s `"scripts"` block to:

```json
"scripts": {
  "dev": "vite",
  "build:knowledge": "tsx scripts/build-knowledge.ts",
  "prebuild": "npm run build:knowledge",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "lint": "oxlint",
  "preview": "vite preview"
}
```

- [ ] **Step 3: Create the vitest config**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create a tsconfig project for scripts/ and reference it from the root**

`tsconfig.scripts.json` (mirrors `tsconfig.app.json`'s bundler-resolution
style rather than `tsconfig.node.json`'s `nodenext`, so relative imports
don't need explicit `.js` extensions — `tsx` handles real ESM resolution
at runtime regardless of what tsc uses for type-checking):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.scripts.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["scripts", "vitest.config.ts"]
}
```

Edit `tsconfig.json` to add the third reference, so `npm run build`'s
`tsc -b` also type-checks `scripts/`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.scripts.json" }
  ]
}
```

- [ ] **Step 5: Create `.env.example`**

```
# GitHub API token (read-only, public repos) used by scripts/build-knowledge.ts.
GITHUB_TOKEN=

# Ollama Cloud API key, used by api/chat.ts — added in Phase 2.
OLLAMA_API_KEY=
```

- [ ] **Step 6: Verify `.env.local` is already ignored**

Run: `git check-ignore .env.local`

Expected: prints `.env.local` (matched by the existing `*.local` rule in
`.gitignore` — no `.gitignore` edit needed).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.scripts.json tsconfig.json .env.example
git commit -m "chore: scaffold vitest, tsx, and knowledge-pipeline deps"
```

---

### Task 2: Zod schemas for `content/projects.yaml`

**Files:**
- Create: `scripts/knowledge/schema.ts`
- Test: `scripts/knowledge/schema.test.ts`

**Interfaces:**
- Produces: `ProjectEntrySchema`, `ProjectsYamlSchema`, `ProjectStatusSchema`
  (Zod schemas), `ProjectEntry`, `ProjectStatus` (inferred types) — consumed
  by Task 6 (`run.ts`) and Task 5 (`buildCorpus.ts`).

- [ ] **Step 1: Write the failing tests**

`scripts/knowledge/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ProjectEntrySchema, ProjectsYamlSchema } from './schema';

const validEntry = {
  slug: 'querypilot',
  name: 'QueryPilot',
  repo: 'SpandanNagale/QueryPilot',
  live_url: null,
  status: 'complete',
  one_liner: 'Text-to-SQL LangGraph agent with AST-level safety gating.',
  stack: ['LangGraph', 'sqlglot', 'SQLite', 'Python'],
  design_rationale:
    'Naive text-to-SQL agents validate with regex or just trust the model. Rejected both: parsed every generated statement into a sqlglot AST and gated destructive operations behind a human confirmation step.',
  metrics: [{ label: 'Adversarial safety tests passed', value: '40/40' }],
  key_files: [
    { path: 'src/graph/validator.py', why: 'AST validation and the destructive-operation gate' },
  ],
  talking_points: [
    { q: 'Why sqlglot instead of prompting the model to be safe?', a: 'Prompted safety is unenforceable; AST gating is.' },
  ],
};

describe('ProjectEntrySchema', () => {
  it('accepts a fully-populated entry', () => {
    expect(() => ProjectEntrySchema.parse(validEntry)).not.toThrow();
  });

  it('rejects an empty design_rationale (placeholder author content)', () => {
    expect(() => ProjectEntrySchema.parse({ ...validEntry, design_rationale: '' })).toThrow();
  });

  it('rejects a design_rationale too short to be a real 3-6 sentence explanation', () => {
    expect(() =>
      ProjectEntrySchema.parse({ ...validEntry, design_rationale: 'Built it with LangGraph.' }),
    ).toThrow();
  });

  it('rejects zero talking_points', () => {
    expect(() => ProjectEntrySchema.parse({ ...validEntry, talking_points: [] })).toThrow();
  });

  it('rejects a malformed repo string', () => {
    expect(() => ProjectEntrySchema.parse({ ...validEntry, repo: 'not-a-repo-path' })).toThrow();
  });

  it('allows repo to be omitted for private/nonexistent repos', () => {
    const { repo, ...rest } = validEntry;
    expect(() => ProjectEntrySchema.parse(rest)).not.toThrow();
  });

  it('defaults metrics and key_files to empty arrays when omitted', () => {
    const { metrics, key_files, ...rest } = validEntry;
    const parsed = ProjectEntrySchema.parse(rest);
    expect(parsed.metrics).toEqual([]);
    expect(parsed.key_files).toEqual([]);
  });

  it('rejects an unknown status value', () => {
    expect(() => ProjectEntrySchema.parse({ ...validEntry, status: 'done' })).toThrow();
  });
});

describe('ProjectsYamlSchema', () => {
  it('rejects an empty project list', () => {
    expect(() => ProjectsYamlSchema.parse([])).toThrow();
  });

  it('accepts a list of valid entries', () => {
    expect(() => ProjectsYamlSchema.parse([validEntry])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/knowledge/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'` (file doesn't exist yet).

- [ ] **Step 3: Write the schema module**

`scripts/knowledge/schema.ts`:

```ts
import { z } from 'zod';

export const KeyFileSchema = z.object({
  path: z.string().min(1),
  why: z.string().min(1),
});

export const MetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const TalkingPointSchema = z.object({
  q: z.string().min(1),
  a: z.string().min(1),
});

export const ProjectStatusSchema = z.enum(['complete', 'in-progress', 'archived']);

export const ProjectEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-kebab-case'),
  name: z.string().min(1),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"').optional(),
  live_url: z.string().url().nullable().optional(),
  status: ProjectStatusSchema,
  one_liner: z.string().min(1),
  stack: z.array(z.string().min(1)).min(1),
  design_rationale: z
    .string()
    .min(80, 'design_rationale must be a real 3-6 sentence explanation, not a placeholder'),
  metrics: z.array(MetricSchema).default([]),
  key_files: z.array(KeyFileSchema).default([]),
  talking_points: z
    .array(TalkingPointSchema)
    .min(1, 'each project needs at least one anticipated interview question'),
});

export const ProjectsYamlSchema = z.array(ProjectEntrySchema).min(1);

export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/knowledge/schema.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/schema.ts scripts/knowledge/schema.test.ts
git commit -m "feat: add Zod schema for content/projects.yaml"
```

---

### Task 3: Token estimate and context-window budget check

**Files:**
- Create: `scripts/knowledge/tokenEstimate.ts`
- Test: `scripts/knowledge/tokenEstimate.test.ts`

**Interfaces:**
- Produces: `estimateTokens(text): number`, `exceedsContextBudget(tokenEstimate, contextWindow?): boolean`,
  `MODEL_CONTEXT_WINDOW_TOKENS`, `CONTEXT_WINDOW_BUDGET_RATIO` — consumed
  by Task 5 (`buildCorpus.ts`) and Task 6 (`run.ts`).

- [ ] **Step 1: Write the failing tests**

`scripts/knowledge/tokenEstimate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { estimateTokens, exceedsContextBudget } from './tokenEstimate';

describe('estimateTokens', () => {
  it('estimates roughly 4 characters per token', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1);
  });

  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('exceedsContextBudget', () => {
  it('is false comfortably under the 60% budget', () => {
    expect(exceedsContextBudget(1000, 10000)).toBe(false);
  });

  it('is true just over the 60% budget', () => {
    expect(exceedsContextBudget(6001, 10000)).toBe(true);
  });

  it('is false exactly at the 60% budget', () => {
    expect(exceedsContextBudget(6000, 10000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/knowledge/tokenEstimate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

`scripts/knowledge/tokenEstimate.ts`:

```ts
// Provisional until Phase 2 picks the exact Ollama Cloud model; override
// via KNOWLEDGE_CONTEXT_WINDOW once that model's real context window is
// known. Kept conservative (32K) so this fail-condition errs toward
// catching an oversized corpus early rather than missing one.
export const MODEL_CONTEXT_WINDOW_TOKENS = Number(process.env.KNOWLEDGE_CONTEXT_WINDOW ?? 32000);

export const CONTEXT_WINDOW_BUDGET_RATIO = 0.6;

// Heuristic: ~4 characters per token for English prose. Good enough to
// gate the 60% budget check; an exact tokenizer isn't worth a dependency
// at this corpus size (a handful of markdown documents).
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function exceedsContextBudget(
  tokenEstimate: number,
  contextWindow: number = MODEL_CONTEXT_WINDOW_TOKENS,
): boolean {
  return tokenEstimate > contextWindow * CONTEXT_WINDOW_BUDGET_RATIO;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/knowledge/tokenEstimate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/tokenEstimate.ts scripts/knowledge/tokenEstimate.test.ts
git commit -m "feat: add token estimate and context-window budget check"
```

---

### Task 4: GitHub REST enrichment (fetch injected for testability)

**Files:**
- Create: `scripts/knowledge/github.ts`
- Test: `scripts/knowledge/github.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `RepoNotFoundError`, `FetchFn` type, `RepoMeta` (`{description,
  stars, pushedAt, defaultBranch}`), `LanguageBreakdown`, `TreeEntry`
  (`{path, type: 'file'|'dir'}`), `fetchRepoMeta(fetchFn, repo, token)`,
  `fetchLanguages(fetchFn, repo, token)`, `fetchReadme(fetchFn, repo, token)`,
  `fetchTree(fetchFn, repo, defaultBranch, token)`,
  `fetchFileContent(fetchFn, repo, path, token)` — consumed by Task 6
  (`run.ts`).

- [ ] **Step 1: Write the failing tests**

`scripts/knowledge/github.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  RepoNotFoundError,
  fetchRepoMeta,
  fetchLanguages,
  fetchReadme,
  fetchTree,
  fetchFileContent,
  type FetchFn,
} from './github';

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 404 ? 'Not Found' : 'OK',
    json: async () => body,
  } as unknown as Response;
}

describe('fetchRepoMeta', () => {
  it('returns parsed repo metadata on success', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, {
        description: 'A test repo',
        stargazers_count: 12,
        pushed_at: '2026-01-01T00:00:00Z',
        default_branch: 'main',
      }),
    ) as unknown as FetchFn;
    const meta = await fetchRepoMeta(fetchFn, 'owner/repo', 'token');
    expect(meta).toEqual({
      description: 'A test repo',
      stars: 12,
      pushedAt: '2026-01-01T00:00:00Z',
      defaultBranch: 'main',
    });
  });

  it('throws RepoNotFoundError on 404', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchRepoMeta(fetchFn, 'owner/missing', 'token')).rejects.toThrow(RepoNotFoundError);
  });

  it('sends an authorization header with the token', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, {
        description: null,
        stargazers_count: 0,
        pushed_at: '2026-01-01T00:00:00Z',
        default_branch: 'main',
      }),
    );
    await fetchRepoMeta(fetchFn as unknown as FetchFn, 'owner/repo', 'secret-token');
    const [, init] = fetchFn.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer secret-token' });
  });
});

describe('fetchLanguages', () => {
  it('returns the language byte-count map', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { Python: 5000, HTML: 200 })) as unknown as FetchFn;
    expect(await fetchLanguages(fetchFn, 'owner/repo', 'token')).toEqual({ Python: 5000, HTML: 200 });
  });

  it('throws RepoNotFoundError on 404', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchLanguages(fetchFn, 'owner/missing', 'token')).rejects.toThrow(RepoNotFoundError);
  });
});

describe('fetchReadme', () => {
  it('decodes base64 README content', async () => {
    const encoded = Buffer.from('# Hello').toString('base64');
    const fetchFn = vi.fn(async () => jsonResponse(200, { content: encoded, encoding: 'base64' })) as unknown as FetchFn;
    expect(await fetchReadme(fetchFn, 'owner/repo', 'token')).toBe('# Hello');
  });

  it('returns an empty string when there is no README, without throwing', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    expect(await fetchReadme(fetchFn, 'owner/repo', 'token')).toBe('');
  });
});

describe('fetchTree', () => {
  it('filters to two levels deep and caps at 200 entries', async () => {
    const shallowEntries = Array.from({ length: 250 }, (_, i) => ({ path: `src/file${i}.ts`, type: 'blob' }));
    const tooDeep = { path: 'src/nested/too/deep.ts', type: 'blob' };
    const fetchFn = vi.fn(async () => jsonResponse(200, { tree: [...shallowEntries, tooDeep] })) as unknown as FetchFn;
    const tree = await fetchTree(fetchFn, 'owner/repo', 'main', 'token');
    expect(tree.length).toBe(200);
    expect(tree.every((entry) => entry.path.split('/').length <= 2)).toBe(true);
  });

  it('throws RepoNotFoundError on 404', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchTree(fetchFn, 'owner/missing', 'main', 'token')).rejects.toThrow(RepoNotFoundError);
  });
});

describe('fetchFileContent', () => {
  it('decodes base64 file content', async () => {
    const encoded = Buffer.from('print("hi")').toString('base64');
    const fetchFn = vi.fn(async () => jsonResponse(200, { content: encoded, encoding: 'base64' })) as unknown as FetchFn;
    expect(await fetchFileContent(fetchFn, 'owner/repo', 'src/main.py', 'token')).toBe('print("hi")');
  });

  it('throws a descriptive error when the key_files path does not exist', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchFileContent(fetchFn, 'owner/repo', 'missing.py', 'token')).rejects.toThrow(/missing\.py/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/knowledge/github.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

`scripts/knowledge/github.ts`:

```ts
export class RepoNotFoundError extends Error {
  constructor(public readonly repo: string) {
    super(`GitHub repo "${repo}" returned 404 — it may have been renamed, deleted, or made private.`);
    this.name = 'RepoNotFoundError';
  }
}

export interface RepoMeta {
  description: string | null;
  stars: number;
  pushedAt: string;
  defaultBranch: string;
}

export interface LanguageBreakdown {
  [language: string]: number;
}

export interface TreeEntry {
  path: string;
  type: 'file' | 'dir';
}

export type FetchFn = typeof fetch;

const GITHUB_API = 'https://api.github.com';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubGet(fetchFn: FetchFn, url: string, token: string): Promise<Response> {
  return fetchFn(url, { headers: authHeaders(token) });
}

export async function fetchRepoMeta(fetchFn: FetchFn, repo: string, token: string): Promise<RepoMeta> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}`, token);
  if (res.status === 404) throw new RepoNotFoundError(repo);
  if (!res.ok) throw new Error(`GitHub API error fetching ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as {
    description: string | null;
    stargazers_count: number;
    pushed_at: string;
    default_branch: string;
  };
  return {
    description: data.description,
    stars: data.stargazers_count,
    pushedAt: data.pushed_at,
    defaultBranch: data.default_branch,
  };
}

export async function fetchLanguages(fetchFn: FetchFn, repo: string, token: string): Promise<LanguageBreakdown> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/languages`, token);
  if (res.status === 404) throw new RepoNotFoundError(repo);
  if (!res.ok) throw new Error(`GitHub API error fetching languages for ${repo}: ${res.status} ${res.statusText}`);
  return (await res.json()) as LanguageBreakdown;
}

export async function fetchReadme(fetchFn: FetchFn, repo: string, token: string): Promise<string> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/readme`, token);
  if (res.status === 404) return '';
  if (!res.ok) throw new Error(`GitHub API error fetching README for ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') throw new Error(`Unexpected README encoding for ${repo}: ${data.encoding}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function fetchTree(
  fetchFn: FetchFn,
  repo: string,
  defaultBranch: string,
  token: string,
): Promise<TreeEntry[]> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/git/trees/${defaultBranch}?recursive=1`, token);
  if (res.status === 404) throw new RepoNotFoundError(repo);
  if (!res.ok) throw new Error(`GitHub API error fetching tree for ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { tree: { path: string; type: string }[] };
  return data.tree
    .filter((entry) => entry.path.split('/').length <= 2)
    .slice(0, 200)
    .map((entry) => ({ path: entry.path, type: entry.type === 'tree' ? 'dir' : 'file' }));
}

export async function fetchFileContent(
  fetchFn: FetchFn,
  repo: string,
  path: string,
  token: string,
): Promise<string> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/contents/${path}`, token);
  if (res.status === 404) {
    throw new Error(`key_files entry "${path}" not found in ${repo} — update content/projects.yaml`);
  }
  if (!res.ok) throw new Error(`GitHub API error fetching ${path} in ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') throw new Error(`Unexpected encoding for ${path} in ${repo}: ${data.encoding}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/knowledge/github.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/github.ts scripts/knowledge/github.test.ts
git commit -m "feat: add GitHub enrichment fetchers with injectable fetch"
```

---

### Task 5: Corpus assembly

**Files:**
- Create: `scripts/knowledge/buildCorpus.ts`
- Test: `scripts/knowledge/buildCorpus.test.ts`

**Interfaces:**
- Consumes: `ProjectEntry` (Task 2), `RepoMeta`/`LanguageBreakdown`/`TreeEntry`
  (Task 4), `estimateTokens` (Task 3).
- Produces: `ProjectEnrichment` (`{meta, languages, tree, readme,
  keyFileContents}`, all nullable except `keyFileContents`),
  `EnrichedProject` (`{entry, enrichment}`), `KnowledgeDocument`
  (`{id, type, title, content}` — `id` is `"doc:about"` or `"proj:<slug>"`,
  matching the citation-token format `[[proj:<slug>]]`/`[[doc:about]]`),
  `KnowledgeBase` (`{corpus_version, generated_at, token_estimate,
  documents}`), `buildAboutDocument(markdown)`,
  `buildProjectDocument(enrichedProject)`, `buildCorpus(aboutMarkdown,
  projects)` — consumed by Task 6 (`run.ts`).

- [ ] **Step 1: Write the failing tests**

`scripts/knowledge/buildCorpus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAboutDocument, buildProjectDocument, buildCorpus, type EnrichedProject } from './buildCorpus';
import type { ProjectEntry } from './schema';

const entry: ProjectEntry = {
  slug: 'querypilot',
  name: 'QueryPilot',
  repo: 'SpandanNagale/QueryPilot',
  status: 'complete',
  one_liner: 'Text-to-SQL LangGraph agent with AST-level safety gating.',
  stack: ['LangGraph', 'sqlglot'],
  design_rationale:
    'Rejected regex validation and blind trust in the model in favor of parsing every generated statement into a sqlglot AST and gating destructive operations behind human confirmation.',
  metrics: [{ label: 'Adversarial safety tests passed', value: '40/40' }],
  key_files: [{ path: 'src/graph/validator.py', why: 'AST validation and the destructive-operation gate' }],
  talking_points: [{ q: 'Why sqlglot?', a: 'Prompted safety is unenforceable; AST gating is.' }],
};

const enrichedNoGithub: EnrichedProject = {
  entry: { ...entry, repo: undefined },
  enrichment: { meta: null, languages: null, tree: null, readme: null, keyFileContents: {} },
};

const enrichedWithGithub: EnrichedProject = {
  entry,
  enrichment: {
    meta: { description: 'A text-to-SQL agent', stars: 5, pushedAt: '2026-01-01T00:00:00Z', defaultBranch: 'main' },
    languages: { Python: 8000, HTML: 200 },
    tree: [{ path: 'src', type: 'dir' }],
    readme: '# QueryPilot\nDetails here.',
    keyFileContents: { 'src/graph/validator.py': 'def validate(): ...' },
  },
};

describe('buildAboutDocument', () => {
  it('wraps trimmed about markdown with the doc:about id', () => {
    const doc = buildAboutDocument('  Spandan is an engineer.  ');
    expect(doc).toEqual({ id: 'doc:about', type: 'about', title: 'About Spandan', content: 'Spandan is an engineer.' });
  });
});

describe('buildProjectDocument', () => {
  it('uses the proj:<slug> id format matching citation tokens', () => {
    expect(buildProjectDocument(enrichedNoGithub).id).toBe('proj:querypilot');
  });

  it('includes design_rationale, metrics, and talking_points from the author content', () => {
    const { content } = buildProjectDocument(enrichedNoGithub);
    expect(content).toContain(entry.design_rationale);
    expect(content).toContain('Adversarial safety tests passed: 40/40');
    expect(content).toContain('Q: Why sqlglot?');
  });

  it('omits GitHub sections entirely when the repo was not enriched', () => {
    const { content } = buildProjectDocument(enrichedNoGithub);
    expect(content).not.toContain('Repository facts');
    expect(content).not.toContain('## README');
  });

  it('includes GitHub facts, languages, and README when enriched', () => {
    const { content } = buildProjectDocument(enrichedWithGithub);
    expect(content).toContain('Stars: 5');
    expect(content).toContain('Python: 8000');
    expect(content).toContain('Details here.');
  });

  it('embeds key_files content fetched from GitHub, not just the path', () => {
    const { content } = buildProjectDocument(enrichedWithGithub);
    expect(content).toContain('def validate(): ...');
  });
});

describe('buildCorpus', () => {
  it('produces one document per project plus the about document', () => {
    const kb = buildCorpus('Bio text.', [enrichedNoGithub]);
    expect(kb.documents).toHaveLength(2);
    expect(kb.documents.map((d) => d.id)).toEqual(['doc:about', 'proj:querypilot']);
  });

  it('produces a stable corpus_version for identical input and a different one when content changes', () => {
    const a = buildCorpus('Bio text.', [enrichedNoGithub]);
    const b = buildCorpus('Bio text.', [enrichedNoGithub]);
    const c = buildCorpus('Different bio.', [enrichedNoGithub]);
    expect(a.corpus_version).toBe(b.corpus_version);
    expect(a.corpus_version).not.toBe(c.corpus_version);
  });

  it('sums token estimates across all documents', () => {
    const kb = buildCorpus('Bio text.', [enrichedNoGithub]);
    const expectedTotal = kb.documents.reduce((sum, doc) => sum + Math.ceil(doc.content.length / 4), 0);
    expect(kb.token_estimate).toBe(expectedTotal);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/knowledge/buildCorpus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

`scripts/knowledge/buildCorpus.ts`:

```ts
import { createHash } from 'node:crypto';
import type { ProjectEntry } from './schema';
import type { RepoMeta, LanguageBreakdown, TreeEntry } from './github';
import { estimateTokens } from './tokenEstimate';

export interface ProjectEnrichment {
  meta: RepoMeta | null;
  languages: LanguageBreakdown | null;
  tree: TreeEntry[] | null;
  readme: string | null;
  keyFileContents: Record<string, string>;
}

export interface EnrichedProject {
  entry: ProjectEntry;
  enrichment: ProjectEnrichment;
}

export interface KnowledgeDocument {
  id: string;
  type: 'about' | 'project';
  title: string;
  content: string;
}

export interface KnowledgeBase {
  corpus_version: string;
  generated_at: string;
  token_estimate: number;
  documents: KnowledgeDocument[];
}

export function buildAboutDocument(aboutMarkdown: string): KnowledgeDocument {
  return { id: 'doc:about', type: 'about', title: 'About Spandan', content: aboutMarkdown.trim() };
}

export function buildProjectDocument({ entry, enrichment }: EnrichedProject): KnowledgeDocument {
  const lines: string[] = [
    `# ${entry.name}`,
    `Status: ${entry.status}`,
    `One-liner: ${entry.one_liner}`,
    `Stack: ${entry.stack.join(', ')}`,
  ];
  if (entry.live_url) lines.push(`Live URL: ${entry.live_url}`);
  if (entry.repo) lines.push(`Repository: https://github.com/${entry.repo}`);
  lines.push('', '## Design rationale (why it was built this way)', entry.design_rationale);

  if (entry.metrics.length > 0) {
    lines.push('', '## Metrics');
    for (const metric of entry.metrics) lines.push(`- ${metric.label}: ${metric.value}`);
  }

  if (entry.key_files.length > 0) {
    lines.push('', '## Key files');
    for (const file of entry.key_files) {
      lines.push(`- ${file.path} — ${file.why}`);
      const content = enrichment.keyFileContents[file.path];
      if (content) lines.push('```', content.trim(), '```');
    }
  }

  if (entry.talking_points.length > 0) {
    lines.push('', '## Anticipated questions');
    for (const point of entry.talking_points) lines.push(`Q: ${point.q}`, `A: ${point.a}`);
  }

  if (enrichment.meta) {
    lines.push(
      '',
      '## Repository facts (from GitHub)',
      `- Stars: ${enrichment.meta.stars}`,
      `- Last commit: ${enrichment.meta.pushedAt}`,
    );
    if (enrichment.meta.description) lines.push(`- GitHub description: ${enrichment.meta.description}`);
  }

  if (enrichment.languages) {
    const ranked = Object.entries(enrichment.languages).sort((a, b) => b[1] - a[1]);
    if (ranked.length > 0) {
      lines.push('', '## Languages (by bytes, from GitHub)');
      for (const [language, bytes] of ranked) lines.push(`- ${language}: ${bytes}`);
    }
  }

  if (enrichment.readme) {
    lines.push('', '## README', enrichment.readme.trim());
  }

  return { id: `proj:${entry.slug}`, type: 'project', title: entry.name, content: lines.join('\n') };
}

export function buildCorpus(aboutMarkdown: string, projects: EnrichedProject[]): KnowledgeBase {
  const documents = [buildAboutDocument(aboutMarkdown), ...projects.map(buildProjectDocument)];
  const tokenEstimate = documents.reduce((sum, doc) => sum + estimateTokens(doc.content), 0);
  const corpusVersion = createHash('sha256')
    .update(documents.map((doc) => `${doc.id}\n${doc.content}`).join('\n---\n'))
    .digest('hex')
    .slice(0, 12);

  return {
    corpus_version: corpusVersion,
    generated_at: new Date().toISOString(),
    token_estimate: tokenEstimate,
    documents,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/knowledge/buildCorpus.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/buildCorpus.ts scripts/knowledge/buildCorpus.test.ts
git commit -m "feat: assemble knowledge documents and corpus_version hash"
```

---

### Task 6: Orchestrator (`run.ts`) — reads content, enriches, validates, writes

**Files:**
- Create: `scripts/knowledge/run.ts`
- Test: `scripts/knowledge/run.test.ts`

**Interfaces:**
- Consumes: `ProjectsYamlSchema` (Task 2), `fetchRepoMeta`/`fetchLanguages`/
  `fetchReadme`/`fetchTree`/`fetchFileContent`/`FetchFn` (Task 4),
  `buildCorpus`/`EnrichedProject`/`ProjectEnrichment`/`KnowledgeBase` (Task 5),
  `exceedsContextBudget`/`MODEL_CONTEXT_WINDOW_TOKENS`/`CONTEXT_WINDOW_BUDGET_RATIO`
  (Task 3).
- Produces: `runBuildKnowledge(options: BuildKnowledgeOptions): Promise<KnowledgeBase>`
  where `BuildKnowledgeOptions = {aboutPath, projectsPath, outputPath,
  githubToken?, fetchFn}` — consumed by Task 7 (`build-knowledge.ts` CLI).

- [ ] **Step 1: Write the failing tests**

`scripts/knowledge/run.test.ts`:

```ts
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBuildKnowledge } from './run';
import type { FetchFn } from './github';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'knowledge-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Fixture-only text: satisfies the minimum-length guard without asserting
// any real fact about Spandan.
const FIXTURE_BIO =
  'This is placeholder biography text used only inside the knowledge-pipeline test suite. It exists purely to satisfy the minimum-length guard on content/about.md and contains no real information about any person. This fixture is not authored content.';

const noopFetch = vi.fn() as unknown as FetchFn;

function writeFixtures(aboutText: string, projectsYaml: string) {
  writeFileSync(join(dir, 'about.md'), aboutText, 'utf-8');
  writeFileSync(join(dir, 'projects.yaml'), projectsYaml, 'utf-8');
}

const VALID_PROJECT_YAML = `
- slug: querypilot
  name: QueryPilot
  status: complete
  one_liner: Text-to-SQL LangGraph agent with AST-level safety gating.
  stack: [LangGraph, sqlglot]
  design_rationale: >
    Rejected regex validation and blind trust in the model in favor of
    parsing every generated statement into a sqlglot AST and gating
    destructive operations behind human confirmation.
  metrics:
    - label: Adversarial safety tests passed
      value: "40/40"
  talking_points:
    - q: Why sqlglot?
      a: Prompted safety is unenforceable; AST gating is.
`;

describe('runBuildKnowledge', () => {
  it('writes a valid knowledge.json when repo is omitted (no network call needed)', async () => {
    writeFixtures(FIXTURE_BIO, VALID_PROJECT_YAML);
    const outputPath = join(dir, 'knowledge.json');

    const result = await runBuildKnowledge({
      aboutPath: join(dir, 'about.md'),
      projectsPath: join(dir, 'projects.yaml'),
      outputPath,
      fetchFn: noopFetch,
    });

    expect(result.documents.map((d) => d.id)).toEqual(['doc:about', 'proj:querypilot']);
    expect(noopFetch).not.toHaveBeenCalled();

    const written = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(written.corpus_version).toBe(result.corpus_version);
  });

  it('fails when content/about.md is a placeholder', async () => {
    writeFixtures('TODO', VALID_PROJECT_YAML);
    await expect(
      runBuildKnowledge({
        aboutPath: join(dir, 'about.md'),
        projectsPath: join(dir, 'projects.yaml'),
        outputPath: join(dir, 'knowledge.json'),
        fetchFn: noopFetch,
      }),
    ).rejects.toThrow(/placeholder/);
  });

  it('fails when a project is missing design_rationale', async () => {
    const badYaml = VALID_PROJECT_YAML.replace(/design_rationale:[\s\S]*?talking_points:/, 'talking_points:');
    writeFixtures(FIXTURE_BIO, badYaml);
    await expect(
      runBuildKnowledge({
        aboutPath: join(dir, 'about.md'),
        projectsPath: join(dir, 'projects.yaml'),
        outputPath: join(dir, 'knowledge.json'),
        fetchFn: noopFetch,
      }),
    ).rejects.toThrow(/projects\.yaml failed validation/);
  });

  it('fails when a repo is declared but no GitHub token is provided', async () => {
    const yamlWithRepo = VALID_PROJECT_YAML.replace('name: QueryPilot', 'name: QueryPilot\n  repo: SpandanNagale/QueryPilot');
    writeFixtures(FIXTURE_BIO, yamlWithRepo);
    await expect(
      runBuildKnowledge({
        aboutPath: join(dir, 'about.md'),
        projectsPath: join(dir, 'projects.yaml'),
        outputPath: join(dir, 'knowledge.json'),
        fetchFn: noopFetch,
      }),
    ).rejects.toThrow(/GITHUB_TOKEN is required/);
  });

  it('propagates a not-found error when GitHub returns 404 for a declared repo', async () => {
    const yamlWithRepo = VALID_PROJECT_YAML.replace(
      'name: QueryPilot',
      'name: QueryPilot\n  repo: SpandanNagale/DoesNotExist',
    );
    writeFixtures(FIXTURE_BIO, yamlWithRepo);
    const notFoundFetch = vi.fn(async () => ({
      status: 404,
      ok: false,
      statusText: 'Not Found',
      json: async () => ({}),
    })) as unknown as FetchFn;
    await expect(
      runBuildKnowledge({
        aboutPath: join(dir, 'about.md'),
        projectsPath: join(dir, 'projects.yaml'),
        outputPath: join(dir, 'knowledge.json'),
        githubToken: 'fake-token',
        fetchFn: notFoundFetch,
      }),
    ).rejects.toThrow(/DoesNotExist/);
  });

  it('fails when the corpus exceeds the context-window budget', async () => {
    const hugeRationale = 'x'.repeat(400_000);
    const hugeYaml = VALID_PROJECT_YAML.replace(
      /design_rationale:[\s\S]*?metrics:/,
      `design_rationale: "${hugeRationale}"\n  metrics:`,
    );
    writeFixtures(FIXTURE_BIO, hugeYaml);
    await expect(
      runBuildKnowledge({
        aboutPath: join(dir, 'about.md'),
        projectsPath: join(dir, 'projects.yaml'),
        outputPath: join(dir, 'knowledge.json'),
        fetchFn: noopFetch,
      }),
    ).rejects.toThrow(/exceeds/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/knowledge/run.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

`scripts/knowledge/run.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ProjectsYamlSchema, type ProjectEntry } from './schema';
import {
  fetchRepoMeta,
  fetchLanguages,
  fetchReadme,
  fetchTree,
  fetchFileContent,
  type FetchFn,
} from './github';
import { buildCorpus, type EnrichedProject, type ProjectEnrichment, type KnowledgeBase } from './buildCorpus';
import { exceedsContextBudget, MODEL_CONTEXT_WINDOW_TOKENS, CONTEXT_WINDOW_BUDGET_RATIO } from './tokenEstimate';

const MIN_ABOUT_LENGTH = 200;

export interface BuildKnowledgeOptions {
  aboutPath: string;
  projectsPath: string;
  outputPath: string;
  githubToken?: string;
  fetchFn: FetchFn;
}

function readAbout(path: string): string {
  const raw = readFileSync(path, 'utf-8').trim();
  if (raw.length < MIN_ABOUT_LENGTH) {
    throw new Error(
      `content/about.md is empty or a placeholder (${raw.length} chars, need at least ${MIN_ABOUT_LENGTH}). Write Spandan's real bio before running build:knowledge.`,
    );
  }
  return raw;
}

function readProjects(path: string): ProjectEntry[] {
  const raw = readFileSync(path, 'utf-8');
  const parsed = parseYaml(raw);
  const result = ProjectsYamlSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`content/projects.yaml failed validation:\n${issues}`);
  }
  return result.data;
}

async function enrichProject(
  entry: ProjectEntry,
  token: string | undefined,
  fetchFn: FetchFn,
): Promise<EnrichedProject> {
  if (!entry.repo) {
    return { entry, enrichment: { meta: null, languages: null, tree: null, readme: null, keyFileContents: {} } };
  }
  if (!token) {
    throw new Error(`GITHUB_TOKEN is required to enrich "${entry.slug}" (repo: ${entry.repo}). Set it in .env.local.`);
  }

  const meta = await fetchRepoMeta(fetchFn, entry.repo, token);
  const [languages, tree, readme] = await Promise.all([
    fetchLanguages(fetchFn, entry.repo, token),
    fetchTree(fetchFn, entry.repo, meta.defaultBranch, token),
    fetchReadme(fetchFn, entry.repo, token),
  ]);

  const keyFileContents: Record<string, string> = {};
  for (const file of entry.key_files) {
    keyFileContents[file.path] = await fetchFileContent(fetchFn, entry.repo, file.path, token);
  }

  const enrichment: ProjectEnrichment = { meta, languages, tree, readme, keyFileContents };
  return { entry, enrichment };
}

export async function runBuildKnowledge(options: BuildKnowledgeOptions): Promise<KnowledgeBase> {
  const about = readAbout(options.aboutPath);
  const projectEntries = readProjects(options.projectsPath);

  const enrichedProjects: EnrichedProject[] = [];
  for (const entry of projectEntries) {
    enrichedProjects.push(await enrichProject(entry, options.githubToken, options.fetchFn));
  }

  const knowledgeBase = buildCorpus(about, enrichedProjects);

  if (exceedsContextBudget(knowledgeBase.token_estimate)) {
    const budget = Math.floor(MODEL_CONTEXT_WINDOW_TOKENS * CONTEXT_WINDOW_BUDGET_RATIO);
    throw new Error(
      `Corpus token_estimate (${knowledgeBase.token_estimate}) exceeds ${CONTEXT_WINDOW_BUDGET_RATIO * 100}% of the model context window (budget: ${budget} of ${MODEL_CONTEXT_WINDOW_TOKENS}). Trim content/projects.yaml or content/about.md.`,
    );
  }

  writeFileSync(options.outputPath, `${JSON.stringify(knowledgeBase, null, 2)}\n`, 'utf-8');
  return knowledgeBase;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/knowledge/run.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/run.ts scripts/knowledge/run.test.ts
git commit -m "feat: add build-knowledge orchestrator with injected fs/fetch paths"
```

---

### Task 7: CLI entry point

**Files:**
- Create: `scripts/build-knowledge.ts`

**Interfaces:**
- Consumes: `runBuildKnowledge` (Task 6).
- Produces: the `npm run build:knowledge` executable entry (wired to
  `package.json` in Task 1).

- [ ] **Step 1: Write the CLI wrapper**

`scripts/build-knowledge.ts` (no test file — this is a thin CLI shell with
no branching logic of its own; all its logic is already covered by
`run.test.ts`):

```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { runBuildKnowledge } from './knowledge/run';

const SCRIPTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(SCRIPTS_DIR, '..');

loadEnv({ path: resolve(ROOT, '.env.local') });

try {
  const knowledgeBase = await runBuildKnowledge({
    aboutPath: resolve(ROOT, 'content/about.md'),
    projectsPath: resolve(ROOT, 'content/projects.yaml'),
    outputPath: resolve(ROOT, 'public/knowledge.json'),
    githubToken: process.env.GITHUB_TOKEN,
    fetchFn: fetch,
  });

  console.log(
    `Wrote public/knowledge.json: ${knowledgeBase.documents.length} documents, ~${knowledgeBase.token_estimate} tokens, corpus_version ${knowledgeBase.corpus_version}.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
```

- [ ] **Step 2: Verify it fails correctly with no content/ yet**

Run: `npm run build:knowledge`
Expected: exits non-zero with `content/about.md is empty or a
placeholder` or an `ENOENT` reading `content/about.md` (Task 9 hasn't
created it yet — this confirms the fail-loudly behavior end to end before
real content exists).

- [ ] **Step 3: Commit**

```bash
git add scripts/build-knowledge.ts
git commit -m "feat: add build-knowledge CLI entry point"
```

---

### Task 8: Daily refresh GitHub Action

**Files:**
- Create: `.github/workflows/refresh-knowledge.yml`

**Interfaces:**
- Consumes: `npm run build:knowledge` (Task 1/7).
- Produces: a scheduled workflow other future tasks (Phase 4's eval gate)
  will extend.

- [ ] **Step 1: Write the workflow**

`.github/workflows/refresh-knowledge.yml`:

```yaml
name: Refresh knowledge base

on:
  schedule:
    - cron: '17 6 * * *'
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run build:knowledge
        env:
          GITHUB_TOKEN: ${{ secrets.KNOWLEDGE_GITHUB_TOKEN }}

      - name: Commit knowledge.json if changed
        id: commit
        run: |
          if ! git diff --quiet -- public/knowledge.json; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add public/knowledge.json
            git commit -m "chore: refresh knowledge base [skip ci]"
            git push
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Trigger Vercel deploy
        if: steps.commit.outputs.changed == 'true'
        run: curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
```

Note for Spandan: `secrets.KNOWLEDGE_GITHUB_TOKEN` and
`secrets.VERCEL_DEPLOY_HOOK_URL` need to be added under the repo's Settings
→ Secrets and variables → Actions before this workflow can run
successfully — that's a GitHub UI action, not something this plan can do
for you.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/refresh-knowledge.yml
git commit -m "ci: add daily knowledge-base refresh workflow"
```

---

### Task 9: Author real content and validate end-to-end (interactive — not a code task)

**This task must be run with Spandan directly in conversation.** Do not
dispatch it to a subagent with no context — every field here is something
only Spandan can supply, and the whole point of this pipeline is that
nothing here gets paraphrased from a README or invented.

**Files:**
- Create: `content/about.md`
- Create: `content/projects.yaml`

- [ ] **Step 1: Ask Spandan for `content/about.md`**

Ask for: bio (2-4 paragraphs), education, work history, current location,
availability (actively looking? open to relocation/remote?), and the
contact email/links he wants the assistant to point to on a refusal. Write
the answer verbatim (lightly formatted as markdown) to `content/about.md`.
Do not paraphrase or add facts he didn't state.

- [ ] **Step 2: Pre-fill machine-derivable fields for all 13 slugs**

For each of `keel`, `ml-agent`, `datasleuth`, `querypilot`, `docintel`,
`marathigpt`, `veritas`, `self-healing-rag`, `crewai-research-pipeline`,
`jarvis`, `contextlens`, `assay`, `sieve`: draft a `content/projects.yaml`
entry with `slug`, `name`, and `repo` (guess `SpandanNagale/<repo-name>`
from the slug, but confirm each one with Spandan rather than assuming) —
leave `status`, `one_liner`, `stack`, `design_rationale`, `metrics`,
`key_files`, `talking_points` as empty/TODO placeholders for now. Also
pre-fill known `live_url`s: `contextlens` →
`https://context-lense.vercel.app/`; ask Spandan which slug owns
`https://qpjzctwb6nntdeaedg6zzr.streamlit.app/` and set that project's
`live_url` accordingly (add a 14th entry if it's a project not in the list
above).

- [ ] **Step 3: Ask Spandan for the per-project fields, project by project**

For each of the 13 (14, if the Streamlit app is a new project) entries,
ask for: confirmed `repo` (or confirm it's private/nonexistent and should
be omitted), `status` (`complete`/`in-progress`/`archived` — spec says
`assay` is `archived`; ask about `sieve`), `one_liner`, `stack`,
`design_rationale` (3-6 sentences: what was hard, what was rejected and
why, the tradeoff — **never paraphrase the README into this field**), at
least one `metrics` entry if one exists, `key_files` (path + why, only if
there's a file whose content is worth pulling into the corpus), and at
least one `talking_points` Q&A. Write each answer into
`content/projects.yaml` as it's given — don't wait to collect all 13
before writing any.

- [ ] **Step 4: Set `GITHUB_TOKEN` locally**

Ask Spandan to put a GitHub personal access token (public repo read scope
is enough) into `.env.local` as `GITHUB_TOKEN=...` (create the file if it
doesn't exist — it's already git-ignored via the `*.local` rule).

- [ ] **Step 5: Run the pipeline end-to-end**

Run: `npm run build:knowledge`
Expected: exits 0, prints `Wrote public/knowledge.json: N documents,
~T tokens, corpus_version <hash>.` where N equals the number of projects
authored plus one (the about document).

- [ ] **Step 6: Spot-check the output**

Read `public/knowledge.json` and confirm: every `documents[].id` matches
either `doc:about` or `proj:<slug>` for a slug actually in
`content/projects.yaml`; no document contains an obvious placeholder
string like `TODO` or `TBD`; `token_estimate` is comfortably under the
60% budget printed by Task 3's constants.

- [ ] **Step 7: Commit**

```bash
git add content/about.md content/projects.yaml public/knowledge.json
git commit -m "content: author about.md and projects.yaml, generate initial knowledge.json"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 1's inputs, per-repo enrichment list, YAML
  schema, output shape, and three fail-conditions are each covered by a
  task (Tasks 2-7) plus the interactive content task (Task 9). The daily
  GitHub Action is Task 8, scoped to build+commit+deploy only — the eval
  step the spec eventually wants on this workflow is deferred to the
  Phase 4 plan, since `npm run eval` doesn't exist yet.
- **Placeholder scan:** no task step describes behavior without showing
  the code; Task 9 is intentionally step-by-step "ask" rather than code,
  which is correct for author-only content per the constraint.
- **Type consistency:** `KnowledgeDocument.id` format (`proj:<slug>` /
  `doc:about`) is defined once in Task 5 and referenced identically in
  Task 9's spot-check and in the spec's citation-token format — verified
  matching. `BuildKnowledgeOptions` fields match exactly between Task 6's
  definition and Task 7's call site.
