import { citationTarget } from '../data/citationTargets';

interface CitationChipProps {
  id: string;
}

function flashCard(el: HTMLElement) {
  el.classList.add('citation-flash');
  window.setTimeout(() => el.classList.remove('citation-flash'), 1400);
}

/**
 * A single source chip. If the cited project has a card on the page, the chip
 * is a button that scrolls to and flashes it; otherwise it's a link out to
 * the repo or live deployment.
 */
export default function CitationChip({ id }: CitationChipProps) {
  const target = citationTarget(id);
  const base =
    'mono-label inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-1 text-text ' +
    'transition-colors hover:border-flow hover:text-flow focus-visible:border-flow';

  const cardId = target.cardId;
  if (cardId) {
    return (
      <button
        type="button"
        className={base}
        title={`Jump to ${target.label}`}
        onClick={() => {
          const el = document.getElementById(cardId);
          if (!el) return;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          flashCard(el);
        }}
      >
        {target.label}
        <span aria-hidden="true">&darr;</span>
      </button>
    );
  }

  return (
    <a
      className={base}
      href={target.href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${target.label}`}
    >
      {target.label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
