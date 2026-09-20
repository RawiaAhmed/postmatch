/**
 * Looking a company up in the UK Register of Licensed Sponsors.
 *
 * Server side only: the index is a few megabytes, too much to send to a browser,
 * and it is read once per running instance and then kept in memory.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Built by scripts/build-sponsor-index.ts. Outside public/, so it is never served whole. */
export const SPONSOR_INDEX_FILE = join(process.cwd(), 'data', 'uk-sponsors.txt.gz');
export const SPONSOR_META_FILE = join(process.cwd(), 'data', 'uk-sponsors-meta.json');

/** How current the register is, so the UI can say so instead of implying it is live. */
export type SponsorMeta = {
  /** The date gov.uk published this edition, from its file name. */
  publishedOn: string | null;
  /** The day the index was rebuilt here. */
  builtAt: string;
  organisations: number;
};

export function readSponsorMeta(): SponsorMeta {
  return JSON.parse(readFileSync(SPONSOR_META_FILE, 'utf8')) as SponsorMeta;
}

export type SponsorRecord = {
  /** The normalised name, used as the lookup key. */
  key: string;
  /** The organisation name as the register spells it. */
  name: string;
  town: string;
  /** Visa routes the organisation is licensed for, e.g. "Skilled Worker". */
  routes: string[];
};

/** The answer itself. */
export type SponsorResult =
  | { licensed: true; sponsor: SponsorRecord }
  | { licensed: false; suggestions: SponsorRecord[] };

/** The answer plus how current the register behind it is. */
export type SponsorLookup = SponsorResult & { meta: SponsorMeta };

/**
 * Names in the register are typed by hand and wildly inconsistent: "MONZO BANK
 * LTD", " Monzo Bank Limited ", "Monzo Bank Ltd.". Reducing them to a comparable
 * key is the difference between a usable lookup and a useless one.
 */
export function normaliseCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(
      /\b(limited|ltd|plc|llp|lp|inc|incorporated|corp|corporation|company|co|group|holdings|uk|gmbh|bv|nv|sa|sas|ab|oy|as)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export type Register = Map<string, SponsorRecord>;

/** One organisation per line: key, name, town, routes separated by pipes. */
export function parseRegister(text: string): Register {
  const register: Register = new Map();

  for (const line of text.split('\n')) {
    const [key, name, town, routes] = line.split('\t');
    if (key) register.set(key, { key, name, town, routes: routes ? routes.split('|') : [] });
  }

  return register;
}

let cached: Register | undefined;

/** Read from disk once per running instance, then held in memory. */
function loadRegister(): Register {
  cached ??= parseRegister(gunzipSync(readFileSync(SPONSOR_INDEX_FILE)).toString('utf8'));
  return cached;
}

/**
 * An exact match on the normalised name, or, failing that, organisations whose
 * name contains the query. The suggestions matter: "Monzo" finding "Monzo Bank"
 * is the common case, and silently answering "not licensed" would be wrong.
 */
export function findInRegister(register: Register, company: string, limit = 5): SponsorResult {
  const key = normaliseCompanyName(company);
  if (!key) return { licensed: false, suggestions: [] };

  const sponsors = register;

  const exact = sponsors.get(key);
  if (exact) return { licensed: true, sponsor: exact };

  const suggestions = [...sponsors.values()]
    .filter((sponsor) => sponsor.key.includes(key))
    // Shortest first: the closest name to the query, rather than the longest subsidiary.
    .sort((a, b) => a.key.length - b.key.length)
    .slice(0, limit);

  return { licensed: false, suggestions };
}

/** The same lookup against the register on disk, saying which edition answered. */
export function lookupSponsor(company: string, limit = 5): SponsorLookup {
  return { ...findInRegister(loadRegister(), company, limit), meta: readSponsorMeta() };
}
