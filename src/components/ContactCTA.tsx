import { openAssistant } from '../lib/assistant';
import GlyphField from './GlyphField';

export default function ContactCTA({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-6 py-16 md:py-24 scroll-mt-20"
    >
      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[55%] opacity-50 md:opacity-100"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 45%)' }}
          aria-hidden="true"
        >
          <GlyphField mode="wave" reducedMotion={reducedMotion} className="w-full h-full" />
        </div>

        <div className="relative flex flex-col gap-10 p-6 py-14 md:p-14 lg:p-20">
          <p className="eyebrow">Contact</p>
          <h2 id="contact-title" className="display text-[clamp(44px,6.4vw,100px)]">
            <span className="block text-text">Let&apos;s build something</span>
            <span className="block text-dim">
              that <span className="text-outline">checks</span> its own work.
            </span>
          </h2>
          <div className="flex flex-wrap gap-3">
            <a href="mailto:spandan4844@gmail.com" className="pill">
              spandan4844@gmail.com <span className="arrow" aria-hidden="true">&rarr;</span>
            </a>
            <button type="button" onClick={openAssistant} aria-haspopup="dialog" className="pill-outline bg-panel">
              Ask about Spandan
            </button>
          </div>
          <p className="mono-label text-muted leading-relaxed max-w-xl">
            Open to AI/ML, GenAI &amp; agentic roles &middot; Bangalore / Pune / remote &middot; available now
          </p>
        </div>
      </div>
    </section>
  );
}
