/**
 * Our API routes answer errors as JSON { "error": "..." }, and useObject hands
 * that raw response text over as the error message. This pulls out the sentence.
 */
export function readableError(error: Error): string {
  try {
    return JSON.parse(error.message).error ?? error.message;
  } catch {
    return error.message;
  }
}
