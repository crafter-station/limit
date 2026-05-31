import type { Storage } from "../types.js";

export interface RedisOptions {
  /** Redis connection URL. */
  url?: string;
  /** Or pass an existing ioredis-compatible client. */
  client?: unknown;
}

/**
 * Redis-backed storage. Multiserver-correct via a single atomic EVAL Lua script
 * (1 round-trip, no CAS loop). Lua is the atomic unit — Redis runs scripts
 * single-threaded.
 *
 * TODO(RL-2): implement against ioredis (peer dep, optional). Must:
 *  - lazily connect from url or accept a provided client
 *  - ship a token-bucket Lua script (HMGET tokens+ts, lazy refill, decrement,
 *    HMSET, PEXPIRE) loaded via EVALSHA with EVAL fallback
 *  - transition(): run the script in one round-trip, decode [allowed, tokens, ts]
 *    into a RateLimitResult. Note: the Lua mirrors the SAME math as the core
 *    tokenBucket Step (keep them in sync; the conformance suite enforces parity).
 *  - kind="redis", distributed=true, raw=the ioredis client (typed via generic)
 *  - reset(): DEL the key
 */
export function redis(_opts: RedisOptions): Storage {
  throw new Error("not implemented: redis() adapter (RL-2)");
}
