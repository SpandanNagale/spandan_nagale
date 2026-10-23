import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChatPanel from './ChatPanel';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { OPEN_ASSISTANT_EVENT } from '../lib/assistant';

/** Mobile launcher (bottom-right, z-40) plus the slide-in assistant panel.
 * On desktop the navbar's "Ask about Spandan" pill is the launcher. */
export default function AssistantDock() {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnFocusRef.current?.focus();
  }, []);

  // Open with Cmd/Ctrl-K, a common "command" affordance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => {
          if (!v) returnFocusRef.current = document.activeElement as HTMLElement | null;
          return !v;
        });
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_ASSISTANT_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_ASSISTANT_EVENT, show);
    };
  }, [show]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="pill fixed bottom-5 right-5 z-40 md:hidden shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-flow-on-ink" aria-hidden="true" />
        Ask about Spandan
      </button>

      <AnimatePresence>
        {open && <ChatPanel onClose={close} reducedMotion={reducedMotion} />}
      </AnimatePresence>
    </>
  );
}
