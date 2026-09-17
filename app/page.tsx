import { PostingAnalyzer } from '@/components/posting-analyzer';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold">postmatch</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Paste a job posting to see its requirements, sponsorship and eligibility as structured facts.
        </p>
      </header>
      <PostingAnalyzer />
    </main>
  );
}
