// Where a citation chip points. Keyed by the citation id the assistant emits
// ([[proj:<slug>]] / [[doc:about]]).
//
// Four projects have a visual card on this page (see src/data/projects.ts) —
// their chips scroll to and flash that card. The rest have no card, so their
// chips open the repo (or the live deployment) in a new tab. `doc:about`
// scrolls to the Experience section.
//
// This is a small hand-maintained index, not derived from knowledge.json:
// the corpus is ~180 KB and has no structured repo/live fields, and only
// these 14 ids can ever be cited. Keep it in sync with content/projects.yaml.

export interface CitationTarget {
  /** Human label shown in the chip and its title attribute. */
  label: string;
  /** DOM id of an on-page project card to scroll to, if one exists. */
  cardId?: string;
  /** External URL to open when there is no card. */
  href?: string;
}

export const CITATION_TARGETS: Record<string, CitationTarget> = {
  'doc:about': { label: 'About Spandan', cardId: 'experience' },

  // --- has a card on the page ---
  'proj:datasleuth': { label: 'DataSleuth', cardId: 'card-datasleuth' },
  'proj:querypilot': { label: 'QueryPilot', cardId: 'card-querypilot' },
  'proj:crewai-research-pipeline': {
    label: 'CrewAI Research Pipeline',
    cardId: 'card-crewai-research-pipeline',
  },
  'proj:ml-agent': { label: 'ML Agent', cardId: 'card-ml-agent' },

  // --- no card: link out ---
  'proj:keel': { label: 'Keel', href: 'https://qpjzctwb6nntdeaedg6zzr.streamlit.app' },
  'proj:docintel': { label: 'DocIntel', href: 'https://github.com/SpandanNagale/DocIntel' },
  'proj:marathigpt': { label: 'MarathiGPT', href: 'https://github.com/SpandanNagale/Marathi-GPT' },
  'proj:veritas': { label: 'Veritas', href: 'https://github.com/SpandanNagale/Veritas' },
  'proj:self-healing-rag': {
    label: 'Self-Healing Hybrid RAG',
    href: 'https://github.com/SpandanNagale/self-healing-rag',
  },
  'proj:jarvis': { label: 'JARVIS', href: 'https://github.com/SpandanNagale/JARVIS' },
  'proj:contextlens': { label: 'ContextLens', href: 'https://context-lense.vercel.app' },
  'proj:assay': { label: 'Assay', href: 'https://github.com/SpandanNagale/Assay' },
  'proj:sieve': { label: 'Sieve', href: 'https://github.com/SpandanNagale/Sieve' },
};

export function citationTarget(id: string): CitationTarget {
  return CITATION_TARGETS[id] ?? { label: id.replace(/^proj:/, '').replace(/-/g, ' ') };
}
