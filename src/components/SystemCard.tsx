import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Project } from '../types';
import MiniGraph from './MiniGraph';

interface SystemCardProps {
  project: Project;
  onOpen: (id: string) => void;
  reducedMotion: boolean;
}

export default function SystemCard({ project, onOpen, reducedMotion }: SystemCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      type="button"
      id={`card-${project.id}`}
      layoutId={`card-${project.id}`}
      onClick={() => onOpen(project.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative flex flex-col gap-4 text-left p-6 bg-panel border border-line rounded-sm transition-colors hover:border-flow focus-visible:border-flow"
      style={{ borderRadius: 2 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-xl text-text">{project.name}</h3>
        <p className="text-sm text-muted leading-relaxed">{project.tagline}</p>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {project.stack.map((item) => (
          <span key={item} className="mono-label text-muted">
            {item}
          </span>
        ))}
      </div>

      <MiniGraph
        nodes={project.nodes}
        edges={project.edges}
        active={hovered}
        reducedMotion={reducedMotion}
      />

      <span className="mono-label text-flow self-end">OPEN &rarr;</span>
    </motion.button>
  );
}
