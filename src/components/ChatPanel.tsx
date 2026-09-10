import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useChatStream } from '../hooks/useChatStream';
import { useLockScroll } from '../hooks/useLockScroll';
import AnswerText from './AnswerText';
import TelemetryStrip from './TelemetryStrip';
import JDMatcher from './JDMatcher';

interface ChatPanelProps {
  onClose: () => void;
  reducedMotion: boolean;
}

type Tab = 'chat' | 'jd';

const SUGGESTIONS = [
  'What has Spandan actually shipped in production?',
  'Walk me through the safety design in QueryPilot.',
  'Does he have Kubernetes or cloud infra experience?',
  'How does DataSleuth verify its own findings?',
];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function ChatPanel({ onClose, reducedMotion }: ChatPanelProps) {
  const { turns, draft, telemetry, status, error, send, stop } = useChatStream();
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLockScroll(true);

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
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

  // Keep the transcript pinned to the newest content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, draft, tab]);

  const streaming = status === 'streaming';

  function submit() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput('');
    void send(q);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'color-mix(in srgb, var(--void) 70%, transparent)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask about Spandan"
        className="relative flex h-full w-full max-w-xl flex-col bg-panel border-l border-line"
        initial={{ x: reducedMotion ? 0 : '100%' }}
        animate={{ x: 0 }}
        exit={{ x: reducedMotion ? 0 : '100%' }}
        transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-lg text-text">Ask about Spandan</span>
            <span className="mono-label text-muted">GROUNDED IN A CURATED CORPUS · THIRD PERSON</span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center border border-line text-muted hover:text-flow hover:border-flow transition-colors"
            style={{ borderRadius: 2 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </header>

        <div className="flex border-b border-line" role="tablist" aria-label="Assistant mode">
          {(['chat', 'jd'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`mono-label px-5 py-3 border-b-2 transition-colors ${
                tab === t
                  ? 'border-flow text-flow'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t === 'chat' ? 'CHAT' : 'JD MATCH'}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
          {tab === 'jd' ? (
            <JDMatcher />
          ) : turns.length === 0 && !draft ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted leading-relaxed">
                Answers come only from what Spandan has written and what the GitHub API confirms.
                Unknowns get a straight &ldquo;not in the corpus&rdquo; and his email, not a guess.
              </p>
              <div className="flex flex-col gap-2 mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setInput('');
                      void send(s);
                    }}
                    className="text-left text-sm text-text border border-line px-3 py-2 hover:border-flow hover:text-flow transition-colors"
                    style={{ borderRadius: 2 }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <div key={i} className="flex flex-col gap-1 items-end">
                    <span className="mono-label text-muted">YOU</span>
                    <p className="text-text leading-relaxed bg-void border border-line px-3 py-2 max-w-[85%]" style={{ borderRadius: 2 }}>
                      {turn.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="mono-label text-muted">ASSISTANT</span>
                    <AnswerText text={turn.content} settled />
                    {turn.errored && (
                      <p className="mono-label text-fault mt-1">STREAM INTERRUPTED</p>
                    )}
                  </div>
                ),
              )}

              {draft && (
                <div className="flex flex-col gap-1">
                  <span className="mono-label text-muted">ASSISTANT</span>
                  <AnswerText text={draft} settled={false} />
                </div>
              )}

              {error && <p className="text-sm text-fault">{error}</p>}
            </div>
          )}
        </div>

        {tab === 'chat' && (
          <div className="border-t border-line px-5 py-4 flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder="Ask about a project, a skill, his availability…"
                className="flex-1 resize-none bg-void border border-line px-3 py-2 text-sm text-text leading-relaxed focus-visible:border-flow outline-none"
                style={{ borderRadius: 2 }}
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="mono-label border border-line text-muted px-3 py-2 hover:border-fault hover:text-fault transition-colors shrink-0"
                  style={{ borderRadius: 2 }}
                >
                  STOP
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={input.trim().length === 0}
                  className="mono-label border border-flow text-flow px-3 py-2 hover:bg-flow/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  style={{ borderRadius: 2 }}
                >
                  SEND
                </button>
              )}
            </div>
            <TelemetryStrip telemetry={telemetry} streaming={streaming} />
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}
