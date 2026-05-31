/**
 * Persisted per-key state. Opaque to the adapter; meaningful only to the
 * algorithm's Step reducer. Kept as a small number map so every backend can
 * store it natively (Redis HSET fields, a DynamoDB item, a Postgres row).
 */
export interface CounterState {
  /** Algorithm-defined counter: tokens left, request count, etc. */
  count: number;
  /** Last-update epoch ms (for refill / window math). */
  ts: number;
  /** Reserved now for sliding-window 2-counter, so adding it later never breaks the interface. */
  prev?: number;
}

/** The externally-visible result of a single limit() call. */
export interface RateLimitResult {
  /** Was the request allowed? */
  success: boolean;
  /** Tokens left after this call (>= 0). */
  remaining: number;
  /** Epoch ms when capacity is next available / the window resets. */
  reset: number;
  /** Configured ceiling (burst size). */
  limit: number;
}

/**
 * A pure transition supplied BY CORE. Given the loaded state (or null if the key
 * is new) plus the injected current time, returns the next state, the visible
 * result, and a TTL hint for idle-key eviction. No I/O, no clock reads inside.
 * This IS the entire algorithm.
 */
export type Step = (
  prev: CounterState | null,
  now: number,
) => { next: CounterState; result: RateLimitResult; ttlMs: number };

/**
 * THE storage primitive. Adapters implement exactly this surface.
 *
 * `transition` contract: load the state for `key`, apply `step(prev, now)`
 * EXACTLY ONCE, persist `next`, and return `result` — such that no concurrent
 * transition on the same key can interleave between load and persist.
 * Atomicity is the adapter's sole responsibility; the math is core's.
 */
export interface Storage<TRaw = unknown> {
  /** Stable id used by the serverless loud-failure check (e.g. "memory", "redis"). */
  readonly kind: string;
  /** True only for storage shared across all server instances. Gates the serverless guard. */
  readonly distributed: boolean;
  /** Atomic read-modify-write for one key. The only race-sensitive operation. */
  transition(key: string, step: Step): Promise<RateLimitResult>;
  /** Clear one key. */
  reset(key: string): Promise<void>;
  /** Escape hatch to the underlying native client. */
  readonly raw: TRaw;
}

/** An algorithm produces the per-call pure Step. Time is injected for testability. */
export interface Algorithm {
  /** Configured ceiling, surfaced on the result. */
  readonly limit: number;
  /** Build the pure transition for one request. */
  step(now: number): Step;
}

/** A key resolver: turns a request (or a raw id) into the limiter key. */
export type KeyResolver<TReq = unknown> = (req: TReq) => string;

export interface LimiterOptions<TReq = unknown> {
  storage: Storage;
  limit: Algorithm;
  /** Key namespace in storage. Default "rl". */
  prefix?: string;
  /** Identity helper (by.ip, by.user, by.agent, ...). Optional when calling limit(id) directly. */
  key?: KeyResolver<TReq>;
  /** Lifecycle hook fired after each decision. */
  onResult?: (key: string, result: RateLimitResult) => void;
  /**
   * Acknowledge a non-distributed storage in a serverless runtime, bypassing
   * the loud-failure guard. Almost always a bug — only set when you really want
   * per-instance limiting.
   */
  acknowledgedNonDistributed?: boolean;
}

export type Duration = `${number}${"ms" | "s" | "m" | "h"}`;
