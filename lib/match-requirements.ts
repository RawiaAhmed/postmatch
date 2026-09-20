/**
 * Matching a posting's requirements against the CV, in the browser.
 *
 * Nothing here touches the server: the index is a static file and the model runs
 * on the visitor's machine, so this costs no API key and no request. The first
 * call downloads the model, which is why the UI asks before starting it.
 */
import type { DeepPartial } from 'ai';
import { findEvidence, type CvIndex, type Evidence } from './cv-index';
import { EMBEDDING_MODEL, embed } from './embed';
import type { Posting } from './schema';

export type RequirementMatch = {
  /** The requirement, as the posting states it. */
  requirement: string;
  /** Supporting lines from the CV, best first. Empty means no evidence found. */
  evidence: Evidence[];
};

let index: Promise<CvIndex> | undefined;

/** Fetched once per page load; the browser caches the file after that. */
export function loadCvIndex(): Promise<CvIndex> {
  index ??= fetch('/cv-index.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load the CV index (${response.status})`);
      return response.json() as Promise<CvIndex>;
    })
    .then((loaded) => {
      // Vectors from two different models are not comparable, so fail loudly.
      if (loaded.model !== EMBEDDING_MODEL) {
        throw new Error(`The CV index was built with ${loaded.model}, but this build uses ${EMBEDDING_MODEL}.`);
      }
      return loaded;
    })
    .catch((error: unknown) => {
      index = undefined; // let the next attempt retry rather than replay the failure
      throw error;
    });

  return index;
}

export async function matchRequirements(requirements: string[]): Promise<RequirementMatch[]> {
  const [cvIndex, vectors] = await Promise.all([loadCvIndex(), embed(requirements)]);

  return requirements.map((requirement, position) => ({
    requirement,
    evidence: findEvidence(vectors[position], cvIndex),
  }));
}

/**
 * Every requirement of a posting, required and preferred together, in one list.
 * Fields can still be missing while the posting streams, and the same wording
 * sometimes appears in both lists, so both are handled here.
 */
export function requirementTexts(posting: DeepPartial<Posting>): string[] {
  const texts = [...(posting.mustHave ?? []), ...(posting.niceToHave ?? [])]
    .map((requirement) => requirement?.text)
    .filter((text): text is string => Boolean(text));

  return [...new Set(texts)];
}
