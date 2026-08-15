import type { Project } from '../types';
import SystemCard from './SystemCard';

interface SystemGridProps {
  projects: Project[];
  onOpen: (id: string) => void;
  reducedMotion: boolean;
}

export default function SystemGrid({ projects, onOpen, reducedMotion }: SystemGridProps) {
  return (
    <section id="systems" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
      <p className="mono-label text-muted mb-8">SELECTED SYSTEMS</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <SystemCard
            key={project.id}
            project={project}
            onOpen={onOpen}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </section>
  );
}
