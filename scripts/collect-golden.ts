/**
 * Saves the text of every job posting in the tracker, so the golden set
 * survives after the original links expire.
 *
 * For each tracker row it fetches the posting (from the job board's API when
 * there is one, otherwise the page itself) and writes:
 *   evals/golden/raw/<company>_<role>.txt   one file per posting
 *   evals/golden/raw/manifest.json          what happened to every row
 *
 * Run from the project root: npm run golden:collect
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { decode } from 'html-entities';
import { convert, type HtmlToTextOptions } from 'html-to-text';

const TRACKER_PATH = join(homedir(), 'Desktop/Jobs/job_search_tracker.csv');
const OUTPUT_DIR = join(process.cwd(), 'evals/golden/raw');

// Anything shorter than this is a login wall or an expired page, not a posting.
const MIN_POSTING_LENGTH = 800;

const REQUEST_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh) postmatch-golden/0.1' };

// Plain text as close to the posting's own wording as possible: no line
// wrapping, no link URLs, no images, and headings left in their original case.
const TEXT_OPTIONS: HtmlToTextOptions = {
  wordwrap: false,
  selectors: [
    { selector: 'script', format: 'skip' },
    { selector: 'style', format: 'skip' },
    { selector: 'img', format: 'skip' },
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'h1', options: { uppercase: false } },
    { selector: 'h2', options: { uppercase: false } },
    { selector: 'h3', options: { uppercase: false } },
    { selector: 'h4', options: { uppercase: false } },
    { selector: 'h5', options: { uppercase: false } },
    { selector: 'h6', options: { uppercase: false } },
    { selector: 'table', options: { uppercaseHeaderCells: false } },
  ],
};

interface TrackerRow {
  company: string;
  role: string;
  location: string;
  status: string;
  notes: string;
  source_url: string;
}

interface ManifestEntry {
  company: string;
  role: string;
  location: string;
  status: string;
  notes: string;
  url: string;
  file: string | null;
  result: string;
}

// ---------- Fetching ----------

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // An expired posting often redirects to the board's home page, which still returns 200.
  const redirectedElsewhere = new URL(response.url).pathname !== new URL(url).pathname;
  if (redirectedElsewhere) {
    throw new Error('expired (redirected)');
  }

  return response.text();
}

async function fetchFromLinkedIn(url: string): Promise<string> {
  const jobId = url.match(/\d{8,}/)?.[0];
  const page = await fetchText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`);

  // Keep only the description block; return nothing if LinkedIn served a page without one.
  return convert(page, {
    ...TEXT_OPTIONS,
    baseElements: { selectors: ['.show-more-less-html__markup'], returnDomByDefault: false },
  });
}

async function fetchFromAshby(url: string): Promise<string> {
  // URL shape: jobs.ashbyhq.com/<board>/<job id>
  const [, board, jobId] = new URL(url).pathname.split('/');
  const body = await fetchText(`https://api.ashbyhq.com/posting-api/job-board/${board}`);

  const jobs: { id: string; title: string; location: string; descriptionPlain: string }[] = JSON.parse(body).jobs;
  const job = jobs.find((candidate) => candidate.id === jobId);
  return job ? `${job.title}\n${job.location}\n\n${job.descriptionPlain}` : '';
}

async function fetchFromGreenhouse(url: string): Promise<string> {
  // URL shape: job-boards.greenhouse.io/<board>/jobs/<job id>
  const [, board, , jobId] = new URL(url).pathname.split('/');
  const body = await fetchText(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`);

  const job: { title: string; location: { name: string }; content: string } = JSON.parse(body);
  // Greenhouse escapes the HTML itself ("&lt;p&gt;"), so decode it before converting.
  return `${job.title}\n${job.location.name}\n\n${convert(decode(job.content), TEXT_OPTIONS)}`;
}

async function fetchFromLever(url: string): Promise<string> {
  // URL shape: jobs.lever.co/<company>/<job id>
  const [, company, jobId] = new URL(url).pathname.split('/');
  const body = await fetchText(`https://api.lever.co/v0/postings/${company}/${jobId}`);

  const job: {
    text: string;
    descriptionPlain: string;
    additionalPlain: string;
    lists: { text: string; content: string }[];
  } = JSON.parse(body);
  const lists = job.lists.map((list) => `${list.text}\n${convert(list.content, TEXT_OPTIONS)}`).join('\n');
  return `${job.text}\n\n${job.descriptionPlain}\n${lists}\n${job.additionalPlain}`;
}

async function fetchPosting(url: string): Promise<string> {
  const host = new URL(url).hostname;

  if (host.endsWith('linkedin.com')) return fetchFromLinkedIn(url);
  if (host === 'jobs.ashbyhq.com') return fetchFromAshby(url);
  if (host.endsWith('greenhouse.io')) return fetchFromGreenhouse(url);
  if (host === 'jobs.lever.co') return fetchFromLever(url);

  const page = await fetchText(url);
  return convert(page, TEXT_OPTIONS);
}

// ---------- Saving ----------

// Written by hand on purpose: the `slugify` library drops "/" and "-" without a
// separator ("m/w/x" becomes "mwx"), which reads worse and would rename files
// the golden labels already point to.
function fileNameFor(row: TrackerRow): string {
  const slug = `${row.company}_${row.role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${slug.slice(0, 70)}.txt`;
}

async function collectRow(row: TrackerRow): Promise<ManifestEntry> {
  const url = row.source_url.trim();
  const entry: ManifestEntry = {
    company: row.company,
    role: row.role,
    location: row.location,
    status: row.status,
    notes: row.notes,
    url,
    file: null,
    result: 'no url',
  };

  if (!url.startsWith('http')) {
    return entry;
  }

  try {
    const text = (await fetchPosting(url)).trim();
    if (text.length < MIN_POSTING_LENGTH) {
      return { ...entry, result: `too short (${text.length} chars)` };
    }

    const file = fileNameFor(row);
    writeFileSync(join(OUTPUT_DIR, file), `SOURCE: ${url}\n\n${text}\n`);
    return { ...entry, file, result: 'ok' };
  } catch (error) {
    return { ...entry, result: `error: ${(error as Error).message}` };
  }
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const rows: TrackerRow[] = parse(readFileSync(TRACKER_PATH), { columns: true, skip_empty_lines: true });

  const manifest: ManifestEntry[] = [];
  // One at a time on purpose: LinkedIn blocks bursts of parallel requests.
  for (const row of rows) {
    const entry = await collectRow(row);
    manifest.push(entry);
    console.log(`${entry.result.slice(0, 40).padEnd(40)} ${row.company}`);
  }

  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const savedCount = manifest.filter((entry) => entry.result === 'ok').length;
  console.log(`\nSaved ${savedCount} of ${rows.length} postings to ${OUTPUT_DIR}`);
}

main();
