import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { Project } from '../types';
import WorkflowDiagram from './WorkflowDiagram';
import { useLockScroll } from '../hooks/useLockScroll';

interface SystemModalProps {
  project: Project;
  onClose: () => void;
  reducedMotion: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function SystemModal({ project, onClose, reducedMotion }: SystemModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useLockScroll(true);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ background: 'color-mix(in srgb, var(--void) 85%, transparent)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={containerRef}
        layoutId={`card-${project.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-title-${project.id}`}
        className="relative w-full max-w-[1000px] max-h-[90vh] overflow-y-auto bg-panel border border-line p-8 md:p-10"
        style={{ borderRadius: 2 }}
        transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-6 right-6 md:top-8 md:right-8 w-9 h-9 flex items-center justify-center border border-line text-muted hover:text-flow hover:border-flow transition-colors"
          style={{ borderRadius: 2 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        <div className="flex flex-col gap-8 pr-10">
          <div className="flex flex-col gap-3">
            <h2 id={`modal-title-${project.id}`} className="font-display text-3xl md:text-4xl text-text">
              {project.name}
            </h2>
            <p className="text-muted text-base leading-relaxed max-w-2xl">{project.tagline}</p>
          </div>

          <WorkflowDiagram project={project} play reducedMotion={reducedMotion} />

          <div className="flex flex-col gap-3 max-w-3xl">
            <p className="mono-label text-muted">HOW IT WORKS</p>
            <p className="text-text leading-relaxed">{project.howItWorks}</p>
          </div>

          <div className="flex flex-col gap-3 max-w-3xl">
            <p className="mono-label text-muted">HIGHLIGHTS</p>
            <ul className="flex flex-col gap-2">
              {project.highlights.map((h) => (
                <li key={h} className="text-text leading-relaxed flex gap-3">
                  <span className="text-flow mt-1 shrink-0" aria-hidden="true">
                    &bull;
                  </span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4 py-4 border-y border-line">
            {project.metrics.map((m) => (
              <div key={m.label} className="flex flex-col gap-1">
                <span className="font-display text-2xl text-flow">{m.value}</span>
                <span className="mono-label text-muted">{m.label}</span>
              </div>
            ))}
          </div>

          {project.evalMethodologyUrl && (
            <p className="mono-label text-muted -mt-4">
              The eval writeup is honest about how 100% was reached.{' '}
              <a
                href={project.evalMethodologyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-flow hover:underline underline-offset-4"
              >
                EVAL METHODOLOGY &rarr;
              </a>
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {project.stack.map((item) => (
              <span key={item} className="mono-label text-muted">
                {item}
              </span>
            ))}
          </div>

          <a
            href={project.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="mono-label text-flow hover:underline underline-offset-4 w-fit"
          >
            VIEW ON GITHUB &rarr;
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
