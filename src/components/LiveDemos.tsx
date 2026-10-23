import keelImg from '../assets/live/keel.png';
import queryPilotImg from '../assets/live/querypilot.png';
import researchPipelineImg from '../assets/live/research-pipeline.png';
import { Eyebrow, Reveal, SectionShell, SplitHeadline } from './ui';

interface LiveDemo {
  name: string;
  url: string;
  tagline: string;
  stack: string[];
  image?: string;
}

const LIVE_DEMOS: LiveDemo[] = [
  {
    name: 'ContextLens',
    url: 'https://context-lense.vercel.app/',
    tagline: 'Measures how context-window size affects answer quality when querying a codebase.',
    stack: ['Next.js 15', 'TypeScript', 'Groq', 'GitHub API'],
  },
  {
    name: 'QueryPilot',
    url: 'https://query-pilot-nine.vercel.app/',
    tagline:
      'Text-to-SQL agent built so it cannot quietly destroy your database — every destructive query is parsed, validated, and previewed before a human approves it.',
    stack: ['LangGraph', 'sqlglot', 'Ollama', 'SQLite'],
    image: queryPilotImg,
  },
  {
    name: 'CrewAI Research Pipeline',
    url: 'https://research-pipeline-frontend.vercel.app/',
    tagline: 'A four-agent research crew that plans, gathers, drafts, and judges its own output before it reaches you.',
    stack: ['CrewAI', 'ChromaDB', 'Ollama', 'FastAPI'],
    image: researchPipelineImg,
  },
  {
    name: 'Keel',
    url: 'https://qpjzctwb6nntdeaedg6zzr.streamlit.app/',
    tagline: 'Turns a vague one-line project idea into a rigorous spec by interrogating what it leaves unstated.',
    stack: ['Streamlit', 'Python', 'Ollama Cloud'],
    image: keelImg,
  },
];

/** ContextLens has no screenshot on hand — an illustrative placeholder
 * standing in for one, styled after what the tool actually measures
 * (answer quality dropping as context grows), not a fake UI. */
function ContextLensPlaceholder() {
  const bars = [92, 84, 71, 58, 44];
  return (
    <svg viewBox="0 0 400 225" className="w-full h-full" aria-hidden="true">
      <rect width="400" height="225" fill="var(--void)" />
      {[60, 100, 140].map((y) => (
        <line key={y} x1="20" y1={y} x2="380" y2={y} stroke="var(--line)" strokeWidth="1" />
      ))}
      {bars.map((h, i) => (
        <rect
          key={i}
          x={40 + i * 68}
          y={190 - h * 1.4}
          width={40}
          height={h * 1.4}
          fill={i < 2 ? 'var(--flow)' : i < 3 ? 'var(--gate)' : 'var(--fault)'}
          opacity={0.18 + (bars.length - i) * 0.04}
          stroke={i < 2 ? 'var(--flow)' : i < 3 ? 'var(--gate)' : 'var(--fault)'}
          strokeWidth="1"
        />
      ))}
      <line x1="20" y1="190" x2="380" y2="190" stroke="var(--text)" strokeWidth="1" />
      <text x="20" y="212" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">
        CONTEXT SIZE &rarr;
      </text>
      <text x="20" y="30" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">
        ANSWER QUALITY
      </text>
    </svg>
  );
}

export default function LiveDemos({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <SectionShell id="live" labelledBy="live-title">
      <div className="flex flex-col gap-8 mb-14 md:mb-20">
        <Eyebrow>Live</Eyebrow>
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,380px)] lg:items-end">
          <SplitHeadline id="live-title" first="Shipped and" second="reachable." />
          <p className="text-muted leading-relaxed">
            {LIVE_DEMOS.length} projects deployed right now &mdash; click through and use them directly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {LIVE_DEMOS.map((d, i) => (
          <Reveal key={d.url} reducedMotion={reducedMotion} delay={(i % 2) * 0.06}>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col h-full rounded-xl bg-panel border border-line hover:border-line-strong transition-colors overflow-hidden"
            >
              <div className="p-2 pb-0">
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-line bg-void">
                  {d.image ? (
                    <img
                      src={d.image}
                      alt={`${d.name} interface`}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <ContextLensPlaceholder />
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 p-5 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="display text-2xl text-text">{d.name}</span>
                  <span className="mono-label text-muted flex items-center gap-2 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-flow" aria-hidden="true" />
                    live
                  </span>
                </div>
                <p className="text-sm text-muted leading-relaxed">{d.tagline}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {d.stack.map((s) => (
                      <span key={s} className="tag">
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="mono-label text-text group-hover:text-flow transition-colors">
                    OPEN <span aria-hidden="true">&rarr;</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </div>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
