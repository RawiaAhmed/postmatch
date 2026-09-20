/**
 * The gate that runs in CI.
 *
 * The postings themselves are third-party text and are not committed, so CI
 * cannot call the model. What it can do is hold the committed measurement to
 * account: the accuracy must clear the thresholds, and the run must describe the
 * code as it stands now. Change the prompt or the model without re-running
 * `npm run eval`, and these fail.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXTRACTION_MODEL, SYSTEM_PROMPT } from '../lib/extract';
import thresholds from './thresholds.json';

const results = JSON.parse(readFileSync('evals/results/latest.json', 'utf8')) as {
  model: string;
  promptHash: string;
  ranAt: string;
  accuracy: { overall: number; quoteFaithfulness: number; postings: number };
};

describe('the committed eval run', () => {
  it('was produced by the prompt in the code now', () => {
    const current = createHash('sha256').update(SYSTEM_PROMPT).digest('hex').slice(0, 16);

    expect(results.promptHash, 'The prompt changed. Re-run `npm run eval` and commit the result.').toBe(current);
  });

  it('was produced by the model the app uses now', () => {
    expect(results.model, 'The model changed. Re-run `npm run eval` and commit the result.').toBe(EXTRACTION_MODEL);
  });

  it('covers the whole golden set', () => {
    expect(results.accuracy.postings).toBe(thresholds.postings);
  });

  it('clears the accuracy floor', () => {
    expect(results.accuracy.overall).toBeGreaterThanOrEqual(thresholds.overall);
  });

  it('quoted every sponsorship sentence verbatim', () => {
    // A fabricated quote is worse than no answer: it invites a decision on a sentence nobody wrote.
    expect(results.accuracy.quoteFaithfulness).toBeGreaterThanOrEqual(thresholds.quoteFaithfulness);
  });
});
