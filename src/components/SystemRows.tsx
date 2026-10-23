import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Project } from '../types';
import MiniGraph from './MiniGraph';
import { Eyebrow, Reveal, SectionShell, SplitHeadline } from './ui';

interface SystemRowsProps {
  projects: Project[];
  onOpen: (id: string) => void;
  reducedMotion: boolean;
}

function SystemRow({
  project,
  index,
  onOpen,
  reducedMotion,
}: {
  project: Project;
  index: number;
  onOpen: (id: string) => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);

  return (
    <motion.button
      type="button"
      // id + layoutId are load-bearing: citation chips scroll to `card-<id>`
      // and SystemModal morphs out of the matching layoutId.
      id={`card-${project.id}`}
      layoutId={`card-${project.id}`}
      onClick={() => onOpen(project.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onViewportEnter={() => setInView(true)}
      onViewportLeave={() => setInView(false)}
      viewport={{ amount: 0.6 }}
      className="group relative grid w-full grid-cols-1 md:grid-cols-[4rem_1fr_minmax(220px,320px)] gap-x-8 gap-y-5 items-center text-left py-8 md:py-10 border-t border-line bg-void transition-colors hover:bg-panel focus-visible:bg-panel px-1 md:px-4"
    >
      <span className="mono-label text-muted md:self-start md:pt-2">{String(index + 1).padStart(2, '0')}</span>

      <div className="flex flex-col gap-3 min-w-0">
        <h3 className="display text-3xl md:text-5xl text-text flex items-baseline gap-3">
          {project.name}
          <span
            className="text-lg text-muted opacity-0 -translate-x-1 transition-[opacity,transform] group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100"
            aria-hidden="true"
          >
            &rarr;
          </span>
        </h3>
        <p className="text-muted leading-relaxed max-w-2xl">{project.tagline}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {project.stack.map((item) => (
            <span key={item} className="tag">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <MiniGraph
          nodes={project.nodes}
          edges={project.edges}
          active={hovered || inView}
          reducedMotion={reducedMotion}
          className="w-full h-14"
        />
        <span className="mono-label text-muted self-end group-hover:text-flow transition-colors">
          {project.nodes.filter((n) => n.kind !== 'terminal').length} NODES &middot; OPEN
        </span>
      </div>
    </motion.button>
  );
}

export default function SystemRows({ projects, onOpen, reducedMotion }: SystemRowsProps) {
  return (
    <SectionShell id="systems" labelledBy="systems-title">
      <div className="flex flex-col gap-8 mb-14 md:mb-20">
        <div className="flex flex-col gap-6">
          <Eyebrow>Selected systems</Eyebrow>
          <SplitHeadline id="systems-title" first="Everything verified." second="Nothing taken on trust." />
        </div>
        <p className="text-muted leading-relaxed max-w-md md:ml-auto">
          Each system has a stage whose only job is to doubt the one before it. Open any row for the
          full graph, the guardrails, and how it was evaluated.
        </p>
      </div>

      <div className="border-b border-line">
        {projects.map((project, i) => (
          <Reveal key={project.id} reducedMotion={reducedMotion} delay={i * 0.05}>
            <SystemRow project={project} index={i} onOpen={onOpen} reducedMotion={reducedMotion} />
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
