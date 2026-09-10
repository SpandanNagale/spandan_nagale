import knowledge from '../../public/knowledge.json';
import { SYSTEM_PROMPT_PREFIX } from './systemPrompt';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface KnowledgeDoc {
  id: string;
  type: string;
  title: string;
  content: string;
}
interface KnowledgeBase {
  corpus_version: string;
  token_estimate: number;
  documents: KnowledgeDoc[];
}

const corpus = knowledge as unknown as KnowledgeBase;

export const CORPUS_VERSION = corpus.corpus_version;
export const CORPUS_TOKEN_ESTIMATE = corpus.token_estimate;

/** Each document rendered under its citation id, so the model sees exactly the
 * token it must cite ([[proj:querypilot]], [[doc:about]], ...). */
export function renderCorpus(): string {
  return corpus.documents
    .map((d) => `[${d.id}] ${d.title}\n${d.content}`)
    .join('\n\n---\n\n');
}

/** Static prefix first, then the (large, unchanging) corpus — ordering kept so
 * any provider-side prefix caching applies to the bulk of the prompt. Computed
 * once at module load; it has no env or request dependency. */
export const SYSTEM_MESSAGE = `${SYSTEM_PROMPT_PREFIX}${renderCorpus()}`;

export function assembleMessages(
  userMessages: ChatMessage[],
): Array<{ role: string; content: string }> {
  return [{ role: 'system', content: SYSTEM_MESSAGE }, ...userMessages];
}
