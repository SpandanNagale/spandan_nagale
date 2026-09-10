const BULLETS = [
  'Designed and shipped production ML components — RAG pipelines and multi-modal assistants — through FastAPI and Streamlit backends, owning the full technical scope independently.',
  'Built an automated evaluation system for scoring LLM output quality across multiple dimensions, plus privacy-conscious retrieval combining vector search with knowledge-graph techniques.',
  'Replaced synchronous inference delays with real-time token generation by adding Server-Sent Events streaming to production endpoints.',
];

export default function Experience() {
  return (
    <section id="experience" className="relative z-10 max-w-6xl mx-auto px-6 py-16 scroll-mt-24">
      <p className="mono-label text-muted mb-8">EXPERIENCE</p>
      <div className="flex flex-col gap-3 max-w-2xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-xl text-text">ML Developer &mdash; Qriocity Ventures</h3>
          <p className="mono-label text-muted">DEC 2025 &ndash; MAY 2026</p>
        </div>
        <p className="text-text leading-relaxed">Shipped eight production GenAI/ML systems across the internship.</p>
        <ul className="flex flex-col gap-2 mt-1">
          {BULLETS.map((bullet) => (
            <li key={bullet} className="text-muted leading-relaxed flex gap-3">
              <span className="mt-1 shrink-0" aria-hidden="true">
                &bull;
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
