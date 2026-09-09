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
  enrichment: { meta: null, languages: null, readme: null, keyFileContents: {} },
};

const enrichedWithGithub: EnrichedProject = {
  entry,
  enrichment: {
    meta: { description: 'A text-to-SQL agent', stars: 5, pushedAt: '2026-01-01T00:00:00Z', defaultBranch: 'main' },
    languages: { Python: 8000, HTML: 200 },
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
