/**
 * Decides which Anthropic API key a request should use.
 *
 * 1. A key sent by the visitor's browser (header) always wins. This is how the
 *    public site works: every visitor brings their own key.
 * 2. In local development only, fall back to ANTHROPIC_API_KEY from .env.local,
 *    so you do not have to paste your key into the page while building.
 *
 * The fallback is deliberately never used in production: if ANTHROPIC_API_KEY
 * were set on the deployed site, every visitor would be spending your money.
 */
export function resolveApiKey(request: Request): string | undefined {
  const visitorKey = request.headers.get('x-anthropic-api-key');
  if (visitorKey) {
    return visitorKey;
  }

  if (process.env.NODE_ENV === 'development') {
    return process.env.ANTHROPIC_API_KEY;
  }

  return undefined;
}
