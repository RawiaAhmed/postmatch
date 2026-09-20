/**
 * Searching the built CV index for evidence behind a requirement.
 *
 * The scoring is a dot product over ~100 unit vectors, which is fast enough to
 * run in the visitor's browser. There is no vector database because at this size
 * one would be pure overhead.
 */
import type { CorpusChunk } from './cv-corpus';
import { similarity } from './embed';

/** A chunk plus the vector built for it by scripts/build-cv-index.ts. */
export type IndexedChunk = CorpusChunk & { vector: number[] };

export type CvIndex = {
  /** The model the vectors were built with. Queries must use the same one. */
  model: string;
  builtAt: string;
  chunks: IndexedChunk[];
};

export type Evidence = {
  chunk: IndexedChunk;
  /** Cosine similarity, 0 to 1. */
  score: number;
};

/**
 * Below this, the best chunk is not evidence, it is the least unrelated line on
 * the CV. Measured against real requirements: genuine matches score 0.42 and up,
 * while requirements the CV cannot support (Python, fluent German, Kubernetes)
 * peak around 0.29. Returning nothing here is the honest answer and the point of
 * the feature.
 */
export const EVIDENCE_THRESHOLD = 0.35;

/** How many supporting lines to show per requirement. */
export const EVIDENCE_LIMIT = 2;

export function findEvidence(
  queryVector: number[],
  index: CvIndex,
  { threshold = EVIDENCE_THRESHOLD, limit = EVIDENCE_LIMIT } = {},
): Evidence[] {
  return index.chunks
    .map((chunk) => ({ chunk, score: similarity(queryVector, chunk.vector) }))
    .filter((evidence) => evidence.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
