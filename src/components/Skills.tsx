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
    <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
      <p className="mono-label text-muted mb-8">SKILLS</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        {SKILL_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-3">
            <p className="mono-label text-muted">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <span
                  key={item}
                  className="text-xs font-mono text-text border border-line px-2.5 py-1"
                  style={{ borderRadius: 2 }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
