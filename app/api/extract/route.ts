/**
 * POST /api/extract: streams a job posting's extracted facts.
 * The request handling lives in lib/handle-extract-request.ts.
 */
import { handleExtractRequest } from '@/lib/handle-extract-request';

// The longest a single extraction may run, in seconds. Next.js only reads this from the route file.
export const maxDuration = 60;

export const POST = handleExtractRequest;
