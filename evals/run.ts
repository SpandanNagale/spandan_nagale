// npm run eval
//
// Puts every case in evals/cases.yaml to a running /api/chat, grades each
// answer with the deterministic assertions in assertions.ts, and — for cases
// with a `rubric` — also with the LLM judge. Exits non-zero if any case fails
// or is missing an effective check, so it can gate CI.
//
// Target: EVAL_TARGET_URL if set (e.g. a Vercel preview). Otherwise this
// starts Vite (with the dev /api/chat bridge) in-process and tears it down.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { parse as parseYaml } from 'yaml';
import { EvalSuiteSchema, type EvalCase } from './schema.ts';
import { hasEffectiveCheck, runAssertions, type CheckResult } from './assertions.ts';
import { ask } from './client.ts';
import { judge } from './judge.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(ROOT, '.env.local') });

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 3);
const JUDGE_ENABLED = !process.argv.includes('--no-judge') && process.env.EVAL_JUDGE !== '0';
// The deterministic assertions are the blocking gate. The LLM judge is a
// second opinion on grounding quality — reported always, blocking only when
// asked (the Assay lesson: don't let a single judge score be load-bearing).
const STRICT_JUDGE =
  process.argv.includes('--strict-judge') || process.env.EVAL_STRICT_JUDGE === '1';
const FILTER = argValue('--filter');
const MODEL = process.env.EVAL_JUDGE_MODEL ?? process.env.OLLAMA_MODEL ?? 'gpt-oss:120b';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

interface CaseOutcome {
  case: EvalCase;
  answer: string;
  checks: CheckResult[];
  judge?: { pass: boolean; reason: string };
  telemetry: Record<string, unknown> | null;
  pass: boolean;
  fatal?: string;
}

