/**
 * Turns an extraction stream into an HTTP response, with one rule the AI SDK
 * does not give us: if Claude fails before sending any output (a bad API key,
 * a rate limit, an outage), answer with a real error status instead of an
 * empty 200 stream.
 *
 * Written by hand because `toTextStreamResponse()` sends 200 immediately and
 * cannot report errors, and `useObject` on the client needs a plain text stream.
 */
import { APICallError } from 'ai';
import type { extractPosting } from './extract';

type ExtractionResult = ReturnType<typeof extractPosting>;

export async function toTextResponseOrError(result: ExtractionResult): Promise<Response> {
  const parts = result.fullStream[Symbol.asyncIterator]();

  // Skip bookkeeping parts (start, start-step...) until real output or an error arrives.
  let firstPart = await parts.next();
  while (!firstPart.done && firstPart.value.type !== 'text-delta' && firstPart.value.type !== 'error') {
    firstPart = await parts.next();
  }

  if (firstPart.done) {
    return Response.json({ error: 'Claude returned no output. Try again.' }, { status: 502 });
  }
  if (firstPart.value.type === 'error') {
    return errorResponse(firstPart.value.error);
  }
  if (firstPart.value.type !== 'text-delta') {
    return errorResponse(new Error(`Unexpected stream part: ${firstPart.value.type}`));
  }

  // Output has started, so from here on stream the text through as it arrives.
  const firstText = firstPart.value.text;
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(firstText));
    },
    async pull(controller) {
      // Keep reading until there is text to send, the stream ends, or it fails.
      // Returning without enqueuing anything would stall the response for good,
      // because the browser only calls pull() again after new data arrives.
      while (true) {
        const next = await parts.next();
        if (next.done) {
          controller.close();
          return;
        }
        if (next.value.type === 'text-delta') {
          controller.enqueue(encoder.encode(next.value.text));
          return;
        }
        if (next.value.type === 'error') {
          // Too late to change the status; ending the stream with an error lets the client notice.
          controller.error(next.value.error);
          return;
        }
      }
    },
  });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

function errorResponse(error: unknown): Response {
  if (APICallError.isInstance(error) && error.statusCode === 401) {
    return Response.json({ error: 'Anthropic rejected this API key. Check it and try again.' }, { status: 401 });
  }
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return Response.json({ error: 'Anthropic is rate-limiting this key. Wait a moment and try again.' }, { status: 429 });
  }

  console.error('Extraction failed:', error);
  return Response.json({ error: 'Claude could not process this posting. Try again.' }, { status: 502 });
}
