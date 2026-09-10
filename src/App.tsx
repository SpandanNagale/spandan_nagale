import { AnimatePresence } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import AgentCanvas from './components/AgentCanvas';
import Hero from './components/Hero';
import SystemGrid from './components/SystemGrid';
import SystemModal from './components/SystemModal';
import Experience from './components/Experience';
import Skills from './components/Skills';
import Footer from './components/Footer';
import AssistantDock from './components/AssistantDock';
import { projects } from './data/projects';
import { useReducedMotion } from './hooks/useReducedMotion';

function App() {
  const [openId, setOpenId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLElement | null>(null);

  const openProject = useCallback((id: string) => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setOpenId(id);
  }, []);

  const closeProject = useCallback(() => {
    setOpenId(null);
    triggerRef.current?.focus();
  }, []);

  const activeProject = projects.find((p) => p.id === openId) ?? null;

  return (
    <>
      <div className="dot-grid" />
      <AgentCanvas activeProject={activeProject} />

      <main className="relative">
        <Hero />
        <SystemGrid projects={projects} onOpen={openProject} reducedMotion={reducedMotion} />
        <Experience />
        <Skills />
        <Footer />
      </main>

      <AnimatePresence>
        {activeProject && (
          <SystemModal
            key={activeProject.id}
            project={activeProject}
            onClose={closeProject}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>

      <AssistantDock />
    </>
  );
}

export default App;
