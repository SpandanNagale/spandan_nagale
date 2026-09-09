// 128,000 tokens matches common context windows for modern Ollama Cloud
// models (e.g. gpt-oss, qwen3, llama3.1 all support 128K) and comfortably
// fits this corpus (~44K tokens by this heuristic; a real tokenizer would
// likely count higher, closer to 55-65K, since this heuristic under-counts
// code and markdown). Override via KNOWLEDGE_CONTEXT_WINDOW once Phase 2
// locks in the exact Ollama Cloud model and its real context window.
const DEFAULT_MODEL_CONTEXT_WINDOW_TOKENS = 128000;

export const CONTEXT_WINDOW_BUDGET_RATIO = 0.6;

// Read lazily (a function, not a module-level constant) so the value always
// reflects whatever is in process.env at call time — this makes the pipeline
// immune to import-ordering bugs regardless of how future code imports this
// module, rather than relying on callers loading .env before any import.
export function getModelContextWindowTokens(): number {
  return Number(process.env.KNOWLEDGE_CONTEXT_WINDOW ?? DEFAULT_MODEL_CONTEXT_WINDOW_TOKENS);
}

// Heuristic: ~4 characters per token for English prose. Good enough to
// gate the 60% budget check; an exact tokenizer isn't worth a dependency
// at this corpus size (a handful of markdown documents).
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function exceedsContextBudget(
  tokenEstimate: number,
  contextWindow: number = getModelContextWindowTokens(),
): boolean {
  return tokenEstimate > contextWindow * CONTEXT_WINDOW_BUDGET_RATIO;
}
