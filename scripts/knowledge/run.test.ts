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
