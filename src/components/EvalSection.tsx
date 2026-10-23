import { Eyebrow, Reveal, SectionShell, SplitHeadline } from './ui';

const METHODS = ['RAGAS', 'LLM-as-judge', 'Adversarial suites', 'Execution accuracy', 'WER/CER'];

interface EvalCard {
  project: string;
  metric: string;
  title: string;
  body: string;
}

// Facts from src/data/projects.ts and content/ (projects.yaml, about.md).
const CARDS: EvalCard[] = [
  {
    project: 'QueryPilot',
    metric: '52/60 → 60/60',
    title: 'Separate harness bugs from agent bugs',
    body: 'The first run scored 52/60 on execution accuracy. Investigating every failure turned up two eval-harness bugs and three genuine agent bugs — all fixed in shipped code, plus 40/40 adversarial guardrail tests.',
  },
  {
    project: 'DocIntel',
    metric: '51.0% vs 63.6%',
    title: 'Report the loss',
    body: "The fine-tuned Donut model lost to the OCR baseline overall. The useful finding underneath: they fail on disjoint field types, so a LightGBM router picks per field instead of declaring a winner.",
  },
  {
    project: 'DataSleuth',
    metric: '1 planted trap',
    title: 'Ship the leakage trap with the demo',
    body: 'The sample dataset includes a column only populated after an employee has left — a near-perfect "predictor" of attrition to naive analysis. A working Critic rejects it, and the report says why.',
  },
  {
    project: 'CrewAI Research Pipeline',
    metric: '40 · 35 · 25',
    title: 'Weighted judging, not vibes',
    body: 'LLM-as-judge scores finished reports on citation (40%), coverage (35%) and clarity (25%) rather than a vague quality prompt.',
  },
];

export default function EvalSection({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <SectionShell id="evaluation" labelledBy="eval-title">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>Evaluation</Eyebrow>
          <SplitHeadline id="eval-title" first="Evaluation over" second="demo quality." className="text-[clamp(40px,4.6vw,68px)]" />
          <p className="text-muted text-lg leading-relaxed">
            A demo shows the run that worked. An eval harness shows the ones that didn&apos;t &mdash; so
            every system ships with one, and the negative results stay in the write-up.
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Evaluation methods">
            {METHODS.map((m) => (
              <li key={m} className="tag !text-text !border-line-strong">
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((c, i) => (
            <Reveal key={c.project} reducedMotion={reducedMotion} delay={(i % 2) * 0.06}>
              <article className="flex flex-col gap-5 h-full rounded-xl border border-line bg-panel p-6">
                <span className="mono-label text-muted">{c.project}</span>
                <span className="display text-4xl text-text">{c.metric}</span>
                <div className="flex flex-col gap-2 mt-auto">
                  <h3 className="text-lg text-text leading-snug">{c.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{c.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
