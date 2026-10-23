import { motion, useInView } from 'framer-motion';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Eyebrow, SplitHeadline } from './ui';

interface CodeFile {
  name: string;
  code: string;
}

interface Step {
  numeral: string;
  title: string;
  body: string;
  files: CodeFile[];
}

// Illustrative excerpts written from what each project's README describes —
// trimmed to the shape of the real nodes, not copied line-for-line.
const STEPS: Step[] = [
  {
    numeral: 'I',
    title: 'Generate',
    body: "A model drafts the SQL or the analysis script. It's treated as a proposal — nothing it says about its own output is trusted yet.",
    files: [
      {
        name: 'querypilot/sql_generator.py',
        code: `def sql_generator(state: AgentState) -> dict:
    schema = state["retrieved_schema"]   # top-k tables + live sample rows
    prompt = SQL_PROMPT.format(
        schema=schema,
        question=state["question"],
        last_error=state.get("validation_error"),
    )
    sql = extract_sql(llm.invoke(prompt).content)
    return {"draft_sql": sql, "attempts": state["attempts"] + 1}`,
      },
    ],
  },
  {
    numeral: 'II',
    title: 'Validate',
    body: "Deterministic checks decide, not the model. QueryPilot parses the SQL to an AST and checks it against the live schema; DataSleuth's Critic re-runs the code in a fresh subprocess and compares code_hash and results.",
    files: [
      {
        name: 'querypilot/validator.py',
        code: `def validate(sql: str, schema: Schema) -> Verdict:
    trees = sqlglot.parse(sql, read="sqlite")
    if len(trees) != 1: return reject("multi-statement")
    tree = trees[0]
    if not isinstance(tree, ALLOWED): return reject(f"{tree.key} not allowed")
    if isinstance(tree, (exp.Update, exp.Delete)) and not tree.args.get("where"):
        return reject("write without WHERE")
    for col in tree.find_all(exp.Column):
        schema.require(col.table, col.name)   # live schema, not the prompt
    return ok(tree)`,
      },
      {
        name: 'datasleuth/critic.py',
        code: `def critic(state: SleuthState) -> dict:
    claim = state["coder_result"]
    rerun = run_sandboxed(claim.code)            # fresh subprocess
    if rerun.code_hash != claim.code_hash or rerun.result != claim.result:
        return {"verdict": "reject", "reason": "not reproducible"}
    # only now does a model look at it — temperature 0.1
    judged = judge.invoke(EVIDENCE_PROMPT.format(claim=claim, evidence=rerun))
    return {"verdict": judged.verdict, "reason": judged.reason}`,
      },
    ],
  },
  {
    numeral: 'III',
    title: 'Human gate',
    body: 'Anything destructive stops at a real LangGraph interrupt with a dry-run preview. State is checkpointed to SQLite, so a pending approval survives an API restart.',
    files: [
      {
        name: 'querypilot/graph.py',
        code: `from langgraph.types import interrupt, Command
from langgraph.checkpoint.sqlite import SqliteSaver

def confirmation_gate(state: AgentState) -> dict:
    answer = interrupt({"preview": state["dry_run"], "rows": state["row_count"]})
    return {"approved": answer == "yes"}

graph = builder.compile(checkpointer=SqliteSaver.from_conn_string("sessions.db"))
# later, even after a restart:
graph.invoke(Command(resume="yes"), config={"configurable": {"thread_id": tid}})`,
      },
    ],
  },
];

const STEP_MS = 7000;

/** Minimal highlighter: comments and strings muted, and the three verbs that
 * carry meaning on this site get their semantic colour. */
