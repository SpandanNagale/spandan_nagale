import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** `—— Label` mono eyebrow. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** Two-tone headline: first line in text colour, second in grey. */
export function SplitHeadline({
  first,
  second,
  id,
  className = '',
}: {
  first: ReactNode;
  second: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2 id={id} className={`display ${className || 'text-[clamp(40px,6vw,84px)]'}`}>
      <span className="block text-text">{first}</span>
      <span className="block text-dim">{second}</span>
    </h2>
  );
}

/** Fades children in once when scrolled into view. */
export function Reveal({
  children,
  reducedMotion,
  delay = 0,
  className,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  delay?: number;
  className?: string;
}) {
  if (reducedMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Infinite horizontal marquee. The moving track is aria-hidden; the same
 * content is exposed to screen readers as a static list. Reduced motion
 * (handled in CSS) stops the track and wraps a single copy. */
export function Marquee({
  items,
  srLabel,
  srItems,
  reverse = false,
  duration = 40,
  className = '',
}: {
  items: ReactNode[];
  srLabel: string;
  srItems: string[];
  reverse?: boolean;
  duration?: number;
  className?: string;
}) {
  return (
    <>
      <div
        className={`marquee ${reverse ? 'marquee-reverse' : ''} ${className}`}
        style={{ ['--marquee-duration' as string]: `${duration}s` }}
        aria-hidden="true"
      >
        <div className="marquee-track">
          {items.map((item, i) => (
            <div key={`a-${i}`} className="shrink-0">
              {item}
            </div>
          ))}
          {items.map((item, i) => (
            <div key={`b-${i}`} className="shrink-0 marquee-dup">
              {item}
            </div>
          ))}
        </div>
      </div>
      <ul className="sr-only" aria-label={srLabel}>
        {srItems.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </>
  );
}

export function SectionShell({
  id,
  labelledBy,
  children,
  className = '',
}: {
  id?: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative z-10 max-w-[1320px] mx-auto px-4 md:px-6 py-24 md:py-32 scroll-mt-20 ${className}`}
    >
      {children}
    </section>
  );
}
