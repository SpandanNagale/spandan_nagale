import keelImg from '../assets/live/keel.png';
import queryPilotImg from '../assets/live/querypilot.png';
import researchPipelineImg from '../assets/live/research-pipeline.png';

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
      {bars.map((h, i) => (
        <rect
          key={i}
          x={40 + i * 68}
          y={190 - h * 1.4}
          width={40}
          height={h * 1.4}
          fill={i < 2 ? 'var(--flow)' : i < 3 ? 'var(--gate)' : 'var(--fault)'}
          opacity={0.85}
        />
      ))}
      <line x1="20" y1="190" x2="380" y2="190" stroke="var(--line)" strokeWidth="1" />
    </svg>
  );
}

export default function LiveDemos() {
  return (
    <section id="live" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
      <p className="mono-label text-muted mb-2">LIVE DEMOS</p>
      <p className="text-sm text-muted mb-8 max-w-2xl">
        Four projects deployed and reachable right now — click through to use them directly.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LIVE_DEMOS.map((d) => (
          <a
            key={d.url}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col bg-panel border border-line hover:border-flow transition-colors overflow-hidden"
            style={{ borderRadius: 2 }}
          >
            <div className="aspect-video w-full overflow-hidden border-b border-line bg-void">
              {d.image ? (
                <img
                  src={d.image}
                  alt={`${d.name} interface`}
                  className="w-full h-full object-cover object-top grayscale-[30%] group-hover:grayscale-0 transition-[filter]"
                  loading="lazy"
                />
              ) : (
                <ContextLensPlaceholder />
              )}
            </div>
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-text">{d.name}</span>
                <span className="mono-label text-flow shrink-0">OPEN &rarr;</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">{d.tagline}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {d.stack.map((s) => (
                  <span key={s} className="mono-label text-muted">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
