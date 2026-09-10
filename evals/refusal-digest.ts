// npm run eval:digest
//
// Groups the assistant's logged refusals (api/_lib/refusalLog.ts pushes them
// to the Redis list `chat:refusals`) into a ranked backlog: what visitors
// asked that the corpus couldn't answer. Run weekly — the questions that keep
// coming back are the gaps worth filling in content/.
//
// No Redis configured -> prints a notice and exits 0 (nothing to digest).

import { appendFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Redis } from '@upstash/redis';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(ROOT, '.env.local') });

const DAYS = Number(process.env.DIGEST_DAYS ?? 7);
const LIST_KEY = 'chat:refusals';

interface RefusalEntry {
  question: string;
  timestamp: string;
  session_id: string;
}

function out(line = '') {
  console.log(line);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    try {
      appendFileSync(summary, line + '\n');
    } catch {
      /* best effort */
    }
  }
}

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    out('_No UPSTASH_REDIS_REST_URL / _TOKEN set — no refusal log to digest._');
    return;
  }

  const redis = new Redis({ url, token });
  const rows = await redis.lrange<string | RefusalEntry>(LIST_KEY, 0, -1);

  const cutoff = Date.now() - DAYS * 86_400_000;
  const parsed: RefusalEntry[] = [];
  for (const row of rows) {
    const entry = typeof row === 'string' ? (safeParse(row) as RefusalEntry | null) : row;
    if (!entry || typeof entry.question !== 'string') continue;
    const t = Date.parse(entry.timestamp);
    if (Number.isFinite(t) && t < cutoff) continue;
    parsed.push(entry);
  }

  out(`## Refusal digest — last ${DAYS} days`);
  out();
  out(`Total refusals in window: **${parsed.length}** (list holds up to 1000).`);
  out();

  if (parsed.length === 0) {
    out('_Nothing logged in the window._');
    return;
  }

  const groups = new Map<string, { count: number; latest: string; sample: string }>();
  for (const e of parsed) {
    const key = e.question.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
    const g = groups.get(key) ?? { count: 0, latest: e.timestamp, sample: e.question.trim() };
    g.count++;
    if (Date.parse(e.timestamp) > Date.parse(g.latest)) g.latest = e.timestamp;
    groups.set(key, g);
  }

  const ranked = [...groups.values()].sort((a, b) => b.count - a.count);
  out('| count | last seen | question |');
  out('| ----: | --------- | -------- |');
  for (const g of ranked.slice(0, 40)) {
    const q = g.sample.replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 160);
    out(`| ${g.count} | ${g.latest.slice(0, 10)} | ${q} |`);
  }
  if (ranked.length > 40) out(`\n_…and ${ranked.length - 40} more distinct questions._`);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
