import { useState } from 'react';
import { RESUME_URL } from '../data/projects';
import HeroGraph from './HeroGraph';

export default function Hero() {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <section className="relative z-10 min-h-screen flex flex-col justify-between px-6 max-w-6xl mx-auto">
      <HeroGraph />
      <div className="flex-1 flex flex-col justify-center gap-6 pt-24">
        <p className="mono-label text-muted">4 SYSTEMS / MULTI-AGENT / LOCAL-FIRST</p>
        <h1 className="font-display text-text text-5xl md:text-7xl leading-[1.05] tracking-[-0.02em] max-w-3xl">
          Agents that check
          <br />
          their own work.
        </h1>
        <p className="text-muted text-lg md:text-xl max-w-xl leading-relaxed">
          I build multi-agent systems that plan, write code, execute it, and catch themselves
          when they&apos;re wrong &mdash; running entirely on local hardware.
        </p>
        <p className="mono-label text-flow">
          RTX 5070 &middot; Ryzen 7 9800X3D &middot; 64GB &middot; Ollama
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 pb-12">
        {photoFailed ? (
          <div
            className="w-[72px] h-[72px] rounded-full border border-line flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="font-mono text-sm text-muted">SN</span>
          </div>
        ) : (
          <img
            src="/profile.jpg"
            alt="Spandan Nagale"
            width={72}
            height={72}
            className="w-[72px] h-[72px] rounded-full object-cover border border-line shrink-0"
            onError={() => setPhotoFailed(true)}
          />
        )}
        <div className="flex flex-col gap-1">
          <span className="font-display text-text text-base">Spandan Nagale</span>
          <span className="mono-label text-muted">AI/ML ENGINEER &middot; PUNE, INDIA</span>
        </div>
        <a
          href={RESUME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mono-label text-flow hover:underline underline-offset-4 ml-0 md:ml-6"
        >
          VIEW RESUME &rarr;
        </a>
      </div>
    </section>
  );
}
