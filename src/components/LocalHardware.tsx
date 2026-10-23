import { projects } from '../data/projects';
import { Eyebrow, Reveal, SectionShell, SplitHeadline } from './ui';

interface ModelRow {
  model: string;
  roles: string[];
  projects: string[];
}

// "qwen3:14b @ 0.1" is the same weights at a different temperature.
const baseModel = (m: string) => m.split('@')[0].trim();

const ROLE_SUMMARY: Record<string, string> = {
  'qwen3:14b': 'Reasoning, hypotheses & critic',
  'qwen2.5-coder:14b': 'Code generation & repair',
  'gemma4:latest': 'Analysis & planning',
  gemma: 'Research crew',
};

const MODELS: ModelRow[] = (() => {
  const byModel = new Map<string, ModelRow>();
  for (const p of projects) {
    for (const n of p.nodes) {
      if (!n.model) continue;
      const key = baseModel(n.model);
      const row = byModel.get(key) ?? { model: key, roles: [], projects: [] };
      row.roles.push(n.label);
      if (!row.projects.includes(p.name)) row.projects.push(p.name);
      byModel.set(key, row);
    }
  }
  return [...byModel.values()].sort((a, b) => b.roles.length - a.roles.length);
})();

const STATS = [
  { value: '12GB', label: 'VRAM — one 14B model at a time' },
  { value: '0', label: 'Cloud calls in DataSleuth' },
  { value: '64GB', label: 'System RAM' },
];

export default function LocalHardware({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <SectionShell id="hardware" labelledBy="hardware-title">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-8">
          <Eyebrow>Local-first</Eyebrow>
          <SplitHeadline id="hardware-title" first="Runs on my hardware." second="Not someone else's API." />
          <p className="text-muted text-lg leading-relaxed max-w-xl">
            Most of these systems run entirely on Ollama on one workstation. Local models are less
            forgiving than frontier ones, so the control flow has to carry the weight: narrow agent
            roles, explicit state, validated handoffs. And with 12GB of VRAM only one 14B model fits
            at a time, so every LLM call is serialized behind a single lock instead of raced.
          </p>
          <dl className="grid grid-cols-3 gap-4 border-t border-line pt-8 mt-2">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-2">
                <dt className="sr-only">{s.label}</dt>
                <dd className="display text-4xl md:text-5xl text-text order-first">{s.value}</dd>
                <span className="mono-label text-muted leading-relaxed" aria-hidden="true">
                  {s.label}
                </span>
              </div>
            ))}
          </dl>
        </div>

        <Reveal reducedMotion={reducedMotion} className="lg:pt-12">
          <div className="rounded-xl border border-line bg-panel overflow-hidden">
            <div className="flex items-center justify-between px-5 h-12 border-b border-line">
              <span className="mono-label text-muted">Local models · Ollama</span>
              <span className="mono-label text-muted flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-flow" aria-hidden="true" />
                RTX 5070
              </span>
            </div>
            <ul>
              {MODELS.map((m) => (
                <li
                  key={m.model}
                  className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-5 py-5 border-b border-line last:border-b-0 hover:bg-void transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-flow shrink-0" aria-hidden="true" />
                    <span className="font-mono text-sm text-text truncate">{m.model}</span>
                  </div>
                  <span className="mono-label text-muted self-center">
                    {m.roles.length} {m.roles.length === 1 ? 'node' : 'nodes'}
                  </span>
                  <div className="col-span-2 pl-[18px] flex flex-col gap-2">
                    <span className="text-sm text-text">{ROLE_SUMMARY[m.model] ?? m.roles.join(', ')}</span>
                    <span className="text-sm text-muted">{m.roles.join(' · ')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {m.projects.map((p) => (
                        <span key={p} className="tag">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
