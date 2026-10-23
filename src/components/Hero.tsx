import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { projects, RESUME_URL } from '../data/projects';
import GlyphField from './GlyphField';

const VERBS = ['check', 'verify', 'repair', 'grade'];
const CYCLE_MS = 2600;

function CyclingVerb({ reducedMotion }: { reducedMotion: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % VERBS.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const word = reducedMotion ? VERBS[0] : VERBS[i];

  return (
    <span className="relative inline-block align-baseline">
      {/* Widest word reserves the space so the line never reflows. */}
      <span className="accent invisible">verify</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={word}
          className="accent absolute left-0 top-0"
          initial={{ opacity: 0, y: '0.18em', filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-0.18em', filter: 'blur(8px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function Hero({ reducedMotion }: { reducedMotion: boolean }) {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative z-10 md:min-h-[100svh] flex flex-col justify-between px-4 md:px-6 max-w-[1320px] mx-auto pt-28 md:pt-36 pb-12 overflow-x-clip"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-20 h-[90vw] max-h-[520px] opacity-25 md:opacity-100 md:max-h-none md:inset-x-auto md:h-auto md:top-[54%] md:-translate-y-1/2 md:right-0 md:w-[min(44vw,620px)] md:aspect-square"
        aria-hidden="true"
      >
        <GlyphField mode="sphere" reducedMotion={reducedMotion} className="w-full h-full" />
      </div>

      <div className="relative flex flex-col gap-8">
        <p className="eyebrow">
          {projects.length} SYSTEMS / MULTI-AGENT / LOCAL-FIRST
        </p>
        <h1
          id="hero-title"
          className="display text-[clamp(56px,10vw,152px)] max-w-[11ch] md:max-w-none"
        >
          <span className="sr-only">Agents that check their own work.</span>
          <span aria-hidden="true">
            <span className="block text-text">
              Agents that <CyclingVerb reducedMotion={reducedMotion} />
            </span>
            <span className="block text-dim">their own work.</span>
          </span>
        </h1>
      </div>

      <div className="relative grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-end mt-12">
        <div className="flex flex-col gap-5 max-w-xl">
          <p className="text-muted text-lg md:text-xl leading-relaxed">
            I build multi-agent systems that plan, write code, execute it, and catch themselves
            when they&apos;re wrong &mdash; running entirely on local hardware.
          </p>
          <p className="mono-label text-muted flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-flow shrink-0" aria-hidden="true" />
            RTX 5070 &middot; Ryzen 7 9800X3D &middot; 64GB &middot; Ollama
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <a href="#systems" className="pill">
              See the systems <span className="arrow" aria-hidden="true">&rarr;</span>
            </a>
            <a href={RESUME_URL} target="_blank" rel="noopener noreferrer" className="pill-outline">
              Résumé <span className="arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4 md:justify-end">
          {photoFailed ? (
            <div
              className="w-14 h-14 rounded-full border border-line bg-panel flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span className="font-mono text-sm text-muted">SN</span>
            </div>
          ) : (
            <img
              src="/profile.jpg"
              alt="Spandan Nagale"
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover border border-line shrink-0"
              onError={() => setPhotoFailed(true)}
            />
          )}
          <div className="flex flex-col gap-1">
            <span className="text-text text-base">Spandan Nagale</span>
            <span className="mono-label text-muted">AI/ML ENGINEER &middot; BANGALORE, INDIA</span>
          </div>
        </div>
      </div>
    </section>
  );
}
