/**
 * Turns text into a vector, using a small sentence-transformer that runs locally.
 *
 * Local on purpose: the CV index is built on this machine and the query is
 * embedded in the visitor's browser, so matching a posting against the CV costs
 * nothing and needs no second API key. The model is ~25MB quantised, downloaded
 * once and then cached by the browser.
 */
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

/** Small, fast, and the usual default for sentence similarity. 384 dimensions. */
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;

let extractor: Promise<FeatureExtractionPipeline> | undefined;

/** Loads the model once and reuses it for every later call. */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' });
  return extractor;
}

/**
 * Embeds each text into a unit-length vector, so similarity is a dot product.
 * Texts are embedded in one batch because the model handles that far faster
 * than one call each.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extract = await getExtractor();
  const output = await extract(texts, { pooling: 'mean', normalize: true });
  return output.tolist() as number[][];
}

/** Both vectors are unit length, so the dot product is the cosine similarity. */
export function similarity(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}
