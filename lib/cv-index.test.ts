import { describe, expect, it } from 'vitest';
import { EVIDENCE_THRESHOLD, findEvidence, type CvIndex } from './cv-index';

/** Three chunks on the three axes, so similarity to each is easy to reason about. */
const index: CvIndex = {
  model: 'test',
  builtAt: '2026-01-01T00:00:00.000Z',
  chunks: [
    { id: 'cv.md#0', text: 'Angular', source: 'cv.md', headings: ['Skills'], vector: [1, 0, 0] },
    { id: 'cv.md#1', text: 'Leadership', source: 'cv.md', headings: ['Skills'], vector: [0, 1, 0] },
    { id: 'cv.md#2', text: 'Testing', source: 'cv.md', headings: ['Skills'], vector: [0, 0, 1] },
  ],
};

describe('findEvidence', () => {
  it('returns the closest chunks, best first', () => {
    // Leans towards Angular, with some leadership in it.
    const found = findEvidence([0.8, 0.6, 0], index);

    expect(found.map((evidence) => evidence.chunk.text)).toEqual(['Angular', 'Leadership']);
    expect(found[0].score).toBeCloseTo(0.8);
  });

  it('returns nothing when no chunk clears the threshold', () => {
    // Equal parts of everything, so every score is well under the threshold.
    const spread = 1 / Math.sqrt(3);

    expect(findEvidence([spread, spread, spread], index, { threshold: 0.9 })).toEqual([]);
  });

  it('never returns more than the limit', () => {
    expect(findEvidence([1, 0, 0], index, { threshold: -1, limit: 1 })).toHaveLength(1);
  });

  it('keeps a threshold that separates real matches from unsupported requirements', () => {
    // Guards the measured gap: genuine matches scored 0.42+, unsupported ones 0.29 and below.
    expect(EVIDENCE_THRESHOLD).toBeGreaterThan(0.3);
    expect(EVIDENCE_THRESHOLD).toBeLessThan(0.42);
  });
});
