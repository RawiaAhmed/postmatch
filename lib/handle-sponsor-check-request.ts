/**
 * Everything POST /api/sponsor-check does: looks one company up in the UK
 * Register of Licensed Sponsors.
 *
 * Body:    { "company": "Monzo Bank Ltd" }
 * Returns: whether the company is licensed, or the closest names on the register.
 *
 * Runs on the server because the register is a few megabytes. It needs no API
 * key and calls no model: the answer is a fact from a government list, not an
 * opinion, which is exactly why this is worth doing as a tool.
 */
import { z } from 'zod';
import { lookupSponsor } from './uk-sponsors';

const requestSchema = z.object({
  company: z.string({ error: 'Send the company name to look up.' }),
});

export async function handleSponsorCheckRequest(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  return Response.json(lookupSponsor(parsed.data.company));
}
