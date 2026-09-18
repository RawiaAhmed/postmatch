# postmatch

Paste a job posting, get back structured facts: the requirements, what the posting says about visa sponsorship, and whether someone without local work rights could be hired at all.

Built because I was applying to 80+ roles and needed to know which ones were worth my time. The expensive mistakes are not bad matches, they are postings that were never open to me: "remote" that means remote within one country, "relocation support" that is not visa sponsorship, and an employer of record arrangement that still requires existing work rights.

Next.js 16 (App Router) · TypeScript · Vercel AI SDK · Claude · Zod · Tailwind

---

## What it does today

- **Streams structured output.** The posting is extracted into a typed object that fills in field by field while Claude answers, rather than appearing all at once at the end.
- **Separates "not said" from "not yet."** A field still streaming shows `...`; a field the posting genuinely does not mention shows "Not stated". They mean different things and the UI never conflates them.
- **Quotes its evidence.** The sponsorship verdict carries the sentence it came from, copied word for word, so you can judge it yourself instead of trusting a label.
- **Answers eligibility with reason first, verdict second.** The model writes its reasoning before committing to yes, no, or ask, which is also the order a person would want to read.
- **Runs on your own API key.** The key is sent per request and kept in `sessionStorage`, so it is gone when the tab closes. The deployed site never uses a server-side key, even if one is configured.
- **Has a demo mode.** Three recorded extractions replay at streaming speed, so the app can be tried without a key.

## Decisions worth explaining

**Errors decide the status code before streaming starts.** The AI SDK's text stream response commits to `200 OK` immediately, so a rejected API key arrives as an empty, successful stream. The first output part (or the first error) is read before the response is built, which turns a bad key into a real `401` with a readable message. Streaming and honest error handling are not automatically compatible.

**The schema avoids what Claude's structured outputs reject.** No `minimum`, `maxLength` or similar constraints, and `npm run schema:check` fails the build if one appears. Zod's `.int()` quietly adds safe-integer bounds, which would have failed at request time rather than at review time.

**Optional fields are `.nullable()`, not `.optional()`.** The model must commit to `null` rather than silently omitting a field, so a missing value is always a statement about the posting, not about the response.

**The posting is untrusted input.** It arrives wrapped in `<posting>` tags with an instruction to treat anything inside that reads like a command as part of the posting. Job ads are pasted from anywhere.

**Route files stay thin.** Each API route is a one-line re-export; the work lives in `lib/` where it can be tested directly, without HTTP.

**Posting text is not committed.** The golden set keeps only labels and short quotes. The postings themselves are other companies' content and stay local.

## Running it

```bash
npm install
cp .env.example .env.local   # add your Anthropic key for local development
npm run dev
```

Without a key, the demo buttons still work.

```bash
npm test             # unit tests, no API key needed (mocked model)
npm run typecheck
npm run schema:check # blocks schema features Claude rejects
npm run demo:record  # re-records the demo fixtures, costs a few cents
```

## What is not done yet

Being honest about the boundary, because the interesting part is what comes next.

- **No retrieval yet.** The next step matches each requirement against CV evidence, with citations back to the source line, and says "no evidence found" rather than inventing a match.
- **No tool calling and no approval step.** A sponsor-register lookup is planned, behind an explicit approval click, so the user sees what a tool will do before it runs.
- **No evals yet.** 20 labelled postings are ready in `evals/golden/`, and the extraction already disagrees with two of those labels, which is exactly what the eval suite needs to settle.
- **No accessibility audit.** The streaming state is announced through a polite live region, and errors through an alert, but this has not been tested with a screen reader.

## Licence

MIT