async function runCase(baseUrl: string, apiKey: string, c: EvalCase): Promise<CaseOutcome> {
  const turns = [...c.history, { role: 'user' as const, content: c.question }];
  const mode = c.category === 'grounded' && c.question.length > 4000 ? 'jd' : 'chat';

  try {
    const { answer, telemetry, errored } = await ask(baseUrl, turns, mode);
    if (errored || !answer.trim()) {
      return {
        case: c,
        answer,
        checks: [],
        telemetry,
        pass: false,
        fatal: errored ? `stream error / empty answer: ${answer.slice(0, 160)}` : 'empty answer',
      };
    }

    const checks = runAssertions(c, answer);
    let judgeVerdict: CaseOutcome['judge'];
    if (JUDGE_ENABLED && c.rubric) {
      try {
        judgeVerdict = await judge(apiKey, MODEL, c.question, c.rubric, answer);
      } catch (err) {
        judgeVerdict = {
          pass: false,
          reason: `judge error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    const assertionsPass = checks.every((r) => r.pass);
    const judgeBlocks = STRICT_JUDGE && judgeVerdict !== undefined && !judgeVerdict.pass;
    return {
      case: c,
      answer,
      checks,
      judge: judgeVerdict,
      telemetry,
      pass: assertionsPass && !judgeBlocks,
    };
  } catch (err) {
    return {
      case: c,
      answer: '',
      checks: [],
      telemetry: null,
      pass: false,
      fatal: `request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function startLocalServer(): Promise<{ url: string; stop: () => Promise<void> }> {
  const { createServer } = await import('vite');
  const port = 5199;
  const server = await createServer({
    configFile: resolve(ROOT, 'vite.config.ts'),
    root: ROOT,
    logLevel: 'warn',
    server: { port, strictPort: true },
  });
  await server.listen();
  return { url: `http://localhost:${port}`, stop: () => server.close() };
}

async function main() {
  const raw = readFileSync(resolve(ROOT, 'evals/cases.yaml'), 'utf8');
  const suite = EvalSuiteSchema.parse(parseYaml(raw));
  let cases = suite.cases;
  if (FILTER) cases = cases.filter((c) => c.id.includes(FILTER) || c.category === FILTER);

  if (process.argv.includes('--list')) {
    for (const c of cases) console.log(`${c.category.padEnd(11)} ${c.id}`);
    console.log(`\n${cases.length} cases`);
    return;
  }

  const malformed = cases.filter((c) => !hasEffectiveCheck(c));
  if (malformed.length > 0) {
    console.error('Cases with no effective check (add an assertion or a rubric):');
    for (const c of malformed) console.error(`  - ${c.id}`);
    process.exit(1);
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    console.error('OLLAMA_API_KEY is not set (needed for the assistant and the judge).');
    process.exit(1);
  }

  let baseUrl = process.env.EVAL_TARGET_URL ?? '';
  let stop: (() => Promise<void>) | null = null;
  if (!baseUrl) {
    process.stdout.write('starting local vite (with /api/chat bridge)… ');
    const local = await startLocalServer();
    baseUrl = local.url;
    stop = local.stop;
    console.log(baseUrl);
  } else {
    console.log(`target: ${baseUrl}`);
  }
  console.log(
    `${cases.length} cases · concurrency ${CONCURRENCY} · judge ${
      JUDGE_ENABLED ? `${STRICT_JUDGE ? 'STRICT' : 'advisory'} (${MODEL})` : 'off'
    }\n`,
  );

  const started = Date.now();
  let outcomes: CaseOutcome[];
  try {
    outcomes = await pool(cases, CONCURRENCY, (c) => runCase(baseUrl, apiKey, c));
  } finally {
    if (stop) await stop();
  }

  // --- report -------------------------------------------------------------
  const byCat = new Map<string, { pass: number; total: number }>();
  for (const o of outcomes) {
    const s = byCat.get(o.case.category) ?? { pass: 0, total: 0 };
    s.total++;
    if (o.pass) s.pass++;
    byCat.set(o.case.category, s);
  }

  console.log('category      pass / total');
  console.log('-----------   ------------');
  for (const [cat, s] of byCat) {
    console.log(`${cat.padEnd(13)} ${String(s.pass).padStart(2)} / ${s.total}`);
  }

  const failures = outcomes.filter((o) => !o.pass);
  if (failures.length > 0) {
    console.log(`\n${failures.length} FAILING:\n`);
    for (const o of failures) {
      console.log(`✗ ${o.case.id}  [${o.case.category}]`);
      console.log(`  Q: ${o.case.question}`);
      if (o.fatal) console.log(`  FATAL: ${o.fatal}`);
      for (const c of o.checks.filter((r) => !r.pass)) {
        console.log(`  assertion: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      }
      if (o.judge && !o.judge.pass) console.log(`  judge: ${o.judge.reason}`);
      console.log(`  answer: ${o.answer.replace(/\s+/g, ' ').slice(0, 280)}\n`);
    }
  }

  // Judge disagreements on cases that PASSED the deterministic gate — signal,
  // not a gate failure (unless --strict-judge, in which case they're above).
  const judgeFlags = outcomes.filter((o) => o.pass && o.judge && !o.judge.pass);
  if (judgeFlags.length > 0) {
    console.log(`\n${judgeFlags.length} judge flag(s) (advisory — not blocking):`);
    for (const o of judgeFlags) {
      console.log(`  ~ ${o.case.id}: ${o.judge?.reason}`);
    }
  }

  // TTFT / latency summary from whatever telemetry came back.
  const ttfts = outcomes
    .map((o) => Number(o.telemetry?.ttft_ms))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (ttfts.length > 0) {
    const median = ttfts[Math.floor(ttfts.length / 2)];
    console.log(
      `\nttft ms  min ${ttfts[0]}  median ${median}  max ${ttfts[ttfts.length - 1]}  (n=${ttfts.length})`,
    );
  }

  const passed = outcomes.length - failures.length;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\n${passed}/${outcomes.length} passed in ${secs}s`);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
