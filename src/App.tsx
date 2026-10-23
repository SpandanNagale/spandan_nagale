import { AnimatePresence } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProofMarquee from './components/ProofMarquee';
import SystemRows from './components/SystemRows';
import ProcessBand from './components/ProcessBand';
import LocalHardware from './components/LocalHardware';
import LiveDemos from './components/LiveDemos';
import EvalSection from './components/EvalSection';
import Experience from './components/Experience';
import Skills from './components/Skills';
import ContactCTA from './components/ContactCTA';
import SystemModal from './components/SystemModal';
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
        <LocalHardware reducedMotion={reducedMotion} />
        <LiveDemos reducedMotion={reducedMotion} />
        <EvalSection reducedMotion={reducedMotion} />
        <Experience reducedMotion={reducedMotion} />
        <Skills />
        <ContactCTA reducedMotion={reducedMotion} />
      </main>
      <Footer />

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
