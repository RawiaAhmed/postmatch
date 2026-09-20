/**
 * Scoring one extraction against its golden label.
 *
 * Pure and model-free, so it is unit tested like any other code. The runner
 * calls Claude; this file only decides whether an answer was right.
 */
import type { Posting } from '../lib/schema';
import type { GoldenLabel } from './golden/types';

export type FieldResult = {
  field: string;
  passed: boolean;
  expected: string;
  actual: string;
};

export type PostingResult = {
  file: string;
  company: string;
  fields: FieldResult[];
  /** True when sponsorshipEvidence was quoted word for word from the posting. */
  quoteFaithful: boolean;
};

/** The fields a label commits to. Requirement lists are judged separately. */
function show(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') || '(none)' : String(value);
}

/** Order-insensitive and case-insensitive: "Europe, UK" and "uk, europe" agree. */
function sameRegions(expected: string[], actual: string[]): boolean {
  const normalise = (regions: string[]) => [...regions].map((region) => region.toLowerCase().trim()).sort();
  return JSON.stringify(normalise(expected)) === JSON.stringify(normalise(actual));
}

/**
 * A quoted sentence must appear in the posting. Whitespace is collapsed first,
 * because the model reflows line breaks, but nothing else is forgiven: the point
 * of the field is that a human can find the sentence and check it.
 */
export function isQuoteFaithful(quote: string | null, posting: string): boolean {
  if (quote === null) return true;

  const flatten = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  return flatten(posting).includes(flatten(quote));
}

export function scorePosting(label: GoldenLabel, posting: Posting, postingText: string): PostingResult {
  const compare = (field: string, expected: unknown, actual: unknown, passed = expected === actual): FieldResult => ({
    field,
    passed,
    expected: show(expected),
    actual: show(actual),
  });

  return {
    file: label.file,
    company: label.company,
    quoteFaithful: isQuoteFaithful(posting.sponsorshipEvidence, postingText),
    fields: [
      compare('seniority', label.seniority, posting.seniority),
      compare('minYears', label.minYears, posting.minYears),
      compare('remotePolicy', label.remotePolicy, posting.remotePolicy),
      compare('allowedRegions', label.allowedRegions, posting.allowedRegions, sameRegions(label.allowedRegions, posting.allowedRegions)),
      compare('sponsorshipStated', label.sponsorshipStated, posting.sponsorshipStated),
      compare('relocationStated', label.relocationStated, posting.relocationStated),
      compare('languageRequirement', label.languageRequirement, posting.languageRequirement),
      compare('eligible', label.eligible, posting.eligibility.verdict),
    ],
  };
}

export type Accuracy = {
  /** Share of all compared fields that matched, 0 to 1. */
  overall: number;
  /** Share per field name, so a regression points at the field that broke. */
  byField: Record<string, number>;
  /** Share of postings whose sponsorship quote was found in the posting. */
  quoteFaithfulness: number;
  postings: number;
};

export function summarise(results: PostingResult[]): Accuracy {
  const fieldNames = [...new Set(results.flatMap((result) => result.fields.map((field) => field.field)))];

  const shareOf = (fields: FieldResult[]) =>
    fields.length === 0 ? 0 : fields.filter((field) => field.passed).length / fields.length;

  return {
    overall: shareOf(results.flatMap((result) => result.fields)),
    byField: Object.fromEntries(
      fieldNames.map((name) => [name, shareOf(results.flatMap((result) => result.fields.filter((field) => field.field === name)))]),
    ),
    quoteFaithfulness: results.length === 0 ? 0 : results.filter((result) => result.quoteFaithful).length / results.length,
    postings: results.length,
  };
}
