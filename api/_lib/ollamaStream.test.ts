import { describe, expect, it } from 'vitest';
import { parseNdjson, type OllamaChunk } from './ollamaStream';

function streamOf(...byteChunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of byteChunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<OllamaChunk[]> {
  const out: OllamaChunk[] = [];
  for await (const chunk of parseNdjson(stream)) out.push(chunk);
  return out;
}

describe('parseNdjson', () => {
  it('parses one object per newline-delimited line', async () => {
    const chunks = await collect(
      streamOf(
        '{"message":{"content":"Hel"}}\n{"message":{"content":"lo"}}\n{"done":true,"eval_count":2}\n',
      ),
    );
    expect(chunks.map((c) => c.message?.content ?? '').join('')).toBe('Hello');
    expect(chunks.at(-1)).toMatchObject({ done: true, eval_count: 2 });
  });

  it('reassembles a JSON object split across byte-chunk boundaries', async () => {
    const chunks = await collect(
      streamOf('{"message":{"con', 'tent":"split"}}\n', '{"done":true}\n'),
    );
    expect(chunks[0].message?.content).toBe('split');
    expect(chunks[1].done).toBe(true);
  });

  it('parses a final line with no trailing newline', async () => {
    const chunks = await collect(streamOf('{"message":{"content":"tail"}}'));
    expect(chunks[0].message?.content).toBe('tail');
  });
});
