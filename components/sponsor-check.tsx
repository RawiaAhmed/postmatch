'use client';

/**
 * One tool, run only after an explicit click.
 *
 * The approval step is the point: the card says exactly what will run and what
 * leaves the browser before anything happens, rather than firing a lookup the
 * moment a posting mentions a company. Nothing here reaches a model; the answer
 * is a fact read from a government list.
 */
import { useState } from 'react';
import type { SponsorLookup } from '@/lib/uk-sponsors';

type State =
  | { status: 'proposed' }
  | { status: 'running' }
  | { status: 'skipped' }
  | { status: 'done'; result: SponsorLookup }
  | { status: 'error'; message: string };

const REGISTER_URL = 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';

/** Which edition answered, so a stale copy is visible rather than implied to be live. */
function Edition({ meta }: { meta: SponsorLookup['meta'] }) {
  return (
    <p className="text-xs text-zinc-500">
      {meta.organisations.toLocaleString('en-GB')} organisations, from the register gov.uk published on{' '}
      {meta.publishedOn ?? meta.builtAt}. It is republished most working days, so a very recent licence may be missing.
    </p>
  );
}

function Result({ company, result }: { company: string; result: SponsorLookup }) {
  if (result.licensed) {
    return (
      <div className="rounded-md bg-green-100 px-4 py-3 text-green-900 dark:bg-green-950 dark:text-green-200">
        <p className="font-semibold">{result.sponsor.name} is on the register.</p>
        <p>
          {result.sponsor.town && `${result.sponsor.town}. `}
          Licensed for: {result.sponsor.routes.join(', ')}.
        </p>
      </div>
    );
  }

  if (result.suggestions.length > 0) {
    return (
      <div className="rounded-md bg-amber-100 px-4 py-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-semibold">Nothing licensed under exactly &quot;{company}&quot;.</p>
        <p>These names on the register contain it, and one may be the same employer:</p>
        <ul className="mt-1 list-disc pl-5">
          {result.suggestions.map((sponsor) => (
            <li key={sponsor.key}>
              {sponsor.name}
              {sponsor.town && ` (${sponsor.town})`}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">Not on the register.</p>
      <p>
        An organisation that is not listed cannot sponsor a UK Skilled Worker visa. If the role is outside the UK, the
        register does not apply and says nothing either way.
      </p>
    </div>
  );
}

export function SponsorCheck({ company, location }: { company: string | null; location: string | null }) {
  const [state, setState] = useState<State>({ status: 'proposed' });

  async function handleRun() {
    if (!company) return;
    setState({ status: 'running' });
    try {
      const response = await fetch('/api/sponsor-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      if (!response.ok) throw new Error(`The lookup failed (${response.status}).`);
      setState({ status: 'done', result: (await response.json()) as SponsorLookup });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'The lookup failed.' });
    }
  }

  // Nothing to look up, so nothing to propose.
  if (!company) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <header>
        <h2 className="text-xl font-semibold">Check the UK sponsor register</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The{' '}
          <a href={REGISTER_URL} target="_blank" rel="noreferrer" className="underline">
            Register of Licensed Sponsors
          </a>{' '}
          lists every UK organisation legally able to sponsor a work visa. A company that is absent cannot, whatever the
          posting says.
        </p>
      </header>

      {state.status === 'proposed' && (
        <>
          {/* What will run, before it runs. */}
          <dl className="rounded-md bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
            <div className="flex gap-2">
              <dt className="text-zinc-500">Will look up</dt>
              <dd className="font-mono">{company}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Against</dt>
              <dd>a copy of the register held on this site</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Sends</dt>
              <dd>the company name only, to this site. No model, no third party.</dd>
            </div>
          </dl>

          {location && !/united kingdom|uk|england|scotland|wales|northern ireland|london/i.test(location) && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This posting is for {location}. The register covers the UK only, so a miss here would mean nothing.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRun}
              className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Run the check
            </button>
            <button
              type="button"
              onClick={() => setState({ status: 'skipped' })}
              className="rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            >
              Skip
            </button>
          </div>
        </>
      )}

      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {state.status === 'running' && 'Looking the company up...'}
        {state.status === 'skipped' && 'Skipped. The register was not queried.'}
      </p>

      {state.status === 'error' && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      )}

      {state.status === 'done' && (
        <>
          <Result company={company} result={state.result} />
          <Edition meta={state.result.meta} />
        </>
      )}
    </section>
  );
}
