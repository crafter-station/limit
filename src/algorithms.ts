import type { Algorithm, Duration } from "./types.js";

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
};

export function parseDuration(d: Duration): number {
  const m = /^(\d+)(ms|s|m|h)$/.exec(d);
  if (!m) throw new Error(`invalid duration: ${d}`);
  const value = Number(m[1]);
  const unit = m[2] as keyof typeof UNIT_MS;
  const factor = UNIT_MS[unit];
  if (factor === undefined) throw new Error(`invalid duration unit: ${d}`);
  return value * factor;
}

/**
 * Token bucket: `tokens` capacity, fully refilled every `window`. Continuous
 * lazy refill (fractional tokens accrue per ms), no background job.
 *
 * TODO(RL-1): implement step(now) returning the pure transition. The reducer:
 *  - reconstruct current token level from prev (full bucket if prev is null)
 *  - refill = min(capacity, prev.count + elapsed * (tokens / windowMs))
 *  - allowed = refilled >= 1; nextCount = allowed ? refilled - 1 : refilled
 *  - reset = now + ceil((capacity - nextCount) / ratePerMs)
 *  - ttlMs = windowMs * 2
 */
export function tokenBucket(tokens: number, window: Duration): Algorithm {
  const windowMs = parseDuration(window);
  void windowMs;
  return {
    limit: tokens,
    step(_now: number) {
      throw new Error("not implemented: tokenBucket.step (RL-1)");
    },
  };
}
