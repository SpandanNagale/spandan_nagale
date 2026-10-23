import { Eyebrow, Reveal, SectionShell } from './ui';

const BULLETS = [
  'Designed and shipped production ML components — RAG pipelines and multi-modal assistants — through FastAPI and Streamlit backends, owning the full technical scope independently.',
  'Built an automated evaluation system for scoring LLM output quality across multiple dimensions, plus privacy-conscious retrieval combining vector search with knowledge-graph techniques.',
  'Replaced synchronous inference delays with real-time token generation by adding Server-Sent Events streaming to production endpoints.',
];

export default function Experience({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <SectionShell id="experience" labelledBy="experience-title">
      <Eyebrow className="mb-10 md:mb-14">Experience</Eyebrow>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-16">
        <div className="flex flex-col gap-10">
          <h2 id="experience-title" className="display text-[clamp(36px,5vw,72px)] text-text">
            ML Developer at Qriocity Ventures.{' '}
            <span className="text-dim">Five months, eight production systems, owned end to end.</span>
          </h2>
          <div className="flex flex-col gap-1">
            <span className="mono-label text-muted">DEC 2025 &ndash; MAY 2026 &middot; REMOTE</span>
          </div>
          <ul className="grid gap-6 md:grid-cols-3 border-t border-line pt-8">
            {BULLETS.map((bullet, i) => (
              <li key={bullet} className="flex flex-col gap-3">
                <span className="mono-label text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm text-muted leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <Reveal reducedMotion={reducedMotion} className="lg:pt-2">
          <div className="rounded-xl border border-line bg-panel p-6 md:p-8 flex flex-col gap-6">
            <span className="mono-label text-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-flow" aria-hidden="true" />
              Key result
            </span>
            <span className="display text-[96px] md:text-[120px] text-text">8</span>
            <p className="text-lg text-text leading-snug">production GenAI/ML systems shipped</p>
          </div>
        </Reveal>
      </div>

      <div className="mt-14 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="mono-label text-muted">Education</span>
        <span className="text-sm text-text">
          B.Tech, Information Technology (AI/ML) &middot; DBATU, Lonere &middot;{' '}
          <span className="text-muted">2022&ndash;2026</span>
        </span>
      </div>
    </SectionShell>
  );
}
