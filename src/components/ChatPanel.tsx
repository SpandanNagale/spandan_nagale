import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  { tag: 'Shipped', q: 'What has Spandan actually shipped in production?' },
  { tag: 'Safety', q: 'Walk me through the safety design in QueryPilot.' },
  { tag: 'Infra', q: 'Does he have Kubernetes or cloud infra experience?' },
  { tag: 'Verification', q: 'How does DataSleuth verify its own findings?' },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const SPRING = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 } as const;

function Avatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';
  return (
    <span className={`relative shrink-0 ${dim}`}>
      {failed ? (
        <span
          className={`${dim} rounded-full bg-line-strong text-text flex items-center justify-center font-mono text-[10px]`}
        >
          SN
        </span>
      ) : (
        <img
          src="/profile.jpg"
          alt=""
          className={`${dim} rounded-full object-cover border border-line`}
          onError={() => setFailed(true)}
        />
      )}
      {size === 'lg' && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-flow border-2 border-void"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function TypingDots({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 h-5" aria-label="Assistant is typing" role="status">
      {[0, 1, 2].map((i) =>
        reducedMotion ? (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted" />
        ) : (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted"
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ),
      )}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-panel transition-colors"
    >
      {children}
    </button>
  );
}

/** The assistant: a floating card that grows out of the bottom-right corner
 * on desktop, a bottom sheet on mobile. Chat and JD-match tabs share it. */
