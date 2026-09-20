/**
 * Runs the extraction over the golden set and scores it.
 *
 *   npm run eval              all postings
 *   npm run eval -- --limit 3 the first 3, for a cheap smoke test
 *
 * Needs ANTHROPIC_API_KEY in .env.local and the posting texts in
 * evals/golden/raw/, which are not committed: they are third-party content.
 * Without them the run stops and says which files are missing.
 *
 * The result is written to evals/results/latest.json and committed, so the
 * published accuracy is a measurement rather than a claim.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { config as loadEnv } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pLimit from 'p-limit';
import { EXTRACTION_MODEL, SYSTEM_PROMPT, extractPosting } from '../lib/extract';
import type { Posting } from '../lib/schema';
import { labels } from './golden/labels';
import { scorePosting, summarise, type PostingResult } from './score';

// Next.js reads .env.local on its own; a plain script has to be told.
loadEnv({ path: '.env.local', quiet: true });

const RAW_DIR = join('evals', 'golden', 'raw');
const RESULTS_FILE = join('evals', 'results', 'latest.json');

/** Claude's rate limits are the constraint, not this machine. */
const CONCURRENCY = 4;

function parseLimit(): number {
  const flag = process.argv.indexOf('--limit');
  return flag === -1 ? labels.length : Number(process.argv[flag + 1]);
}

async function extract(postingText: string, model: ReturnType<typeof createAnthropic>): Promise<Posting> {
  // The eval wants the finished object, not the stream the UI consumes.
  return extractPosting(postingText, model(EXTRACTION_MODEL)).output;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY in .env.local first.');

  const selected = labels.slice(0, parseLimit());

  const missing = selected.filter((label) => !existsSync(join(RAW_DIR, label.file)));
  if (missing.length > 0) {
    throw new Error(`Missing posting texts in ${RAW_DIR}:\n  ${missing.map((label) => label.file).join('\n  ')}`);
  }

  const anthropic = createAnthropic({ apiKey });
  const limit = pLimit(CONCURRENCY);

  console.log(`Extracting ${selected.length} postings with ${EXTRACTION_MODEL}...`);

  const results: PostingResult[] = await Promise.all(
    selected.map((label) =>
      limit(async () => {
        const postingText = readFileSync(join(RAW_DIR, label.file), 'utf8');
        const posting = await extract(postingText, anthropic);
        const result = scorePosting(label, posting, postingText);

        const failed = result.fields.filter((field) => !field.passed);
        console.log(`  ${failed.length === 0 && result.quoteFaithful ? 'ok  ' : 'FAIL'} ${label.company}`);
        return result;
      }),
    ),
  );

  const accuracy = summarise(results);

  console.log(`\nOverall  ${(accuracy.overall * 100).toFixed(1)}%  over ${accuracy.postings} postings`);
  console.log(`Quotes   ${(accuracy.quoteFaithfulness * 100).toFixed(1)}% found verbatim in the posting`);
  for (const [field, share] of Object.entries(accuracy.byField).sort((a, b) => a[1] - b[1])) {
    console.log(`  ${field.padEnd(20)} ${(share * 100).toFixed(0)}%`);
  }

  for (const result of results) {
    for (const field of result.fields.filter((field) => !field.passed)) {
      console.log(`\n  ${result.company} / ${field.field}\n    expected ${field.expected}\n    actual   ${field.actual}`);
    }
  }

  // A partial run is a smoke test, not a measurement, so it never overwrites the
  // committed result. Only a full run is allowed to speak for the golden set.
  if (selected.length < labels.length) {
    console.log(`\nPartial run of ${selected.length} of ${labels.length}: ${RESULTS_FILE} left alone.`);
    return;
  }

  mkdirSync(join('evals', 'results'), { recursive: true });
  writeFileSync(
    RESULTS_FILE,
    `${JSON.stringify(
      {
        model: EXTRACTION_MODEL,
        // Changing the prompt without re-running the evals leaves this behind,
        // and the committed result stops describing the code. A test catches that.
        promptHash: createHash('sha256').update(SYSTEM_PROMPT).digest('hex').slice(0, 16),
        ranAt: new Date().toISOString(),
        accuracy,
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nWrote ${RESULTS_FILE}`);
}

main();
