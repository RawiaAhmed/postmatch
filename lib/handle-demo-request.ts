/**
 * Everything POST /api/demo does: replays a recorded extraction as a stream,
 * so the page behaves exactly as it does with a real key, at no cost.
 *
 * Body:    { "id": "n8n" | "personio" | "synthesia" }
 * Returns: the recorded Posting JSON, streamed in small pieces.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { simulateReadableStream } from 'ai';
import { z } from 'zod';
import { DEMO_POSTINGS } from './demo-postings';

const CHUNK_SIZE = 12; // characters per piece: roughly the size of a streamed token
const CHUNK_DELAY_MS = 15;

const demoIds = DEMO_POSTINGS.map((demo) => demo.id) as [string, ...string[]];
const requestSchema = z.object({ id: z.enum(demoIds, { error: 'Pick one of the demo postings.' }) }, { error: 'Pick one of the demo postings.' });

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += CHUNK_SIZE) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
  }
  return chunks;
}

export async function handleDemoRequest(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const fixturePath = join(process.cwd(), 'fixtures/demo', `${parsed.data.id}.json`);
  const recording = await readFile(fixturePath, 'utf8').catch(() => null);
  if (recording === null) {
    return Response.json({ error: 'This demo has not been recorded yet. Run npm run demo:record.' }, { status: 404 });
  }

  const stream = simulateReadableStream({
    chunks: splitIntoChunks(recording),
    chunkDelayInMs: CHUNK_DELAY_MS,
  }).pipeThrough(new TextEncoderStream());

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
