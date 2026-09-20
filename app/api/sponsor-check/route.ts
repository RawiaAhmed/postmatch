/**
 * POST /api/sponsor-check: is this company licensed to sponsor a UK visa?
 * The request handling lives in lib/handle-sponsor-check-request.ts.
 */
import { handleSponsorCheckRequest } from '@/lib/handle-sponsor-check-request';

export const POST = handleSponsorCheckRequest;
