'use client';

/**
 * Demo mode: replays recorded extractions so anyone can try the app without an API key.
 */
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { DEMO_POSTINGS, type DemoId } from '@/lib/demo-postings';
import { readableError } from '@/lib/readable-error';
import { postingSchema } from '@/lib/schema';
import { requirementGroups } from '@/lib/match-requirements';
import { PostingResult } from './posting-result';
import { CvMatch } from './cv-match';

export function DemoPicker() {
  const { object, submit, isLoading, error } = useObject({
    api: '/api/demo',
    schema: postingSchema,
  });

  function playDemo(id: DemoId) {
    submit({ id });
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">No API key? Try a recorded example</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Real Claude output, replayed at streaming speed.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEMO_POSTINGS.map((demo) => (
          <button
            key={demo.id}
            type="button"
            onClick={() => playDemo(demo.id)}
            disabled={isLoading}
            className="rounded-md border border-zinc-300 px-3 py-2 text-left text-sm disabled:opacity-40 dark:border-zinc-700"
          >
            {demo.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {readableError(error)}
        </p>
      )}

      {/* The percentage first: the extracted facts below are the working behind it. */}
      {object && !isLoading && <CvMatch groups={requirementGroups(object)} />}

      {object && <PostingResult posting={object} />}

    </section>
  );
}
