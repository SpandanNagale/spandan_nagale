import { Marquee, SectionShell, Eyebrow, SplitHeadline } from './ui';

const TOOLS_A = ['LangGraph', 'CrewAI', 'Ollama', 'PyTorch', 'FastAPI', 'ChromaDB', 'Neo4j', 'Docker', 'sqlglot', 'LightGBM'];
const TOOLS_B = ['Qwen', 'Gemma', 'Transformers', 'scikit-learn', 'XGBoost', 'SQLite', 'RAGAS', 'pandas', 'Streamlit', 'SSE'];

function ToolItem({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-8 pr-8 display text-4xl md:text-6xl text-text">
      {name}
      <span className="font-mono text-base text-dim" aria-hidden="true">
        ○
      </span>
    </span>
  );
}

const SKILL_GROUPS = [
  {
    label: 'AGENT ENGINEERING',
    items: [
      'LangGraph',
      'CrewAI',
      'multi-agent orchestration',
      'human-in-the-loop interrupts',
      'state checkpointing',
      'self-correction loops',
      'tool use',
      'AST-based guardrails',
    ],
  },
  {
    label: 'LLM & RETRIEVAL',
    items: [
      'Ollama',
      'Qwen',
      'Gemma',
      'ChromaDB',
      'Neo4j',
      'hybrid retrieval (BM25 + dense)',
      'reciprocal rank fusion',
      'cross-encoder reranking',
      'structured output',
      'prompt engineering',
    ],
  },
  {
    label: 'MACHINE LEARNING',
    items: [
      'PyTorch',
      'scikit-learn',
      'LightGBM',
      'XGBoost',
      'Transformers',
      'pandas',
      'NumPy',
      'fine-tuning',
      'custom tokenizers',
      'pretraining from scratch',
    ],
  },
  {
    label: 'BACKEND & INFRA',
    items: ['Python', 'FastAPI', 'Flask', 'SSE', 'SQLite', 'SQLAlchemy', 'Docker Compose', 'GPU passthrough', 'REST APIs'],
  },
  {
    label: 'EVALUATION',
    items: ['eval harness design', 'execution accuracy', 'adversarial safety suites', 'LLM-as-judge', 'RAGAS', 'WER/CER scoring'],
  },
];

export default function Skills() {
  return (
    <SectionShell id="stack" labelledBy="stack-title" className="!px-0">
      <div className="px-4 md:px-6 flex flex-col gap-6 mb-12 md:mb-16">
        <Eyebrow>Stack</Eyebrow>
        <SplitHeadline id="stack-title" first="Tools I reach for." second="And what they're for." />
      </div>

      <div className="flex flex-col gap-4 md:gap-6 py-4">
        <Marquee
          duration={45}
          srLabel="Headline tools"
          srItems={[...TOOLS_A, ...TOOLS_B]}
          items={TOOLS_A.map((t) => (
            <ToolItem key={t} name={t} />
          ))}
        />
        <Marquee
          reverse
          duration={50}
          srLabel="More tools"
          srItems={[]}
          items={TOOLS_B.map((t) => (
            <ToolItem key={t} name={t} />
          ))}
        />
      </div>

      <div className="px-4 md:px-6 mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-10 border-t border-line pt-10">
        {SKILL_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-4">
            <h3 className="mono-label text-text">{group.label}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <li key={item} className="tag">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
