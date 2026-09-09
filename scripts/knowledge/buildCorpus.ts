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
