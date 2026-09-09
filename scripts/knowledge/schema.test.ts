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

  it('allows zero talking_points (not every project has one yet)', () => {
    expect(() => ProjectEntrySchema.parse({ ...validEntry, talking_points: [] })).not.toThrow();
  });

  it('rejects a malformed repo string', () => {
    expect(() => ProjectEntrySchema.parse({ ...validEntry, repo: 'not-a-repo-path' })).toThrow();
  });

  it('allows repo to be omitted for private/nonexistent repos', () => {
    const { repo, ...rest } = validEntry;
    expect(() => ProjectEntrySchema.parse(rest)).not.toThrow();
  });

  it('defaults metrics, key_files, and talking_points to empty arrays when omitted', () => {
    const { metrics, key_files, talking_points, ...rest } = validEntry;
    const parsed = ProjectEntrySchema.parse(rest);
    expect(parsed.metrics).toEqual([]);
    expect(parsed.key_files).toEqual([]);
    expect(parsed.talking_points).toEqual([]);
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
