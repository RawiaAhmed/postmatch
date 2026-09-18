import { describe, expect, it } from 'vitest';
import { handleDemoRequest } from './handle-demo-request';

function demoRequest(body: unknown): Request {
  return new Request('http://localhost/api/demo', { method: 'POST', body: JSON.stringify(body) });
}

describe('handleDemoRequest', () => {
  it('rejects an id that is not one of the demo postings', async () => {
    const response = await handleDemoRequest(demoRequest({ id: 'not-a-demo' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Pick one of the demo postings.' });
  });
});
