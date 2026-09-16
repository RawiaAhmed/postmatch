/**
 * Everything POST /api/extract does, kept out of the route file so it can be
 * read and tested on its own.
 *
 * Body:    { "posting": "<the full job posting text>" }
 * Header:  x-anthropic-api-key: <the visitor's own Anthropic key>
 *          (optional in `npm run dev`, which falls back to .env.local)
 * Returns: the Posting object as a text stream, read on the client by useObject.
 *          Errors come back as JSON { "error": "..." } with a 4xx or 5xx status.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { resolveApiKey } from './api-key';
import { EXTRACTION_MODEL, extractPosting } from './extract';
import { toTextResponseOrError } from './stream-response';

const requestSchema = z.object(
  {
    posting: z
      .string()
      .trim()
      .min(200, 'Paste the full posting (at least 200 characters).')
      .max(30_000, 'That is longer than any real posting (30,000 characters at most).'),
  },
  { error: 'Send the posting as JSON: { "posting": "..." }.' },
);

export async function handleExtractRequest(request: Request): Promise<Response> {
  // The visitor's own key, or .env.local during local development. Never stored or logged.
  const apiKey = resolveApiKey(request);
  if (!apiKey) {
    return Response.json({ error: 'Add your Anthropic API key to run an analysis.' }, { status: 401 });
  }

  // A body that is not valid JSON is treated the same as a missing posting.
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const model = createAnthropic({ apiKey })(EXTRACTION_MODEL);
  const result = extractPosting(parsed.data.posting, model);
  return toTextResponseOrError(result);
}
