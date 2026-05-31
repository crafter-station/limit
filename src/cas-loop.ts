import type { CounterState, RateLimitResult, Step } from "./types.js";

/**
 * The ONLY race-handling logic in the library, written once and shared by every
 * adapter that cannot run a server-side script (DynamoDB, Postgres, ...).
 *
 * The adapter provides two native operations:
 *  - load(): read current state + an opaque version token.
 *  - commit(next, expectedVersion): conditional write that succeeds only if the
 *    version is unchanged; returns false on a lost race (so we retry).
 *
 * Redis does NOT use this — its Lua script is the atomic unit (1 round-trip).
 *
 * TODO(RL-1): implement the bounded retry loop. Must:
 *  - read via load()
 *  - run step(prev, Date.now())
 *  - commit(next, version); on false, re-read and retry up to maxRetries
 *  - throw RateLimitConflictError when retries are exhausted
 */
export async function casLoop(
  _step: Step,
  _ops: {
    load(): Promise<{ state: CounterState; version: number } | null>;
    commit(
      next: CounterState,
      expectedVersion: number | null,
    ): Promise<boolean>;
  },
  _maxRetries = 5,
): Promise<RateLimitResult> {
  throw new Error("not implemented: casLoop (RL-1)");
}

export class RateLimitConflictError extends Error {
  override name = "RateLimitConflictError";
}
