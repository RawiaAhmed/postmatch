/**
 * Guards the golden set: every label must point at a real file, and every
 * evidence quote must appear verbatim in that file. A label justified by a
 * quote the posting does not contain is a fabricated ground truth.
 *
 * Run: npx tsx scripts/verify-labels.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { labels } from '../evals/golden/labels';

const RAW = join(dirname(fileURLToPath(import.meta.url)), '../evals/golden/raw');

// Collapse whitespace on both sides: postings wrap lines where quotes do not.
const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();

let failures = 0;
const seen = new Set<string>();

for (const label of labels) {
  const path = join(RAW, label.file);
  if (seen.has(label.file)) {
    console.log(`DUPLICATE  ${label.file}`);
    failures++;
  }
  seen.add(label.file);

  if (!existsSync(path)) {
    console.log(`MISSING    ${label.file}`);
    failures++;
    continue;
  }
  const text = normalise(readFileSync(path, 'utf8'));
  for (const quote of label.evidence) {
    if (!text.includes(normalise(quote))) {
      console.log(`NOT FOUND  ${label.company}: "${quote}"`);
      failures++;
    }
  }
}

const quotes = labels.reduce((n, l) => n + l.evidence.length, 0);
console.log(`\n${labels.length} labels, ${quotes} quotes, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
