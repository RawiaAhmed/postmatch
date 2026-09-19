# Fleet Assistant

An AI assistant for a fleet of connected retail display and kiosk devices. Ask it about device health in natural language and it answers from live fleet context, streaming the response as it is generated.

Built with **Angular 22 (Signals)** and a **NestJS BFF**, backed by the Google Gemini API.

> **Screenshot / GIF goes here.** Record a short clip showing a streamed answer and a cancellation.

---

## Why this exists

Calling an LLM API is easy. Making it usable is not.

Model responses arrive slowly, token by token, and can fail halfway. Users cancel. Providers rate-limit. Most demos ignore all of this and show a spinner followed by a wall of text. This project is about the parts that actually decide whether an AI feature feels reliable: streaming, cancellation, error classification, and honest loading states.

---

## Architecture

```
┌──────────────────┐   SSE    ┌──────────────────┐   HTTPS   ┌─────────────┐
│   Angular 22     │ ───────▶ │   NestJS BFF     │ ────────▶ │   Gemini    │
│                  │          │                  │           │     API     │
│ Signals state    │          │ Holds API key    │           └─────────────┘
│ RxJS-free stream │          │ Fleet context    │
│ Cancellation     │          │ Error mapping    │
└──────────────────┘          └──────────────────┘
```

### Why there is a BFF at all

The API key never reaches the browser. Anything shipped to a client is public, so a key in Angular is a key on the internet.

The BFF earns its place beyond key custody:

- **Context assembly.** Fleet data is selected, bounded and formatted server-side. The client never decides what the model sees.
- **Error translation.** Provider errors are mapped to a small set of kinds the UI knows how to render. Raw upstream messages are logged, never forwarded.
- **A cancellation boundary.** Client disconnect aborts the upstream call (see below).
- **A swap point.** Changing model or provider touches one file and no client code.

---

## Key decisions and trade-offs

### SSE rather than WebSockets
Token streaming is unidirectional: server to client. SSE gives that over plain HTTP with automatic reconnection and no extra protocol. WebSockets would add a stateful connection, its own scaling story, and bidirectional capability nothing here needs.

**Trade-off:** `EventSource` only issues GET requests, so the question travels as a query parameter. That is fine for short questions and breaks at URL-length limits. The upgrade path is POST plus a streaming `fetch` reader, at the cost of losing built-in reconnection.

### Signals, not RxJS, for stream state
The stream produces one accumulating string and one state value. That is state, not a pipeline. Signals express it directly and the template stays synchronous with no subscription management.

**Where RxJS would win:** debouncing input, cancelling in-flight requests on rapid resubmission, or merging multiple concurrent streams. If this grew to multi-turn conversations with racing requests, the service would move to RxJS.

### Cancellation is end to end, not cosmetic
Pressing Stop closes the `EventSource`. That drops the HTTP connection, which fires `close` on the Express request, which aborts an `AbortController` that was passed into the Gemini SDK call.

This matters: cancelling only in the UI stops the tokens rendering but leaves the provider generating and billing. Cancellation that does not reach the provider is not cancellation.

### `connecting` and `streaming` are separate states
Between them sits the model's time-to-first-token, which is the longest silence the user experiences. Collapsing both into a generic "loading" is a large part of why AI interfaces feel broken. The UI shows "Thinking…" until the first token, then a live caret while text arrives.

### Errors are classified, not passed through
The BFF maps provider failures onto `rate_limited`, `upstream_unavailable`, `timeout`, `bad_request`, `unknown`, each carrying a `retryable` flag. The UI renders a specific message and only offers retry when retrying could plausibly help.

A partial answer followed by a failure is also distinguished from a failure with no output, because "this answer is incomplete" and "this did not work" call for different user responses.

### Fleet context is bounded before it reaches the model
`FleetService.buildContext()` sends a summary plus only the devices needing attention, not the whole inventory. Fleet size is unbounded; a context window is not. Context is also terse lines rather than raw JSON, which costs fewer tokens with no loss of grounding.

### Accessibility is part of streaming, not an afterthought
The answer region is `aria-live="polite"` with `aria-busy` tracking generation, so assistive technology announces text as it arrives and is not told the answer is complete while tokens are still streaming. Animations are disabled under `prefers-reduced-motion`.

---

## What I would change at production scale

Deliberately not built here, but this is where it would go next:

- **Token and cost controls.** Per-user rate limiting, a monthly budget ceiling, and logging token counts per request. Cost is a product constraint, not an infrastructure detail.
- **Observability.** Structured logs with a request id spanning client to provider; metrics for time-to-first-token, stream duration, cancellation rate and error rate by kind. Time-to-first-token is the number that predicts user trust.
- **Evaluation.** A fixture set of fleet states and expected answers, run on every change to prompt or context format. Prompts are code and regress silently without tests.
- **Caching.** Identical questions against unchanged fleet state can be served from cache. Needs invalidation keyed on fleet state.
- **Retrieval instead of full context.** Once the fleet outgrows a context window, move to embedding device records and retrieving only relevant ones.
- **Multi-tenancy.** Fleet data is customer data. Real deployment needs authentication, per-tenant isolation, and assurance that one tenant's context can never leak into another's prompt.
- **Conversation history.** Currently every question is independent. Multi-turn needs history management and a truncation strategy.

---

## Deliberately out of scope

RAG and vector search, authentication, multi-turn conversation, agentic tool calling, persistence. Each is a reasonable next step and none is needed to demonstrate that the streaming path is correct. Scope was kept narrow so the parts that exist are finished rather than sketched.

---

## Running it

**Prerequisites:** Node 22.22.3+ or 24.15+ (Angular 22 requirement), and a Gemini API key.

```bash
# 1. BFF
cd api
cp .env.example .env        # add your GEMINI_API_KEY
npm install
npm run start:dev           # http://localhost:3000

# 2. Angular app (separate terminal, from repo root)
npm install
npm start                   # http://localhost:4200
```

The dev server proxies `/api` to the BFF, so the browser only ever talks to its own origin. `.env` is gitignored and must never be committed.

## Project structure

```
├── src/app/chat/
│   ├── chat.ts                    # Signal-based stream state, cancellation
│   └── chat-panel/                # UI: states, errors, accessibility
└── api/src/
    ├── chat/
    │   ├── chat.controller.ts     # SSE endpoint, abort propagation
    │   └── gemini.service.ts      # Provider call, error classification
    └── fleet/fleet.service.ts     # Fleet data, context assembly
```

## Tech

Angular 22 · Signals · TypeScript · SCSS · NestJS 11 · Server-Sent Events · Google Gemini API
