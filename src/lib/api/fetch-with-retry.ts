/**
 * fetch wrapper with 1 retry + exponential backoff (Quality Fix 11-2).
 * - Retries on network errors and 5xx responses
 * - Does NOT retry on 4xx (client errors)
 * - Creates a fresh AbortSignal per attempt (avoids signal already-aborted issue)
 */
export async function fetchWithRetry(
  input: string | URL,
  init?: Omit<RequestInit, "signal">,
  options?: { maxRetries?: number; baseDelayMs?: number; timeoutMs?: number }
): Promise<Response> {
  const { maxRetries = 1, baseDelayMs = 500, timeoutMs } = options ?? {};

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms → 1000ms → 2000ms ...
      await new Promise<void>((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1))
      );
    }

    const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

    try {
      const res = await fetch(input, { ...init, signal });

      // 4xx = client error — don't retry
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }

      // 5xx on last attempt — return as-is so caller can handle
      if (attempt === maxRetries) return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Network error or timeout — will retry
    }
  }

  // unreachable, but satisfies TypeScript
  throw new Error("fetchWithRetry: exhausted retries");
}
