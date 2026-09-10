import { describe, expect, it } from 'vitest';
import { buildJdMatchPrompt, extractJsonObject, parseJdMatch } from './jdMatch';

const VALID = {
  overall_fit: 'moderate',
  requirements: [
    {
      requirement: '3+ years building LLM applications',
      status: 'partial',
      evidence: 'Spandan shipped eight GenAI systems during a six-month internship [[doc:about]].',
    },
    {
      requirement: 'Kubernetes in production',
      status: 'missing',
      evidence: 'The corpus shows no Kubernetes experience; the closest is Docker Compose [[proj:veritas]].',
    },
  ],
  summary:
    'Spandan is a moderate fit: strong on agentic LLM systems, but without the production Kubernetes experience the role asks for.',
};

describe('extractJsonObject', () => {
  it('parses a bare object', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses an object wrapped in prose', () => {
    expect(extractJsonObject('Here you go:\n{"a":[1,2]}\nHope that helps.')).toEqual({ a: [1, 2] });
  });

  it('parses an object inside a ```json fence', () => {
    expect(extractJsonObject('```json\n{"a":{"b":2}}\n```')).toEqual({ a: { b: 2 } });
  });

  it('is not fooled by braces inside string values', () => {
    expect(extractJsonObject('{"note":"use {curly} braces"}')).toEqual({ note: 'use {curly} braces' });
  });

  it('returns undefined when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    expect(extractJsonObject('{"a": }')).toBeUndefined();
  });
});

describe('parseJdMatch', () => {
  it('accepts a well-formed match', () => {
    const result = parseJdMatch(JSON.stringify(VALID));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requirements).toHaveLength(2);
      expect(result.data.requirements[1].status).toBe('missing');
    }
  });

  it('accepts a match embedded in prose', () => {
    expect(parseJdMatch(`Sure:\n${JSON.stringify(VALID)}`).ok).toBe(true);
  });

  it('rejects an unknown status value', () => {
    const bad = structuredClone(VALID);
    bad.requirements[0].status = 'maybe';
    expect(parseJdMatch(JSON.stringify(bad)).ok).toBe(false);
  });

  it('rejects an empty requirements array', () => {
    const bad = { ...VALID, requirements: [] };
    expect(parseJdMatch(JSON.stringify(bad)).ok).toBe(false);
  });

  it('rejects unknown top-level keys', () => {
    const bad = { ...VALID, confidence: 0.9 };
    expect(parseJdMatch(JSON.stringify(bad)).ok).toBe(false);
  });

  it('reports when no JSON is present', () => {
    const result = parseJdMatch('I could not produce structured output.');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no json/i);
  });
});

describe('buildJdMatchPrompt', () => {
  it('embeds the JD and asks for a single JSON object', () => {
    const prompt = buildJdMatchPrompt('Senior ML Engineer, 5y PyTorch');
    expect(prompt).toContain('Senior ML Engineer, 5y PyTorch');
    expect(prompt).toContain('ONE JSON object');
  });

  it('truncates an over-long JD', () => {
    const prompt = buildJdMatchPrompt('x'.repeat(10000));
    expect(prompt.length).toBeLessThan(9000);
  });
});
