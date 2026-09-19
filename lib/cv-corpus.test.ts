import { describe, expect, it } from 'vitest';
import { chunkMarkdown, citation, embeddingText } from './cv-corpus';

const MARKDOWN = `# Rawia Ahmed

## Work Experience

### Technical Team Lead

- Led a cross-functional team of 8 to 10 engineers through the full delivery lifecycle.
- Short one.

### Senior Developer

Built and maintained RESTful APIs and BFF services using Node.js across the platform.

## Links

See [the repository](https://example.com/repo) for the full \`source\` of this project.
`;

describe('chunkMarkdown', () => {
  const chunks = chunkMarkdown(MARKDOWN, 'cv.md');

  it('makes one chunk per bullet and per paragraph', () => {
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      'Led a cross-functional team of 8 to 10 engineers through the full delivery lifecycle.',
      'Built and maintained RESTful APIs and BFF services using Node.js across the platform.',
      'See the repository for the full source of this project.',
    ]);
  });

  it('drops anything too short to be evidence', () => {
    expect(chunks.map((chunk) => chunk.text)).not.toContain('Short one.');
  });

  it('keeps the headings above each chunk, and closes them at the right level', () => {
    expect(chunks[0].headings).toEqual(['Rawia Ahmed', 'Work Experience', 'Technical Team Lead']);
    expect(chunks[1].headings).toEqual(['Rawia Ahmed', 'Work Experience', 'Senior Developer']);
    expect(chunks[2].headings).toEqual(['Rawia Ahmed', 'Links']);
  });

  it('gives every chunk an id that names its source', () => {
    expect(chunks.map((chunk) => chunk.id)).toEqual(['cv.md#0', 'cv.md#1', 'cv.md#2']);
  });
});

describe('embeddingText', () => {
  it('prefixes the headings so a bare bullet carries its role and employer', () => {
    expect(embeddingText(chunkMarkdown(MARKDOWN, 'cv.md')[0])).toBe(
      'Rawia Ahmed. Work Experience. Technical Team Lead. Led a cross-functional team of 8 to 10 engineers through the full delivery lifecycle.',
    );
  });
});

describe('citation', () => {
  it('names the file and the innermost heading only', () => {
    expect(citation(chunkMarkdown(MARKDOWN, 'cv.md')[0])).toBe('cv.md - Technical Team Lead');
  });

  it('falls back to the file name when there is no heading', () => {
    expect(citation(chunkMarkdown('A paragraph long enough to survive the minimum length.', 'notes.md')[0])).toBe(
      'notes.md',
    );
  });
});
