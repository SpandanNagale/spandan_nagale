// Provisional until Phase 2 picks the exact Ollama Cloud model; override
// via KNOWLEDGE_CONTEXT_WINDOW once that model's real context window is
// known. Kept conservative (32K) so this fail-condition errs toward
// catching an oversized corpus early rather than missing one.
export const MODEL_CONTEXT_WINDOW_TOKENS = Number(process.env.KNOWLEDGE_CONTEXT_WINDOW ?? 32000);

export const CONTEXT_WINDOW_BUDGET_RATIO = 0.6;

// Heuristic: ~4 characters per token for English prose. Good enough to
// gate the 60% budget check; an exact tokenizer isn't worth a dependency
// at this corpus size (a handful of markdown documents).
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function exceedsContextBudget(
  tokenEstimate: number,
  contextWindow: number = MODEL_CONTEXT_WINDOW_TOKENS,
): boolean {
  return tokenEstimate > contextWindow * CONTEXT_WINDOW_BUDGET_RATIO;
}
