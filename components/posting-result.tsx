/**
 * Renders a Posting that may still be streaming, so every field can be missing.
 */
import type { DeepPartial } from 'ai';
import type { Posting } from '@/lib/schema';

type PartialPosting = DeepPartial<Posting>;

const VERDICT_LABEL = { yes: 'Eligible', no: 'Not eligible', ask: 'Ask the employer' } as const;
const VERDICT_STYLE = {
  yes: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  no: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  ask: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
} as const;

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      {/* undefined = not streamed yet; null = the posting does not say */}
      <dd>{value === undefined ? '...' : value === null ? 'Not stated' : value}</dd>
    </div>
  );
}

function RequirementList({ title, items }: { title: string; items: PartialPosting['mustHave'] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 text-xs leading-5 dark:bg-zinc-800">{item?.category}</span>
            <span>{item?.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PostingResult({ posting }: { posting: PartialPosting }) {
  const verdict = posting.eligibility?.verdict;

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <header>
        <h2 className="text-xl font-semibold">{posting.title ?? '...'}</h2>
        <p className="text-zinc-600 dark:text-zinc-400">{posting.company ?? ''}</p>
      </header>

      {verdict && (
        <div className={`rounded-md px-4 py-3 ${VERDICT_STYLE[verdict]}`}>
          <p className="font-semibold">{VERDICT_LABEL[verdict]}</p>
          {posting.eligibility?.reason && <p>{posting.eligibility.reason}</p>}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact label="Seniority" value={posting.seniority} />
        <Fact label="Min. years" value={posting.minYears} />
        <Fact label="Location" value={posting.location} />
        <Fact label="Remote policy" value={posting.remotePolicy} />
        <Fact label="Sponsorship" value={posting.sponsorshipStated} />
        <Fact label="Relocation" value={posting.relocationStated === undefined ? undefined : posting.relocationStated ? 'yes' : 'no'} />
        <Fact label="Language" value={posting.languageRequirement} />
      </dl>

      {posting.sponsorshipEvidence && (
        <blockquote className="border-l-4 border-zinc-300 pl-3 italic dark:border-zinc-700">
          {posting.sponsorshipEvidence}
        </blockquote>
      )}

      <RequirementList title="Must have" items={posting.mustHave} />
      <RequirementList title="Nice to have" items={posting.niceToHave} />

      {!!posting.stack?.length && (
        <section>
          <h3 className="mb-2 font-semibold">Stack</h3>
          <p>{posting.stack.join(', ')}</p>
        </section>
      )}
    </article>
  );
}
