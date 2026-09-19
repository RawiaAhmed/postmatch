/**
 * Splits the markdown files in corpus/ into the small pieces of evidence that
 * requirement matching retrieves.
 *
 * One chunk is one bullet or one paragraph, because that is the unit a person
 * would quote back: "she migrated AWS to Azure, here is the line that says so".
 * Each chunk keeps the headings above it, so the UI can cite where the evidence
 * came from, and so the embedding sees the employer and role a bullet belongs to
 * rather than a sentence floating free.
 */
import { marked, type Tokens } from 'marked';

export type CorpusChunk = {
  /** Stable across rebuilds: file name plus position, so citations survive re-indexing. */
  id: string;
  /** The sentence as written in the source file. This is what the UI quotes. */
  text: string;
  /** File the chunk came from, e.g. "cv.md". */
  source: string;
  /** Headings above the chunk, outermost first, e.g. ["Work Experience", "Technical Team Lead"]. */
  headings: string[];
};

/** What gets embedded: the headings give a bare bullet its context. */
export function embeddingText(chunk: CorpusChunk): string {
  return [...chunk.headings, chunk.text].join('. ');
}

/**
 * A short citation for the UI, e.g. "cv.md - Technical Team Lead".
 * Only the innermost heading: the outer ones are context for the embedding,
 * but repeating the document title in every citation is noise on screen.
 */
export function citation(chunk: CorpusChunk): string {
  const innermost = chunk.headings.at(-1);
  return innermost ? `${chunk.source} - ${innermost}` : chunk.source;
}

/** Ignore headings, code and anything too short to be evidence. */
const MIN_CHUNK_CHARS = 40;

export function chunkMarkdown(markdown: string, source: string): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  // headings[depth - 1] holds the current heading at that level.
  const headings: string[] = [];

  const add = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < MIN_CHUNK_CHARS) return;
    chunks.push({
      id: `${source}#${chunks.length}`,
      text: clean,
      source,
      headings: headings.filter(Boolean),
    });
  };

  const walk = (tokens: Tokens.Generic[]) => {
    for (const token of tokens) {
      if (token.type === 'heading') {
        const heading = token as Tokens.Heading;
        headings.length = heading.depth - 1;
        headings[heading.depth - 1] = stripMarkdown(heading.text);
      } else if (token.type === 'paragraph') {
        add(stripMarkdown((token as Tokens.Paragraph).text));
      } else if (token.type === 'list') {
        for (const item of (token as Tokens.List).items) add(stripMarkdown(item.text));
      } else if (token.type === 'blockquote') {
        walk((token as Tokens.Blockquote).tokens);
      }
    }
  };

  walk(marked.lexer(markdown));
  return chunks;
}

/** Links and emphasis are noise for both the embedding and the quote. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [label](url) -> label
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
}
