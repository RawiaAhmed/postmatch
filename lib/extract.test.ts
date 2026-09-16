/**
 * Tests the extraction wiring with a mock model, so no API key or network is
 * needed. Whether Claude extracts the RIGHT answers is the job of the evals.
 */
import { APICallError, simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { extractPosting } from './extract';
import { postingSchema, type Posting } from './schema';
import { toTextResponseOrError } from './stream-response';

const SAMPLE_POSTING: Posting = {
  title: 'Senior Frontend Engineer',
  company: 'Acme',
  seniority: 'senior',
  minYears: 5,
  location: 'Berlin, Germany',
  remotePolicy: 'hybrid',
  allowedRegions: [],
  sponsorshipStated: 'yes',
  sponsorshipEvidence: 'We sponsor visas for international hires.',
  relocationStated: true,
  languageRequirement: null,
  eligibility: { reason: 'The posting offers visa sponsorship.', verdict: 'yes' },
  mustHave: [{ text: '5+ years with React and TypeScript', category: 'experience' }],
  niceToHave: [],
  stack: ['React', 'TypeScript'],
};

// A fake model that streams the given JSON in two pieces, the way Claude streams tokens.
function mockModelStreaming(json: string) {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: json.slice(0, 60) },
          { type: 'text-delta', id: 'text-1', delta: json.slice(60) },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 50, text: 50, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

// A fake model that fails the way Anthropic does when the API key is wrong.
function mockModelRejectingKey() {
  return new MockLanguageModelV3({
    doStream: async () => {
      throw new APICallError({
        message: 'API key is invalid.',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 401,
      });
    },
  });
}

describe('extractPosting', () => {
  it('streams partial objects first, then a complete schema-valid posting', async () => {
    const result = extractPosting('Senior Frontend Engineer at Acme...', mockModelStreaming(JSON.stringify(SAMPLE_POSTING)));

    const partials = [];
    for await (const partial of result.partialOutputStream) {
      partials.push(partial);
    }

    expect(partials.length).toBeGreaterThan(1);
    expect(postingSchema.parse(await result.output)).toEqual(SAMPLE_POSTING);
  });

  it('sends the posting inside <posting> tags, apart from the instructions', async () => {
    const model = mockModelStreaming(JSON.stringify(SAMPLE_POSTING));
    const result = extractPosting('We sponsor visas.', model);
    await result.output;

    const sentPrompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(sentPrompt).toContain('<posting>\\nWe sponsor visas.\\n</posting>');
  });
});

describe('toTextResponseOrError', () => {
  it('streams the posting JSON with status 200 when Claude responds', async () => {
    const json = JSON.stringify(SAMPLE_POSTING);
    const response = await toTextResponseOrError(extractPosting('A posting', mockModelStreaming(json)));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(json);
  });

  it('answers 401 with a clear message when Anthropic rejects the key', async () => {
    const response = await toTextResponseOrError(extractPosting('A posting', mockModelRejectingKey()));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Anthropic rejected this API key. Check it and try again.' });
  });
});
