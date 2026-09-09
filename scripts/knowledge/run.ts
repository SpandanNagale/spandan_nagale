import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ProjectsYamlSchema, type ProjectEntry } from './schema';
import {
  fetchRepoMeta,
  fetchLanguages,
  fetchReadme,
  fetchFileContent,
  type FetchFn,
} from './github';
import { buildCorpus, type EnrichedProject, type ProjectEnrichment, type KnowledgeBase } from './buildCorpus';
import { exceedsContextBudget, getModelContextWindowTokens, CONTEXT_WINDOW_BUDGET_RATIO } from './tokenEstimate';

// A floor against an empty or one-line placeholder file — not a real content-quality check. A human authors this file, so this is a cheap guard, not validation.
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
    return { entry, enrichment: { meta: null, languages: null, readme: null, keyFileContents: {} } };
  }
  if (!token) {
    throw new Error(`GITHUB_TOKEN is required to enrich "${entry.slug}" (repo: ${entry.repo}). Set it in .env.local.`);
  }

  const meta = await fetchRepoMeta(fetchFn, entry.repo, token);
  const [languages, readme] = await Promise.all([
    fetchLanguages(fetchFn, entry.repo, token),
    fetchReadme(fetchFn, entry.repo, token),
  ]);

  const keyFileContents: Record<string, string> = {};
  for (const file of entry.key_files) {
    keyFileContents[file.path] = await fetchFileContent(fetchFn, entry.repo, file.path, token);
  }

  const enrichment: ProjectEnrichment = { meta, languages, readme, keyFileContents };
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
    const contextWindow = getModelContextWindowTokens();
    const budget = Math.floor(contextWindow * CONTEXT_WINDOW_BUDGET_RATIO);
    throw new Error(
      `Corpus token_estimate (${knowledgeBase.token_estimate}) exceeds ${CONTEXT_WINDOW_BUDGET_RATIO * 100}% of the model context window (budget: ${budget} of ${contextWindow}). Trim content/projects.yaml or content/about.md.`,
    );
  }

  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(knowledgeBase, null, 2)}\n`, 'utf-8');
  return knowledgeBase;
}