function Highlighted({ code }: { code: string }) {
  return (
    <>
      {code.split('\n').map((line, i) => {
        const hash = line.indexOf('#');
        const body = hash >= 0 ? line.slice(0, hash) : line;
        const comment = hash >= 0 ? line.slice(hash) : '';
        const parts = body.split(/(\breject\b|\binterrupt\b|\bok\b|"[^"]*")/g);
        return (
          <span key={i} className="table-row">
            <span className="table-cell pr-4 text-right select-none text-dim">{i + 1}</span>
            <span className="table-cell whitespace-pre">
              {parts.map((p, j) =>
                p === 'reject' ? (
                  <span key={j} className="text-fault">{p}</span>
                ) : p === 'interrupt' ? (
                  <span key={j} className="text-gate">{p}</span>
                ) : p === 'ok' ? (
                  <span key={j} className="text-flow">{p}</span>
                ) : p.startsWith('"') ? (
                  <span key={j} className="text-muted">{p}</span>
                ) : (
                  <Fragment key={j}>{p}</Fragment>
                ),
              )}
              {comment && <span className="text-muted">{comment}</span>}
            </span>
          </span>
        );
      })}
    </>
  );
}

function CodeWindow({ step }: { step: Step }) {
  const [fileIndex, setFileIndex] = useState(0);
  const file = step.files[Math.min(fileIndex, step.files.length - 1)];

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      <div className="flex items-center gap-4 px-4 h-11 border-b border-line">
        <div className="flex gap-1.5 shrink-0" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          <span className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          <span className="w-2.5 h-2.5 rounded-full bg-line-strong" />
        </div>
        <div className="flex gap-1 min-w-0 overflow-x-auto">
          {step.files.map((f, i) =>
            step.files.length > 1 ? (
              <button
                key={f.name}
                type="button"
                onClick={() => setFileIndex(i)}
                aria-pressed={f === file}
                className={`font-mono text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                  f === file ? 'bg-void text-text' : 'text-muted hover:text-text'
                }`}
              >
                {f.name}
              </button>
            ) : (
              <span key={f.name} className="font-mono text-[11px] px-2.5 py-1 text-muted whitespace-nowrap">
                {f.name}
              </span>
            ),
          )}
        </div>
      </div>
      <pre className="font-mono text-[12px] md:text-[13px] leading-[1.75] text-text p-4 md:p-5 overflow-x-auto min-h-[300px]">
        <code className="table">
          <Highlighted code={file.code} />
        </code>
      </pre>
    </div>
  );
}

export default function ProcessBand({ reducedMotion }: { reducedMotion: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const cycling = !reducedMotion && !paused && inView;

  useEffect(() => {
    if (!cycling) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [cycling, active]);

  const step = STEPS[active];

  return (
    <section
      ref={ref}
      id="how-it-works"
      aria-labelledby="process-title"
      className="band-dark relative z-10 scroll-mt-20"
    >
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-24 md:py-32">
        <div className="flex flex-col gap-6 mb-14 md:mb-20">
          <Eyebrow>How my agents check themselves</Eyebrow>
          <SplitHeadline id="process-title" first="Draft, then doubt." second="Then ask a human." />
        </div>

        <div
          className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div role="tablist" aria-label="Verification steps" aria-orientation="vertical" className="flex flex-col">
            {STEPS.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  id={`step-tab-${i}`}
                  aria-selected={isActive}
                  aria-controls="step-panel"
                  onClick={() => setActive(i)}
                  className="group text-left pt-6"
                >
                  <div className="flex items-baseline gap-5">
                    <span className={`mono-label w-8 shrink-0 ${isActive ? 'text-text' : 'text-muted'}`}>{s.numeral}.</span>
                    <div className="flex flex-col gap-3 min-w-0">
                      <span
                        className={`display text-3xl md:text-4xl transition-colors ${
                          isActive ? 'text-text' : 'text-dim group-hover:text-muted'
                        }`}
                      >
                        {s.title}
                      </span>
                      {isActive && <p className="text-muted leading-relaxed">{s.body}</p>}
                    </div>
                  </div>
                  <div className="mt-6 h-px bg-line overflow-hidden" aria-hidden="true">
                    {isActive &&
                      (cycling ? (
                        <motion.div
                          key={`${active}-run`}
                          className="h-full bg-flow origin-left"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                        />
                      ) : (
                        <div className="h-full bg-flow" />
                      ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${active}`} className="min-w-0">
            {reducedMotion ? (
              <CodeWindow key={active} step={step} />
            ) : (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <CodeWindow step={step} />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
