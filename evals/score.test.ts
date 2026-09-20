import { describe, expect, it } from 'vitest';
import type { Posting } from '../lib/schema';
import type { GoldenLabel } from './golden/types';
import { isQuoteFaithful, scorePosting, summarise } from './score';

const label: GoldenLabel = {
  file: 'example.txt',
  company: 'Example',
  role: 'Senior Frontend Engineer',
  seniority: 'senior',
  minYears: 5,
  remotePolicy: 'remote-restricted',
  allowedRegions: ['Europe', 'UK'],
  sponsorshipStated: 'yes',
  relocationStated: false,
  languageRequirement: null,
  eligible: 'yes',
  evidence: [],
};

const posting: Posting = {
  title: 'Senior Frontend Engineer',
  company: 'Example',
  seniority: 'senior',
  minYears: 5,
  location: 'London',
  remotePolicy: 'remote-restricted',
  allowedRegions: ['uk', 'europe'],
  sponsorshipStated: 'yes',
  sponsorshipEvidence: 'We sponsor visas.',
  relocationStated: false,
  languageRequirement: null,
  eligibility: { reason: 'Sponsorship is offered.', verdict: 'yes' },
  mustHave: [],
  niceToHave: [],
  stack: [],
};

const POSTING_TEXT = 'About the role.\nWe sponsor visas.\nApply now.';

describe('scorePosting', () => {
  it('passes every field when the extraction matches the label', () => {
    const result = scorePosting(label, posting, POSTING_TEXT);

    expect(result.fields.filter((field) => !field.passed)).toEqual([]);
    expect(result.quoteFaithful).toBe(true);
  });

  it('compares regions ignoring order and case', () => {
    const result = scorePosting(label, { ...posting, allowedRegions: ['EUROPE', 'Uk'] }, POSTING_TEXT);

    expect(result.fields.find((field) => field.field === 'allowedRegions')?.passed).toBe(true);
  });

  it('reports what was expected and what came back when a field is wrong', () => {
    const result = scorePosting(label, { ...posting, seniority: 'mid' }, POSTING_TEXT);

    expect(result.fields.find((field) => field.field === 'seniority')).toMatchObject({
      passed: false,
      expected: 'senior',
      actual: 'mid',
    });
  });
});

describe('isQuoteFaithful', () => {
  it('accepts a quote that is in the posting, even across a line break', () => {
    expect(isQuoteFaithful('We sponsor\nvisas.', POSTING_TEXT)).toBe(true);
  });

  it('rejects a quote the posting does not contain', () => {
    expect(isQuoteFaithful('We offer relocation support.', POSTING_TEXT)).toBe(false);
  });

  it('treats no quote as faithful: saying nothing is not inventing something', () => {
    expect(isQuoteFaithful(null, POSTING_TEXT)).toBe(true);
  });
});

describe('summarise', () => {
  it('reports accuracy overall and per field', () => {
    const results = [
      scorePosting(label, posting, POSTING_TEXT),
      scorePosting(label, { ...posting, seniority: 'mid' }, POSTING_TEXT),
    ];

    const accuracy = summarise(results);

    expect(accuracy.postings).toBe(2);
    expect(accuracy.byField.seniority).toBe(0.5);
    expect(accuracy.byField.minYears).toBe(1);
    expect(accuracy.overall).toBeCloseTo(15 / 16);
  });

  it('counts a fabricated quote against faithfulness', () => {
    const results = [scorePosting(label, { ...posting, sponsorshipEvidence: 'Invented sentence.' }, POSTING_TEXT)];

    expect(summarise(results).quoteFaithfulness).toBe(0);
  });
});
