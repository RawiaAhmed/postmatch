/**
 * Records real Claude extractions for the demo, so visitors without an API key
 * can still see the app work.
 *
 * Only the extracted facts are saved (fixtures/demo/*.json, committed), never
 * the full posting text, which is third-party content.
 *
 * Needs ANTHROPIC_API_KEY in .env.local. Costs a few cents per run.
 * Run from the project root: npm run demo:record
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAnthropic } from '@ai-sdk/anthropic';
import { loadEnvConfig } from '@next/env';
import { EXTRACTION_MODEL, extractPosting } from '../lib/extract';
import { postingSchema } from '../lib/schema';
import { DEMO_POSTINGS } from '../lib/demo-postings';

loadEnvConfig(process.cwd());

const RAW_DIR = join(process.cwd(), 'evals/golden/raw');
const OUTPUT_DIR = join(process.cwd(), 'fixtures/demo');

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Set ANTHROPIC_API_KEY in .env.local first.');
  }
  const model = createAnthropic({ apiKey })(EXTRACTION_MODEL);

  for (const demo of DEMO_POSTINGS) {
    const postingText = readFileSync(join(RAW_DIR, demo.sourceFile), 'utf8');
    const result = extractPosting(postingText, model);
    const posting = postingSchema.parse(await result.output);

    writeFileSync(join(OUTPUT_DIR, `${demo.id}.json`), JSON.stringify(posting, null, 2) + '\n');
    console.log(`recorded ${demo.id}: ${posting.title} -> ${posting.eligibility.verdict}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
