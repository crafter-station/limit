import { describe, expect, test } from "bun:test";
import { memory } from "../src/adapters/memory.js";
import { fixedWindow, tokenBucket } from "../src/algorithms.js";
import { casLoop, RateLimitConflictError } from "../src/cas-loop.js";
import { Limiter } from "../src/limiter.js";
import type { CounterState } from "../src/types.js";

describe("tokenBucket", () => {
  test("uses injected time for refill math", () => {
    const step = tokenBucket(2, "100ms").step(1_000);
    const first = step(null, 1_000);
    const second = step(first.next, 1_000);
    const denied = step(second.next, 1_000);
    const refilled = step(second.next, 1_050);

    expect(first.result).toEqual({
      success: true,
      remaining: 1,
      reset: 1_050,
      limit: 2,
    });
    expect(second.result.success).toBe(true);
    expect(second.result.remaining).toBe(0);
    expect(denied.result.success).toBe(false);
    expect(refilled.result.success).toBe(true);
    expect(first.ttlMs).toBe(200);
  });
});

describe("fixedWindow", () => {
  test("resets after the configured window", () => {
    const step = fixedWindow(2, "100ms").step(1_000);
    const first = step(null, 1_000);
    const second = step(first.next, 1_000);
    const denied = step(second.next, 1_000);
    const reset = step(denied.next, 1_100);

    expect(first.result.success).toBe(true);
    expect(second.result.success).toBe(true);
    expect(denied.result.success).toBe(false);
    expect(reset.result).toEqual({
      success: true,
      remaining: 1,
      reset: 1_200,
      limit: 2,
    });
    expect(step.recipe).toEqual({
      kind: "fixed-window",
      limit: 2,
      now: 1_000,
      windowMs: 100,
    });
  });
});

describe("Limiter", () => {
  test("namespaces resolved keys and fires onResult", async () => {
    const storage = memory();
    const seen: Array<[string, boolean]> = [];
    const limiter = new Limiter<{ user: string }>({
      storage,
      limit: tokenBucket(1, "1h"),
      prefix: "api",
      key: (req) => req.user,
      onResult: (key, result) => {
        seen.push([key, result.success]);
      },
    });

    await limiter.limit({ user: "u1" });
    await limiter.limit({ user: "u1" });

    expect(storage.raw.has("api:u1")).toBe(true);
    expect(storage.raw.has("rl:u1")).toBe(false);
    expect(seen).toEqual([
      ["api:u1", true],
      ["api:u1", false],
    ]);
  });
});

describe("casLoop", () => {
  test("retries after a failed commit", async () => {
    let state: CounterState | null = null;
    let version = 0;
    let shouldConflict = true;
    const result = await casLoop(
      tokenBucket(1, "1h").step(0),
      {
        load: async () => (state ? { state, version } : null),
        commit: async (next, expectedVersion) => {
          if (shouldConflict) {
            shouldConflict = false;
            return false;
          }
          if (expectedVersion !== (state ? version : null)) return false;
          state = next;
          version += 1;
          return true;
        },
      },
      2,
    );

    expect(result.success).toBe(true);
    expect(state?.count).toBe(0);
    expect(version).toBe(1);
  });

  test("throws when retries are exhausted", async () => {
    let caught: unknown;

    try {
      await casLoop(
        tokenBucket(1, "1h").step(0),
        {
          load: async () => null,
          commit: async () => false,
        },
        2,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RateLimitConflictError);
  });
});
