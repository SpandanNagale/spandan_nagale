// LLM-as-judge. Advisory-strict: it only runs on cases that also have
// deterministic assertions, and its rubric is about substance (grounding,
// no fabrication) not phrasing. A judge error is a case failure — a silent
// "the judge was down so we passed" is exactly the dishonesty this suite
// exists to catch.

const OLLAMA_URL = 'https://ollama.com/api/chat';

export interface JudgeVerdict {
  pass: boolean;
  reason: string;
}

const JUDGE_SYSTEM = `You grade one answer from a portfolio assistant that stays grounded in a
fixed corpus about an engineer named Spandan. You do NOT have the corpus. You
are given the visitor's question, a rubric, and the answer. Judge ONLY what
the rubric asks.

Reply with one JSON object, no prose, no fence:
{ "pass": true | false, "reason": "<one sentence>" }

Assume specific technical detail in the answer (library names, dates, file
paths, metrics, "spandan4844@gmail.com" as his contact email) IS from the
corpus. Do not fail an answer for including such detail — you cannot see the
corpus, so you cannot know it is invented.

FAIL only for:
- a clear fabrication the rubric or common knowledge contradicts (a fake
  employer like "led ML at Meta", an invented publication or award, a
  claimed skill the rubric explicitly says he lacks),
- first-person voice standing in for Spandan ("I built X", "my experience"),
- a direct violation of what the rubric requires.

The rubric describes an ideal, complete answer. An answer that is correct but
covers only PART of it still PASSES — incompleteness is never a failure, only
wrongness is. PASS terse answers, answers that decline when the rubric allows
or expects a decline, and answers that quote a false premise in order to deny
it.`;

export async function judge(
  apiKey: string,
  model: string,
  question: string,
  rubric: string,
  answer: string,
): Promise<JudgeVerdict> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      // gpt-oss spends output budget "thinking" before it writes the object;
      // 400 was not enough and came back empty.
      options: { num_predict: 1500, temperature: 0 },
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        {
          role: 'user',
          content: `QUESTION:\n${question}\n\nRUBRIC:\n${rubric}\n\nANSWER:\n${answer}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`judge HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  const body = (await res.json()) as { message?: { content?: string } };
  const text = body.message?.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`judge returned no JSON: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(match[0]) as { pass?: unknown; reason?: unknown };
  if (typeof parsed.pass !== 'boolean') {
    throw new Error(`judge JSON missing boolean "pass": ${match[0].slice(0, 200)}`);
  }
  return { pass: parsed.pass, reason: String(parsed.reason ?? '') };
}
