import type { CounterState, RateLimitResult, Step } from "./types.js";

export async function casLoop(
  step: Step,
  ops: {
    load(): Promise<{ state: CounterState; version: number } | null>;
    commit(
      next: CounterState,
      expectedVersion: number | null,
    ): Promise<boolean>;
  },
  maxRetries = 5,
): Promise<RateLimitResult> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const loaded = await ops.load();
    const prev = loaded?.state ?? null;
    const version = loaded?.version ?? null;
    const { next, result } = step(prev, Date.now());
    const committed = await ops.commit(next, version);
    if (committed) return result;
  }

  throw new RateLimitConflictError("rate limit state changed too often");
}

export class RateLimitConflictError extends Error {
  override name = "RateLimitConflictError";
}
