'use client';

/**
 * Requirement by requirement, what on the CV supports it, quoted and cited.
 *
 * Matching runs in this browser, so it starts only when asked: the first run
 * downloads the embedding model. A requirement with nothing above the threshold
 * says so, rather than being handed the nearest unrelated line.
 */
import { useState } from 'react';
import { citation } from '@/lib/cv-corpus';
import { matchRequirements, type RequirementMatch } from '@/lib/match-requirements';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; matches: RequirementMatch[] }
  | { status: 'error'; message: string };

function Match({ match }: { match: RequirementMatch }) {
  return (
    <li className="border-t border-zinc-200 py-3 first:border-t-0 dark:border-zinc-800">
      <p className="font-medium">{match.requirement}</p>

      {match.evidence.length === 0 ? (
        <p className="mt-1 text-amber-700 dark:text-amber-400">No evidence found in the CV.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-2">
          {match.evidence.map(({ chunk, score }) => (
            <li key={chunk.id} className="border-l-4 border-zinc-300 pl-3 dark:border-zinc-700">
              <p>{chunk.text}</p>
              <p className="text-xs text-zinc-500">
                {citation(chunk)} · {Math.round(score * 100)}% similar
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CvMatch({ requirements }: { requirements: string[] }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function handleMatch() {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', matches: await matchRequirements(requirements) });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Matching failed.' });
    }
  }

  if (requirements.length === 0) return null;

  const supported = state.status === 'ready' ? state.matches.filter((match) => match.evidence.length > 0).length : 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <header>
        <h2 className="text-xl font-semibold">Evidence from the CV</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Runs entirely in your browser. The first run downloads a small embedding model, around 25 MB.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lines are ranked by meaning rather than keywords, so the score says how close the wording is, not that the
          requirement is met. Read the quote and judge it.
        </p>
      </header>

      {state.status === 'idle' && (
        <button
          type="button"
          onClick={handleMatch}
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Match {requirements.length} requirements
        </button>
      )}

      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {state.status === 'loading' && 'Loading the model and matching...'}
        {state.status === 'ready' && `${supported} of ${state.matches.length} requirements have supporting evidence.`}
      </p>

      {state.status === 'error' && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      )}

      {state.status === 'ready' && (
        <ul className="flex flex-col">
          {state.matches.map((match) => (
            <Match key={match.requirement} match={match} />
          ))}
        </ul>
      )}
    </section>
  );
}