export default function ChatPanel({ onClose, reducedMotion }: ChatPanelProps) {
  const { turns, draft, telemetry, status, error, send, stop, reset } = useChatStream();
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [isSheet] = useState(() => window.matchMedia('(max-width: 639px)').matches);
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
  const empty = turns.length === 0 && !draft;
  useEffect(() => {
    if (empty && tab === 'chat') return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [turns, draft, tab, reducedMotion, empty]);

  // Grow the composer with its content, up to ~5 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const streaming = status === 'streaming';

  function submit() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput('');
    void send(q);
  }

  const hidden = reducedMotion
    ? { opacity: 0 }
    : isSheet
      ? { y: '100%' }
      : { opacity: 0, scale: 0.92, y: 24 };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-end sm:p-5"
      style={{ background: 'color-mix(in srgb, var(--ink) 18%, transparent)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask about Spandan"
        className="relative flex flex-col w-full h-[92svh] rounded-t-[28px] sm:w-[440px] sm:h-[min(720px,calc(100svh-40px))] sm:rounded-[28px] bg-void border border-line overflow-hidden shadow-[0_40px_100px_-30px_rgba(10,10,10,0.55)]"
        style={{ transformOrigin: 'bottom right' }}
        initial={hidden}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={hidden}
        transition={reducedMotion ? { duration: 0 } : SPRING}
      >
        {/* Header — the dark band tokens give it contrast against the page. */}
        <header className="band-dark relative px-4 pt-3 pb-4 sm:pt-4">
          {isSheet && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />}
          <div className="flex items-center gap-3">
            <Avatar size="lg" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[17px] leading-tight text-text">Ask about Spandan</span>
              <span className="text-xs text-muted truncate">Grounded in his corpus &middot; answers in third person</span>
            </div>
            {tab === 'chat' && !empty && (
              <IconButton label="New chat" onClick={reset}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.8h2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </IconButton>
            )}
            <IconButton label="Close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>

          <div
            className="mt-4 grid grid-cols-2 p-1 rounded-full bg-panel border border-line"
            role="tablist"
            aria-label="Assistant mode"
          >
            {(['chat', 'jd'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative rounded-full py-2 text-sm transition-colors ${
                  tab === t ? 'text-on-ink' : 'text-muted hover:text-text'
                }`}
              >
                {tab === t && (
                  <motion.span
                    layoutId="assistant-tab"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{t === 'chat' ? 'Chat' : 'JD match'}</span>
              </button>
            ))}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
          {tab === 'jd' ? (
            <div className="rounded-2xl border border-line bg-panel p-4">
              <JDMatcher />
            </div>
          ) : empty ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-end gap-2.5">
                <Avatar />
                <div className="rounded-2xl rounded-bl-md bg-panel border border-line px-4 py-3 text-sm text-text leading-relaxed max-w-[85%]">
                  Hi! I answer questions about Spandan&apos;s projects, skills and availability &mdash;
                  only from what he&apos;s written and what GitHub confirms. If it&apos;s not in the
                  corpus, I&apos;ll say so and point you to his email.
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="mono-label text-muted px-1">Try asking</span>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s.q}
                      type="button"
                      onClick={() => {
                        setInput('');
                        void send(s.q);
                      }}
                      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reducedMotion ? 0 : 0.12 + i * 0.05, duration: 0.3 }}
                      className="group flex flex-col gap-2 text-left rounded-2xl border border-line bg-panel p-3.5 hover:border-line-strong hover:-translate-y-0.5 transition-[transform,border-color]"
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{s.tag}</span>
                        <span className="text-muted group-hover:text-text transition-colors" aria-hidden="true">
                          &rarr;
                        </span>
                      </span>
                      <span className="text-sm text-text leading-snug">{s.q}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5" aria-live="polite">
              {turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <p className="rounded-2xl rounded-br-md bg-ink text-on-ink text-sm leading-relaxed px-4 py-2.5 max-w-[85%] whitespace-pre-wrap">
                      <span className="sr-only">You: </span>
                      {turn.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2.5">
                    <Avatar />
                    <div className="flex flex-col gap-2 min-w-0 max-w-[88%] rounded-2xl rounded-tl-md bg-panel border border-line px-4 py-3 text-sm">
                      <span className="sr-only">Assistant: </span>
                      <AnswerText text={turn.content} settled />
                      {turn.errored && <p className="mono-label text-fault">Stream interrupted</p>}
                    </div>
                  </div>
                ),
              )}

              {streaming && (
                <div className="flex items-start gap-2.5">
                  <Avatar />
                  <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tl-md bg-panel border border-line px-4 py-3 text-sm">
                    {draft ? <AnswerText text={draft} settled={false} /> : <TypingDots reducedMotion={reducedMotion} />}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-fault rounded-2xl border border-fault/30 bg-fault/5 px-4 py-3">{error}</p>
              )}
            </div>
          )}
        </div>

        {tab === 'chat' && (
          <div className="px-4 pb-4 pt-2 flex flex-col gap-2 bg-void">
            <div className="flex items-end gap-2 rounded-[22px] border border-line-strong bg-panel pl-4 pr-1.5 py-1.5 focus-within:border-text transition-colors shadow-[0_6px_20px_-12px_rgba(10,10,10,0.25)]">
              <label htmlFor="assistant-input" className="sr-only">
                Ask a question
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask about a project, a skill, his availability…"
                className="flex-1 resize-none bg-transparent py-2 text-sm text-text leading-relaxed placeholder:text-muted focus:outline-none focus-visible:outline-none"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop generating"
                  className="w-9 h-9 shrink-0 rounded-full border border-line-strong flex items-center justify-center text-text hover:border-fault hover:text-fault transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-current" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={input.trim().length === 0}
                  aria-label="Send"
                  className="w-9 h-9 shrink-0 rounded-full bg-ink text-on-ink flex items-center justify-center transition-[opacity,transform] hover:scale-105 disabled:opacity-25 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 12V2M7 2L2.5 6.5M7 2l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-muted hidden sm:inline">
                <kbd className="font-mono">Enter</kbd> to send &middot; <kbd className="font-mono">Shift+Enter</kbd> new line &middot; <kbd className="font-mono">Esc</kbd> close
              </span>
              <button
                type="button"
                onClick={() => setShowTelemetry((v) => !v)}
                aria-expanded={showTelemetry}
                aria-controls="assistant-telemetry"
                className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-text transition-colors"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${streaming ? 'bg-flow animate-pulse' : telemetry ? 'bg-flow' : 'bg-line-strong'}`}
                  aria-hidden="true"
                />
                Telemetry
                <span className={`transition-transform ${showTelemetry ? 'rotate-180' : ''}`} aria-hidden="true">
                  &#9662;
                </span>
              </button>
            </div>

            {showTelemetry && (
              <div id="assistant-telemetry">
                <TelemetryStrip telemetry={telemetry} streaming={streaming} />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
