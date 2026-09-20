# postmatch

[![CI](https://github.com/RawiaAhmed/postmatch/actions/workflows/ci.yml/badge.svg)](https://github.com/RawiaAhmed/postmatch/actions/workflows/ci.yml)

Paste a job posting, get back structured facts: the requirements, what the posting says about visa sponsorship, whether someone without local work rights could be hired at all, and which lines of my CV actually support each requirement.

Built because I was applying to 80+ roles and needed to know which ones were worth my time. The expensive mistakes are not bad matches, they are postings that were never open to me: "remote" that means remote within one country, "relocation support" that is not visa sponsorship, and an employer of record arrangement that still requires existing work rights.

Live at [postmatch.rawia.dev](https://postmatch.rawia.dev).

Next.js 16 (App Router) · TypeScript · Vercel AI SDK · Claude · transformers.js · Zod · Tailwind

---

## What it does

- **Streams structured output.** The posting is extracted into a typed object that fills in field by field while Claude answers, rather than appearing all at once at the end.
- **Separates "not said" from "not yet."** A field still streaming shows `...`; a field the posting genuinely does not mention shows "Not stated". They mean different things and the UI never conflates them.
- **Quotes its evidence.** The sponsorship verdict carries the sentence it came from, copied word for word, so you can judge it yourself instead of trusting a label.
- **Matches requirements against a CV, with citations.** Each requirement is shown with the CV lines that support it, quoted and cited back to their section. Where nothing clears the similarity threshold it says "No evidence found in the CV" instead of stretching the nearest line.
- **Scores the whole posting.** One percentage, weighted so a required qualification counts double a preferred one, with the counts printed next to it so anyone can recompute it by hand.
- **Checks the UK sponsor register, after an approval click.** The card states what will be looked up, against what, and what leaves the browser. Nothing runs until you click.
- **Runs on your own API key.** The key is sent per request and kept in `sessionStorage`, so it is gone when the tab closes. The deployed site never uses a server-side key, even if one is configured.
- **Has a demo mode.** Three recorded extractions replay at streaming speed, so the app can be tried without a key.

## Measured, not claimed

20 labelled postings, scored field by field against `claude-opus-5`. Run it yourself with `npm run eval`; the committed result is in [`evals/results/latest.json`](evals/results/latest.json).

| | |
|---|---|
| Overall | **90.0%** (144 of 160 fields) |
| Sponsorship quotes found verbatim in the posting | **100%** |
| `sponsorshipStated`, `relocationStated`, `minYears`, `allowedRegions` | 95% |
| `languageRequirement` | 90% |
| `seniority`, `remotePolicy` | 85% |
| `eligible` | 80% |

Two full runs differed by one field, so treat a single point of movement as noise rather than a regression.

Several of the 16 misses are arguably the model being right and the label being wrong, which is the useful part: the set is now a place to settle those arguments rather than have them twice.

**CI cannot call the model,** because the posting texts are other companies' content and are not committed. So it holds the committed measurement to account instead: the accuracy must clear the floors in `evals/thresholds.json`, and the run must carry the hash of the prompt and the name of the model in that commit. Change the prompt without re-running the evals and the build fails.

## Decisions worth explaining

**Retrieval runs in the browser, not on the server.** The CV index is a static file and the embedding model (all-MiniLM-L6-v2, about 25 MB, quantised) runs on the visitor's machine through transformers.js. Matching therefore costs no API key, no request and no money, and the CV never travels anywhere. The download is why matching waits for a click.

**The match score is arithmetic, not an opinion.** A requirement either has supporting evidence or it does not, required counts double preferred, and the counts sit next to the percentage. A score nobody can recompute is worth nothing, and asking a model to grade the fit would produce a number that sounds authoritative and cannot be checked.

**The similarity threshold is 0.35, and it was measured.** Genuine matches score 0.42 and up; requirements the CV cannot support (Python, fluent German, Kubernetes) peak around 0.29. The gap is wide enough to separate them, and "no evidence found" is the whole point of the feature.

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
npm test              # unit tests and the eval gate, no API key needed
npm run typecheck
npm run schema:check  # blocks schema features Claude rejects
npm run eval          # scores the golden set against the real model, costs money
npm run demo:record   # re-records the demo fixtures, costs a few cents
```

Rebuilding the data:

```bash
npm run cv:import -- ~/path/to/CV.pdf   # CV pdf -> corpus/cv.md (needs poppler)
npm run cv:index                        # corpus/*.md -> public/cv-index.json
npm run sponsors:build                  # download today's UK register and compact it
```

## Data

The UK sponsor register is Crown copyright, published under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) at [gov.uk](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers). The copy here is compacted to one line per organisation, 126,662 of them, and the edition date is shown with every answer.

## What is not done yet

Being honest about the boundary, because the interesting part is what comes next.

- **Retrieval is similarity only, with no verification pass.** Embeddings match topic, not proof. n8n's "canvas-based tools, real-time apps, collaborative editors" pulls an architecture line at 48%, which is related but is not evidence. The UI says so in as many words, and the honest fix is a second grounded pass that judges whether a retrieved line actually supports the requirement, and is allowed to answer no.
- **The score measures coverage, not depth.** A requirement met once and a requirement met across ten years count the same, and recency counts for nothing.
- **Eligibility does not feed the score.** A role you cannot legally take is not a 59% match, it is a no. The verdict is shown separately rather than folded into a number that would hide it.
- **One CV.** The corpus is mine. There is no upload, no accounts and no storage, on purpose, but that also means the deployed site matches against one person.
- **The sponsor register is a snapshot.** It is rebuilt by hand with `npm run sponsors:build`, and gov.uk republishes most working days, so a very recent licence can be missing. The edition date is displayed for exactly that reason. It also covers the UK only and says nothing about anywhere else.
- **Evals cover 8 scalar fields.** The requirement lists and the eligibility reasoning are not scored yet; that needs a judge model and a rubric, and a bad rubric is worse than none.
- **No accessibility audit.** Streaming is announced through a polite live region, errors through an alert, and the scrollable evidence list is keyboard reachable and labelled. None of it has been tested with a real screen reader, and the ARIA contract being right on paper is necessary rather than sufficient.

## Licence

MIT
