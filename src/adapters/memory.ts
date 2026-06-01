import { detectServerless } from "../limiter.js";
import type { CounterState, Storage } from "../types.js";

export interface MemoryOptions {
  /**
   * Opt in to memory storage in a serverless runtime. Almost always a bug:
   * each instance keeps its own counter, so the effective limit multiplies by
   * the number of running instances. Only set for intentional per-instance limits.
   */
  allowInServerless?: boolean;
}

export function memory(
  opts: MemoryOptions = {},
): Storage<Map<string, CounterState>> {
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

  const state = new Map<string, CounterState>();
  const locks = new Map<string, Promise<void>>();

  async function locked<T>(key: string, run: () => T | Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(
      () => current,
      () => current,
    );
    locks.set(key, tail);
    await previous.catch(() => undefined);

    try {
      return await run();
    } finally {
      release();
      if (locks.get(key) === tail) locks.delete(key);
    }
  }

  return {
    kind: "memory",
    distributed: false,
    raw: state,
    transition(key, step) {
      return locked(key, () => {
        const prev = state.get(key) ?? null;
        const { next, result } = step(prev, Date.now());
        state.set(key, next);
        return result;
      });
    },
    async reset(key) {
      await locked(key, () => {
        state.delete(key);
      });
    },
  };
}
