/**
 * POST /api/demo: replays a recorded extraction, no API key needed.
 * The request handling lives in lib/handle-demo-request.ts.
 */
import { handleDemoRequest } from '@/lib/handle-demo-request';

export const POST = handleDemoRequest;
