import type { Storage } from "../src/types.js";

/**
 * Shared conformance suite. EVERY adapter must pass this. The race test is the
 * whole point of the library: under concurrency, a correct adapter never lets
 * the count exceed the configured limit.
 *
 * Usage (per adapter test file):
 *   import { runConformance } from "./conformance.js";
 *   runConformance("memory", () => memory());
 *   runConformance("redis", () => redis({ url: process.env.REDIS_URL! }));
 *
 * TODO(RL-1): implement using bun:test (describe/test/expect). Cases:
 *  1. allows up to N, denies N+1 (token bucket capacity).
 *  2. refills over time: after window, tokens are back.
 *  3. RACE: fire 100 concurrent limit() on ONE key with capacity 10 ->
 *     exactly 10 succeed, 90 fail. Run many iterations. Zero tolerance.
 *  4. independent keys don't interfere.
 *  5. reset() clears a key.
 *  6. result shape: { success, remaining, reset, limit } always present.
 */
export function runConformance(
  _label: string,
  _makeStorage: () => Storage,
): void {
  throw new Error("not implemented: conformance suite (RL-1)");
}
