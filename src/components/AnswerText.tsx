import { Fragment, useMemo, type ReactNode } from 'react';
import CitationChip from './CitationChip';
import { parseCitations, stripCitationTokens, stripUncitedClaims } from '../lib/citations';

interface AnswerTextProps {
  /** Raw model text, citation tokens intact. */
  text: string;
  /** True once the stream has closed — enables the un-cited-claim filter. */
  settled: boolean;
}

// Drop a citation token that is still mid-stream (e.g. "[[proj:quer").
const DANGLING_TOKEN = /(?:\[\[?|【)[a-z:]*$/;

// Minimal inline markdown: **bold** and `code`. The model emits these; a full
// markdown renderer would be overkill for 2-4 short paragraphs.
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-text font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="font-mono text-[0.85em] text-flow">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function AnswerText({ text, settled }: AnswerTextProps) {
  const { paragraphs, citations, removedCount } = useMemo(() => {
    const filtered = settled ? stripUncitedClaims(text) : { text, removed: [] as string[] };
    const cites = parseCitations(filtered.text);
    const body = stripCitationTokens(filtered.text).replace(DANGLING_TOKEN, '').trimEnd();
    return {
      paragraphs: body.split(/\n{2,}/).filter((p) => p.trim().length > 0),
      citations: cites,
      removedCount: filtered.removed.length,
    };
  }, [text, settled]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 text-text leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(p)}
            {!settled && i === paragraphs.length - 1 && (
              <span className="text-flow animate-pulse">&#9611;</span>
            )}
          </p>
        ))}
        {!settled && paragraphs.length === 0 && (
          <span className="text-flow animate-pulse">&#9611;</span>
        )}
      </div>

      {citations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="mono-label text-muted">SOURCES</span>
          <div className="flex flex-wrap gap-2">
            {citations.map((id) => (
              <CitationChip key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      {settled && removedCount > 0 && (
        <p className="mono-label text-muted">
          {removedCount} uncited {removedCount === 1 ? 'statement' : 'statements'} hidden by the
          grounding filter
        </p>
      )}
    </div>
  );
}
