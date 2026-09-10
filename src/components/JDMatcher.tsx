import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildJdMatchPrompt,
  JD_MAX_CHARS,
  parseJdMatch,
  type JdMatch,
  type Requirement,
} from '../lib/jdMatch';
import { runOneShot } from '../hooks/useChatStream';
import AnswerText from './AnswerText';

type Phase = 'idle' | 'running' | 'result' | 'prose' | 'error';

const STATUS_STYLE: Record<Requirement['status'], string> = {
  met: 'text-flow border-flow',
  partial: 'text-gate border-gate',
  missing: 'text-fault border-fault',
};

const FIT_STYLE: Record<JdMatch['overall_fit'], string> = {
  strong: 'text-flow',
  moderate: 'text-flow',
  partial: 'text-gate',
  weak: 'text-fault',
};

export default function JDMatcher() {
  const [jd, setJd] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [raw, setRaw] = useState('');
  const [match, setMatch] = useState<JdMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setPhase((p) => (p === 'running' ? 'idle' : p));
  }, []);

  const run = useCallback(async () => {
    const text = jd.trim();
    if (text.length < 40 || phase === 'running') return;

    setPhase('running');
    setError(null);
    setMatch(null);
    setRaw('');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Up to two attempts to get schema-valid JSON, then fall back to prose.
      let lastText = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const prompt =
          attempt === 0
            ? buildJdMatchPrompt(text)
            : `${buildJdMatchPrompt(text)}\n\nYour previous reply was not valid JSON. Return ONLY the JSON object, no other text.`;
        const { text: out } = await runOneShot(prompt, ac.signal, setRaw, 'jd');
        lastText = out;
        const parsed = parseJdMatch(out);
        if (parsed.ok) {
          setMatch(parsed.data);
          setPhase('result');
          return;
        }
      }
      setRaw(lastText);
      setPhase('prose');
    } catch (err) {
      if (ac.signal.aborted) {
        setPhase('idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'The match request failed.');
      setPhase('error');
    } finally {
      abortRef.current = null;
    }
  }, [jd, phase]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setJd('');
    setRaw('');
    setMatch(null);
    setError(null);
    setPhase('idle');
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="jd-input" className="mono-label text-muted">
          JOB DESCRIPTION
        </label>
        <p className="text-sm text-muted leading-relaxed">
          Paste a JD. The assistant returns a structured fit assessment grounded in the corpus —
          gaps included, never hidden.
        </p>
      </div>

      <textarea
        id="jd-input"
        value={jd}
        onChange={(e) => setJd(e.target.value.slice(0, JD_MAX_CHARS))}
        rows={6}
        spellCheck={false}
        placeholder="Responsibilities, required skills, years of experience…"
        className="w-full resize-y bg-void border border-line px-3 py-2 text-sm text-text leading-relaxed focus-visible:border-flow outline-none"
        style={{ borderRadius: 2 }}
        disabled={phase === 'running'}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={jd.trim().length < 40 || phase === 'running'}
          className="mono-label border border-flow text-flow px-3 py-2 hover:bg-flow/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ borderRadius: 2 }}
        >
          {phase === 'running' ? 'MATCHING…' : 'MATCH AGAINST CORPUS'}
        </button>
        {phase === 'running' && (
          <button
            type="button"
            onClick={stop}
            className="mono-label border border-line text-muted px-3 py-2 hover:border-fault hover:text-fault transition-colors"
            style={{ borderRadius: 2 }}
          >
            STOP
          </button>
        )}
        {(phase === 'result' || phase === 'prose' || phase === 'error') && (
          <button
            type="button"
            onClick={reset}
            className="mono-label border border-line text-muted px-3 py-2 hover:border-flow hover:text-flow transition-colors"
            style={{ borderRadius: 2 }}
          >
            CLEAR
          </button>
        )}
        <span className="mono-label text-muted ml-auto">
          {jd.length}/{JD_MAX_CHARS}
        </span>
      </div>

      {phase === 'running' && (
        <pre className="text-xs text-muted font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-line p-3" style={{ borderRadius: 2 }}>
          {raw || 'Waiting for the model…'}
        </pre>
      )}

      {phase === 'error' && (
        <p className="text-sm text-fault">{error}</p>
      )}

      {phase === 'prose' && (
        <div className="flex flex-col gap-2">
          <p className="mono-label text-gate">STRUCTURED PARSE FAILED — SHOWING RAW REPLY</p>
          <AnswerText text={raw} settled />
        </div>
      )}

      {phase === 'result' && match && (
        <div className="flex flex-col gap-5">
          <div className="flex items-baseline gap-3">
            <span className="mono-label text-muted">OVERALL FIT</span>
            <span className={`font-display text-2xl uppercase ${FIT_STYLE[match.overall_fit]}`}>
              {match.overall_fit}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-line border-y border-line">
            {match.requirements.map((r, i) => (
              <div key={i} className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1 py-3">
                <span
                  className={`mono-label border px-2 py-1 h-fit w-fit ${STATUS_STYLE[r.status]}`}
                  style={{ borderRadius: 2 }}
                >
                  {r.status}
                </span>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm text-text">{r.requirement}</span>
                  <div className="text-sm">
                    <AnswerText text={r.evidence} settled />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="mono-label text-muted">SUMMARY</span>
            <AnswerText text={match.summary} settled />
          </div>
        </div>
      )}
    </div>
  );
}
