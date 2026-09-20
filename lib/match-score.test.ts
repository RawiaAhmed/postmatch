import { describe, expect, it } from 'vitest';
import { scoreMatch } from './match-score';
import type { RequirementMatch } from './match-requirements';

/** Only whether evidence was found matters here, so the chunk itself can be a stub. */
function match(requirement: string, hasEvidence: boolean): RequirementMatch {
  return {
    requirement,
    evidence: hasEvidence
      ? [{ score: 0.5, chunk: { id: 'cv.md#0', text: 'evidence', source: 'cv.md', headings: [], vector: [] } }]
      : [],
  };
}

describe('scoreMatch', () => {
  it('is 100 when every requirement has evidence', () => {
    expect(scoreMatch([match('a', true)], [match('b', true)]).percentage).toBe(100);
  });

  it('is 0 when none has', () => {
    expect(scoreMatch([match('a', false)], [match('b', false)]).percentage).toBe(0);
  });

  it('counts a must-have as double a nice-to-have', () => {
    // One of two must-haves covered, both nice-to-haves missing: 2 of 6.
    expect(scoreMatch([match('a', true), match('b', false)], [match('c', false), match('d', false)]).percentage).toBe(33);

    // The mirror case: both nice-to-haves covered, both must-haves missing: 2 of 6.
    expect(scoreMatch([match('a', false), match('b', false)], [match('c', true), match('d', true)]).percentage).toBe(33);
  });

  it('reports the counts behind the percentage, so it can be checked by hand', () => {
    expect(scoreMatch([match('a', true), match('b', false)], [match('c', true)])).toEqual({
      percentage: 60, // (2 + 1) of (4 + 1)
      mustHaveCovered: 1,
      mustHaveTotal: 2,
      niceToHaveCovered: 1,
      niceToHaveTotal: 1,
    });
  });

  it('scores an empty posting 0 rather than a perfect match', () => {
    expect(scoreMatch([], []).percentage).toBe(0);
  });
});
