import { projects } from '../data/projects';
import { Marquee } from './ui';

interface Proof {
  value: string;
  label: string;
  source: string;
}

// Only numeric metrics read as proof; labels like "SSE · STREAMING" don't.
const PROOFS: Proof[] = [
  ...projects.flatMap((p) =>
    p.metrics.filter((m) => /\d/.test(m.value)).map((m) => ({ value: m.value, label: m.label, source: p.name })),
  ),
  { value: 'RTX 5070', label: 'RYZEN 7 9800X3D · 64GB', source: 'The workstation' },
];

export default function ProofMarquee() {
  return (
    <section aria-label="Proof points" className="relative z-10 border-y border-line bg-panel/60 py-8">
      <Marquee
        duration={55}
        srLabel="Proof points from the systems below"
        srItems={PROOFS.map((p) => `${p.value} ${p.label.toLowerCase()} — ${p.source}`)}
        items={PROOFS.map((p) => (
          <div key={`${p.source}-${p.label}`} className="flex flex-col gap-2 px-10 border-l border-line min-w-[220px]">
            <span className="display text-5xl md:text-6xl text-text">{p.value}</span>
            <span className="mono-label text-muted">{p.label}</span>
            <span className="text-sm text-muted">{p.source}</span>
          </div>
        ))}
      />
    </section>
  );
}
