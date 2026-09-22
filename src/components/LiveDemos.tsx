const LIVE_DEMOS = [
  { name: 'ContextLens', url: 'https://context-lense.vercel.app/' },
  { name: 'QueryPilot', url: 'https://query-pilot-nine.vercel.app/' },
  { name: 'CrewAI Research Pipeline', url: 'https://research-pipeline-frontend.vercel.app/' },
  { name: 'Keel', url: 'https://qpjzctwb6nntdeaedg6zzr.streamlit.app/' },
];

export default function LiveDemos() {
  return (
    <section id="live" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
      <p className="mono-label text-muted mb-8">LIVE DEMOS</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LIVE_DEMOS.map((d) => (
          <a
            key={d.url}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 p-4 bg-panel border border-line hover:border-flow transition-colors"
            style={{ borderRadius: 2 }}
          >
            <span className="font-display text-text">{d.name}</span>
            <span className="mono-label text-flow shrink-0">OPEN &rarr;</span>
          </a>
        ))}
      </div>
    </section>
  );
}
