/**
 * Builds public/cv-index.json from the markdown files in corpus/.
 *
 * Run it after editing anything in corpus/:  npm run cv:index
 *
 * The index is committed so the deployed app can fetch it as a static file.
 * It holds only what is already public on the CV and the project READMEs.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chunkMarkdown, embeddingText, type CorpusChunk } from '../lib/cv-corpus';
import { EMBEDDING_MODEL, embed } from '../lib/embed';

const CORPUS_DIR = 'corpus';
const OUTPUT_FILE = 'public/cv-index.json';

/** Four decimals is far below the noise floor of the model and keeps the file small. */
function round(vector: number[]): number[] {
  return vector.map((value) => Number(value.toFixed(4)));
}

async function main() {
  const files = readdirSync(CORPUS_DIR).filter((name) => name.endsWith('.md')).sort();

  const chunks: CorpusChunk[] = files.flatMap((file) =>
    chunkMarkdown(readFileSync(join(CORPUS_DIR, file), 'utf8'), file),
  );

  console.log(`Embedding ${chunks.length} chunks from ${files.length} files...`);
  const vectors = await embed(chunks.map(embeddingText));

  writeFileSync(
    OUTPUT_FILE,
    // Not pretty-printed: it is generated, and the indentation would be most of the file.
    JSON.stringify({
      model: EMBEDDING_MODEL,
      builtAt: new Date().toISOString(),
      chunks: chunks.map((chunk, index) => ({ ...chunk, vector: round(vectors[index]) })),
    }),
  );

  console.log(`Wrote ${OUTPUT_FILE}`);
}

main();
