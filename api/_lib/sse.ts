// Server-Sent Events framing + citation-token extraction.
// Event types the browser consumes: token | citation | telemetry | done | error.

export const CITATION_RE = /\[\[(proj:[a-z0-9-]+|doc:about)\]\]/g;

export function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Distinct citation ids present in `text`, in first-seen order. Safe to call
 * on the growing accumulated answer after each token — the caller dedupes
 * against what it has already emitted. */
export function extractCitations(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(CITATION_RE)) seen.add(m[1]);
  return [...seen];
}
