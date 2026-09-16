import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiKey } from './api-key';

function requestWithKey(key?: string): Request {
  const headers = key ? { 'x-anthropic-api-key': key } : undefined;
  return new Request('http://localhost/api/extract', { method: 'POST', headers });
}

describe('resolveApiKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the visitor's key when one is sent, even if .env.local has one", () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-from-env-local');

    expect(resolveApiKey(requestWithKey('sk-from-visitor'))).toBe('sk-from-visitor');
  });

  it('falls back to .env.local during local development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-from-env-local');

    expect(resolveApiKey(requestWithKey())).toBe('sk-from-env-local');
  });

  it('never falls back to the server key in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-that-must-not-be-used');

    expect(resolveApiKey(requestWithKey())).toBeUndefined();
  });
});
