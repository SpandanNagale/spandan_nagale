import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChatPanel from './ChatPanel';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Fixed launcher (bottom-right, z-40) plus the slide-in assistant panel. */
export default function AssistantDock() {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Open with Cmd/Ctrl-K, a common "command" affordance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 mono-label flex items-center gap-2 bg-panel border border-line text-text px-4 py-3 hover:border-flow hover:text-flow transition-colors"
        style={{ borderRadius: 2 }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-flow" aria-hidden="true" />
        ASK ABOUT SPANDAN
      </button>

      <AnimatePresence>
        {open && <ChatPanel onClose={close} reducedMotion={reducedMotion} />}
      </AnimatePresence>
    </>
  );
}
