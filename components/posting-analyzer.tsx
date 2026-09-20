'use client';

/**
 * Paste a posting, watch the extracted facts stream in field by field.
 *
 * States: idle -> streaming -> done | error | stopped.
 */
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useState } from 'react';
import { readableError } from '@/lib/readable-error';
import { postingSchema } from '@/lib/schema';
import { requirementGroups } from '@/lib/match-requirements';
import { PostingResult } from './posting-result';
import { CvMatch } from './cv-match';
import { SponsorCheck } from './sponsor-check';

const API_KEY_STORAGE = 'postmatch:anthropic-api-key';

function loadSavedKey(): string {
  try {
    return sessionStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return ''; // storage blocked, e.g. private browsing
  }
}

export function PostingAnalyzer() {
  const [posting, setPosting] = useState('');
  const [apiKey, setApiKey] = useState(loadSavedKey);
  const [wasStopped, setWasStopped] = useState(false);

  const { object, submit, stop, isLoading, error } = useObject({
    api: '/api/extract',
    schema: postingSchema,
    // A function, so the latest key is read at submit time, not when the hook was created.
    headers: (): Record<string, string> => (apiKey ? { 'x-anthropic-api-key': apiKey } : {}),
  });

  function handleKeyChange(value: string) {
    setApiKey(value);
    try {
      // sessionStorage: the key is forgotten when the tab closes, and never sent anywhere but our own API.
      sessionStorage.setItem(API_KEY_STORAGE, value);
    } catch {
      // storage blocked; the key still works for this page view
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setWasStopped(false);
    submit({ posting });
  }

  function handleStop() {
    stop();
    setWasStopped(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Anthropic API key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => handleKeyChange(event.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="font-normal text-zinc-500">Kept in this tab only. Optional when running locally with .env.local.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Job posting
          <textarea
            value={posting}
            onChange={(event) => setPosting(event.target.value)}
            rows={12}
            placeholder="Paste the full text of a job posting..."
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading || posting.trim() === ''}
            className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isLoading ? 'Analysing...' : 'Analyse posting'}
          </button>
          {isLoading && (
            <button type="button" onClick={handleStop} className="rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700">
              Stop
            </button>
          )}
        </div>
      </form>

      {/* Announced to screen readers once per change, not on every streamed token. */}
      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {isLoading && 'Analysing the posting...'}
        {!isLoading && wasStopped && 'Stopped. Showing what arrived before you stopped.'}
        {!isLoading && !wasStopped && object && !error && `Done: ${object.mustHave?.length ?? 0} required and ${object.niceToHave?.length ?? 0} preferred qualifications found.`}
      </p>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {readableError(error)}
        </p>
      )}

      {/* The percentage first: the extracted facts below are the working behind it. */}
      {object && !isLoading && <CvMatch groups={requirementGroups(object)} />}

      {object && !isLoading && <SponsorCheck company={object.company ?? null} location={object.location ?? null} />}

      {object && <PostingResult posting={object} />}

    </div>
  );
}
