/**
 * Regenerates corpus/cv.md from the master CV PDF.
 *
 *   npm run cv:import -- ~/path/to/Rawia_Ahmed_CV_MASTER.pdf
 *
 * The PDF itself stays out of this repo; only the markdown it produces is
 * committed, and the phone number and personal email are left out of the header
 * on purpose. Needs `pdftotext` (brew install poppler).
 *
 * Reproducible on purpose: when the CV changes, re-run this and `npm run
 * cv:index` rather than hand-editing the markdown and letting it drift.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const HEADER = `# Rawia Ahmed

Technical Team Lead | Senior Frontend Engineer (Angular, React) | AI-Assisted Delivery

El-Gouna, Egypt. rawia.dev | linkedin.com/in/rawia-ahmed-3b372733 | Arabic (native), English (C1)

## Summary
`;

/** Section titles in the CV. Everything else at column 0 is body text. */
const SECTIONS = new Set([
  'Work Experience',
  'Technical Skills',
  'Leadership and Personal Skills',
  'Open Source and Personal Projects',
  'Education',
]);

/** How many header lines of the PDF the hand-written HEADER above replaces. */
const REPLACED_HEADER_LINES = 4;

function toMarkdown(text: string): string {
  const out: string[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) out.push(paragraph.join(' ').replace(/\s+/g, ' ').trim());
    paragraph = [];
  };

  for (const raw of text.split('\n').slice(REPLACED_HEADER_LINES)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      flush();
      out.push('');
      continue;
    }

    const bullet = line.match(/^\s*•\s*(.*)$/);
    // A job or degree entry: title on the left, dates pushed to the right.
    const entry = line.match(/^(\S.*?)\s{3,}(\d{2}\/\d{4} - \S+)$/);

    if (bullet) {
      flush();
      paragraph.push(`- ${bullet[1]}`);
    } else if (entry) {
      flush();
      out.push(`### ${entry[1]} (${entry[2]})`);
    } else if (SECTIONS.has(line.trim())) {
      flush();
      out.push('', `## ${line.trim()}`);
    } else if (/^[A-Za-z][\w.\- ]*: /.test(line)) {
      // A "Label: ..." line (skills group, project entry) starts a new item.
      flush();
      paragraph.push(line.trim());
    } else {
      // Anything else continues the line above: the PDF wraps long sentences.
      paragraph.push(line.trim());
    }
  }
  flush();

  return out
    .join('\n')
    .replace(/(\w)- (\w)/g, '$1-$2') // rejoin words the PDF hyphenated across lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: npm run cv:import -- <path to CV pdf>');
  process.exit(1);
}

const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
writeFileSync('corpus/cv.md', `${HEADER}\n${toMarkdown(text)}\n`);
console.log('Wrote corpus/cv.md. Run `npm run cv:index` next.');
