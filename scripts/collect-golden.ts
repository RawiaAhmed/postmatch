/**
 * Weekend 0, step 1: pull posting texts for tracker rows while the URLs still resolve.
 *
 * Reads the job search tracker, fetches each posting through the most reliable
 * source for its host (ATS APIs first, plain HTML last), and writes one text file
 * per posting plus a manifest carrying the tracker's status and notes for labelling.
 *
 * Run: npx tsx scripts/collect-golden.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACKER = join(homedir(), 'Desktop/Jobs/job_search_tracker.csv');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../evals/golden/raw');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh) postmatch-golden/0.1' };
const MIN_CHARS = 800; // below this it is a login wall or an expired stub, not a posting

type TrackerRow = Record<string, string>;

interface ManifestEntry {
  company: string;
  role: string;
  location: string;
  status: string;
  notes: string;
  url: string;
  file: string | null;
  result: string;
  chars?: number;
}

/** RFC 4180 parser: the tracker's notes column holds commas, quotes and newlines. */
function parseCsv(text: string): TrackerRow[] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || record.length) records.push([...record, field]);
  const [header, ...rows] = records.filter((r) => r.some((f) => f.trim()));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '-', ndash: '-', hellip: '...', rarr: '->', larr: '<-', bull: '*', middot: '*',
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', times: 'x', copy: '(c)', reg: '(R)', trade: '(TM)', euro: 'EUR',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(n) ? match : String.fromCodePoint(n);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function stripHtml(s: string): string {
  return decodeEntities(
    s
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Expired WWR and job-board postings 302 to a listing page that returns 200,
  // so a redirect off the original path means the posting is gone.
  if (res.redirected && new URL(res.url).pathname !== new URL(url).pathname) {
    throw new Error(`expired (redirected to ${new URL(res.url).pathname})`);
  }
  return res.text();
}

async function getJson<T>(url: string): Promise<T> {
  return JSON.parse(await get(url)) as T;
}

async function linkedin(url: string): Promise<string> {
  const id = url.match(/(\d{8,})/)?.[1];
  const page = await get(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  const m = page.match(/class="show-more-less-html__markup[^"]*">([\s\S]*?)<\/div>/);
  return m ? stripHtml(m[1]) : '';
}

async function ashby(url: string): Promise<string> {
  const [, board, id] = url.match(/jobs\.ashbyhq\.com\/([^/]+)\/([0-9a-f-]{36})/) ?? [];
  const data = await getJson<{ jobs: { id: string; title: string; location?: string; descriptionPlain?: string }[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${board}`,
  );
  const job = data.jobs.find((j) => j.id === id);
  return job ? `${job.title}\n${job.location ?? ''}\n\n${job.descriptionPlain ?? ''}` : '';
}

async function greenhouse(url: string): Promise<string> {
  const [, board, id] = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/) ?? [];
  const job = await getJson<{ title: string; location: { name: string }; content: string }>(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
  );
  // Greenhouse double-encodes: the content field is entity-escaped HTML.
  return `${job.title}\n${job.location.name}\n\n${stripHtml(decodeEntities(job.content))}`;
}

async function lever(url: string): Promise<string> {
  const [, company, id] = url.match(/jobs\.lever\.co\/([^/]+)\/([0-9a-f-]{36})/) ?? [];
  const job = await getJson<{
    text: string;
    descriptionPlain?: string;
    additionalPlain?: string;
    lists?: { text: string; content: string }[];
  }>(`https://api.lever.co/v0/postings/${company}/${id}`);
  const lists = (job.lists ?? []).map((l) => `${l.text}\n${stripHtml(l.content)}`).join('\n');
  return `${job.text}\n\n${job.descriptionPlain ?? ''}\n${lists}\n${job.additionalPlain ?? ''}`;
}

function fetchPosting(url: string): Promise<string> {
  if (url.includes('linkedin.com')) return linkedin(url);
  if (url.includes('ashbyhq.com')) return ashby(url);
  if (url.includes('greenhouse.io')) return greenhouse(url);
  if (url.includes('lever.co')) return lever(url);
  return get(url).then(stripHtml);
}

function slug(row: TrackerRow): string {
  return `${row.company}_${row.role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 70);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const rows = parseCsv(readFileSync(TRACKER, 'utf8'));
  const manifest: ManifestEntry[] = [];

  // Sequential on purpose: LinkedIn's guest API rate-limits parallel bursts.
  for (const row of rows) {
    const url = row.source_url.trim();
    const entry: ManifestEntry = {
      company: row.company,
      role: row.role,
      location: row.location,
      status: row.status,
      notes: row.notes,
      url,
      file: null,
      result: 'no-url',
    };
    if (url.startsWith('http')) {
      try {
        const text = await fetchPosting(url);
        if (text.length >= MIN_CHARS) {
          const file = `${slug(row)}.txt`;
          writeFileSync(join(OUT, file), `SOURCE: ${url}\n\n${text}\n`);
          Object.assign(entry, { file, result: 'ok', chars: text.length });
        } else {
          entry.result = `too-short (${text.length} chars)`;
        }
      } catch (e) {
        // Expired postings surface here as 404/410.
        entry.result = `error: ${(e as Error).message}`.slice(0, 120);
      }
    }
    manifest.push(entry);
    console.error(`${entry.result.slice(0, 40).padEnd(40)} ${row.company.slice(0, 28)}`);
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const ok = manifest.filter((e) => e.result === 'ok').length;
  console.log(`\n${ok} of ${manifest.length} postings saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
