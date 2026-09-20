/**
 * Compacts the UK Register of Licensed Sponsors into the file the app queries.
 *
 *   npm run sponsors:build                     download today's register and rebuild
 *   npm run sponsors:build -- ./local-copy.csv  rebuild from a CSV already on disk
 *
 * gov.uk republishes the register most working days, so re-run this from time to
 * time. A stale copy can say a company cannot sponsor when it now can.
 *
 * The register is the authoritative list of every UK organisation legally able
 * to sponsor a Skilled Worker visa. A company that is not on it cannot hire a
 * candidate who needs sponsorship, however well the posting matches.
 *
 * Source: https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers
 * Published under the Open Government Licence v3.0.
 *
 * The published CSV is about 10 MB over 142,000 rows, most of it repetition: one
 * row per organisation per route. This keeps one line per organisation, which is
 * all a lookup needs.
 */
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import {
  normaliseCompanyName,
  SPONSOR_INDEX_FILE,
  SPONSOR_META_FILE,
  type SponsorMeta,
  type SponsorRecord,
} from '../lib/uk-sponsors';

const GOV_PAGE = 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';

type Row = {
  'Organisation Name': string;
  'Town/City': string;
  Route: string;
};

/**
 * The CSV file name carries its publication date, so it changes daily. Find the
 * link on the gov.uk page rather than hardcoding a URL that goes stale in a day.
 */
async function downloadRegister(): Promise<{ text: string; source: string }> {
  console.log('Finding today\'s register on gov.uk...');
  const page = await fetch(GOV_PAGE).then((response) => response.text());

  const link = page.match(/https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[^"']+Worker[^"']*\.csv/i);
  if (!link) {
    throw new Error(`Could not find the register CSV link on ${GOV_PAGE}. Download it by hand and pass the path.`);
  }

  console.log(`Downloading ${link[0]}`);
  return { text: await fetch(link[0]).then((response) => response.text()), source: link[0] };
}

async function readRegister(): Promise<{ text: string; source: string }> {
  const localPath = process.argv[2];
  return localPath ? { text: readFileSync(localPath, 'utf8'), source: localPath } : downloadRegister();
}

/**
 * The published file name ends in its publication date, which is the only date
 * worth showing: it says how current the answers are, unlike the day we happened
 * to rebuild.
 */
function publishedOn(source: string): string | null {
  return source.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

async function main() {
  const { text, source } = await readRegister();
  const rows: Row[] = parse(text, { columns: true, trim: true, skip_empty_lines: true });

  // One entry per organisation, collecting the routes it is licensed for.
  const sponsors = new Map<string, SponsorRecord>();

  for (const row of rows) {
    const name = row['Organisation Name'];
    if (!name) continue;

    const key = normaliseCompanyName(name);
    const existing = sponsors.get(key);

    if (existing) {
      if (!existing.routes.includes(row.Route)) existing.routes.push(row.Route);
    } else {
      sponsors.set(key, { key, name, town: row['Town/City'] ?? '', routes: [row.Route] });
    }
  }

  const lines = [...sponsors.values()].map((sponsor) =>
    [sponsor.key, sponsor.name, sponsor.town, sponsor.routes.join('|')].join('\t'),
  );

  // Gzipped on disk: it is read once into memory, and the repository stays small.
  writeFileSync(SPONSOR_INDEX_FILE, gzipSync(lines.sort().join('\n'), { level: 9 }));

  const meta: SponsorMeta = {
    publishedOn: publishedOn(source),
    builtAt: new Date().toISOString().slice(0, 10),
    organisations: sponsors.size,
  };
  writeFileSync(SPONSOR_META_FILE, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(`${rows.length} rows -> ${sponsors.size} organisations -> ${SPONSOR_INDEX_FILE}`);
}

main();
