import { detectServerless } from "../limiter.js";
import type { Storage } from "../types.js";

export interface MemoryOptions {
  /**
   * Opt in to memory storage in a serverless runtime. Almost always a bug:
   * each instance keeps its own counter, so the effective limit multiplies by
   * the number of running instances. Only set for intentional per-instance limits.
   */
  allowInServerless?: boolean;
}

/**
 * In-process storage. Multiserver-correct ONLY within a single long-running
 * process (per-key async mutex closes the await-interleave window). Throws in a
 * detected serverless runtime unless explicitly allowed.
 *
 * TODO(RL-1): implement the Map<string, CounterState> store + a per-key async
 * mutex so concurrent transition() calls on the same key serialize. Set
 * kind="memory", distributed=false, raw=the Map.
 *
 * TODO(RL-4): wire the loud-failure guard below into the Limiter constructor too.
 */
export function memory(
  opts: MemoryOptions = {},
): Storage<Map<string, unknown>> {
  const serverless = detectServerless();
  if (serverless && !opts.allowInServerless) {
    throw new Error(
      [
        "memory() storage in a SERVERLESS environment is almost always a bug.",
        `Detected: ${serverless}. Each instance keeps its own counter, so your`,
        "effective limit multiplies by the number of running instances.",
        "",
        "Fix: use a distributed adapter:",
        '  import { redis } from "@crafter/limit/redis";',
        "  storage: redis({ url: process.env.REDIS_URL! })",
        "",
        "If you really want per-instance limiting: memory({ allowInServerless: true })",
      ].join("\n"),
    );
  }
  throw new Error("not implemented: memory() store (RL-1)");
}
