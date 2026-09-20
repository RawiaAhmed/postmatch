'use client';

/**
 * How far the CV covers a posting: one percentage, then the working behind it.
 *
 * Matching runs in this browser, so it starts only when asked: the first run
 * downloads the embedding model. A requirement with nothing above the threshold
 * says so, rather than being handed the nearest unrelated line.
 */
import { useState } from 'react';
import { citation } from '@/lib/cv-corpus';
import { matchRequirements, type RequirementGroups, type RequirementMatch } from '@/lib/match-requirements';
import { scoreMatch, type MatchScore } from '@/lib/match-score';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; matches: RequirementGroups<RequirementMatch> }
  | { status: 'error'; message: string };

/** Colour follows the same thresholds the summary line describes. */
function scoreStyle(percentage: number): string {
  if (percentage >= 70) return 'text-green-700 dark:text-green-400';
  if (percentage >= 40) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}

function Score({ score }: { score: MatchScore }) {
  return (
    <div className="flex items-baseline gap-4 rounded-md bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
      <p className={`text-4xl font-semibold tabular-nums ${scoreStyle(score.percentage)}`}>{score.percentage}%</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {score.mustHaveCovered} of {score.mustHaveTotal} required and {score.niceToHaveCovered} of{' '}
        {score.niceToHaveTotal} preferred qualifications have supporting evidence. Required ones count double.
      </p>
    </div>
  );
}

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

function MatchGroup({ title, matches }: { title: string; matches: RequirementMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <ul className="flex flex-col">
        {matches.map((match) => (
          <Match key={match.requirement} match={match} />
        ))}
      </ul>
    </section>
  );
}

export function CvMatch({ groups }: { groups: RequirementGroups<string> }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  const total = groups.mustHave.length + groups.niceToHave.length;

  async function handleMatch() {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', matches: await matchRequirements(groups) });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Matching failed.' });
    }
  }

  if (total === 0) return null;

  const score = state.status === 'ready' ? scoreMatch(state.matches.mustHave, state.matches.niceToHave) : undefined;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Match against the CV</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Runs entirely in your browser. The first run downloads a small embedding model, around 25 MB.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lines are ranked by meaning rather than keywords, so a score says how close the wording is, not that the
          requirement is met. Read the quote and judge it.
        </p>
      </header>

      {state.status === 'idle' && (
        <button
          type="button"
          onClick={handleMatch}
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Match {total} requirements
        </button>
      )}

      {/* Announced once, when the result lands, rather than on every step of it. */}
      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {state.status === 'loading' && 'Loading the model and matching...'}
        {score && `${score.percentage}% match against the CV.`}
      </p>

      {state.status === 'error' && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      )}

      {state.status === 'ready' && score && (
        <>
          <Score score={score} />
          {/*
            The list scrolls on its own so the score stays put and a long posting
            does not push the rest of the page away. tabIndex makes the region
            reachable by keyboard, which a scrollable box otherwise is not.
          */}
          <div
            role="region"
            aria-label="Requirements and the CV evidence behind them"
            tabIndex={0}
            className="max-h-[60vh] overflow-y-auto pr-2"
          >
            <MatchGroup title="Must have" matches={state.matches.mustHave} />
            <MatchGroup title="Nice to have" matches={state.matches.niceToHave} />
          </div>
        </>
      )}
    </section>
  );
}
