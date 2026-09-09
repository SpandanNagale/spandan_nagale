import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const SCRIPTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(SCRIPTS_DIR, '..');

loadEnv({ path: resolve(ROOT, '.env.local') });

const { runBuildKnowledge } = await import('./knowledge/run.js');

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
