import type { Algorithm, CounterState, Duration } from "./types.js";

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

export function tokenBucket(tokens: number, window: Duration): Algorithm {
  const windowMs = parseDuration(window);
  if (!Number.isFinite(tokens) || tokens <= 0) {
    throw new Error(`invalid token capacity: ${tokens}`);
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(`invalid duration: ${window}`);
  }
  const ratePerMs = tokens / windowMs;

  const reduce = (prev: CounterState | null, now: number) => {
    const current = prev
      ? Math.min(tokens, prev.count + Math.max(0, now - prev.ts) * ratePerMs)
      : tokens;
    const success = current >= 1;
    const nextCount = success ? current - 1 : current;
    const reset = now + Math.ceil((tokens - nextCount) / ratePerMs);

    return {
      next: { count: nextCount, ts: now },
      result: {
        success,
        remaining: Math.max(0, Math.floor(nextCount)),
        reset,
        limit: tokens,
      },
      ttlMs: windowMs * 2,
    };
  };

  return {
    limit: tokens,
    step(now: number) {
      return (prev, transitionNow = now) => reduce(prev, transitionNow);
    },
  };
}
