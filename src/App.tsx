import { AnimatePresence } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProofMarquee from './components/ProofMarquee';
import SystemRows from './components/SystemRows';
import SystemModal from './components/SystemModal';
import ProcessBand from './components/ProcessBand';
import LiveDemos from './components/LiveDemos';
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
      <div className="page-grid" aria-hidden="true" />
      <Navbar />

      <main id="top" className="relative overflow-x-clip">
        <Hero reducedMotion={reducedMotion} />
        <ProofMarquee />
        <SystemRows projects={projects} onOpen={openProject} reducedMotion={reducedMotion} />
        <ProcessBand reducedMotion={reducedMotion} />
        <LiveDemos />
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
