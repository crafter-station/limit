import { describe, expect, test } from "bun:test";
import { tokenBucket } from "../src/algorithms.js";
import { Limiter } from "../src/limiter.js";
import type { RateLimitResult, Storage } from "../src/types.js";

export function runConformance(
  label: string,
  makeStorage: () => Storage,
): void {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const expectShape = (result: RateLimitResult, limit: number) => {
    expect("success" in result).toBe(true);
    expect("remaining" in result).toBe(true);
    expect("reset" in result).toBe(true);
    expect("limit" in result).toBe(true);
    expect(typeof result.success).toBe("boolean");
    expect(Number.isFinite(result.remaining)).toBe(true);
    expect(Number.isFinite(result.reset)).toBe(true);
    expect(result.limit).toBe(limit);
  };

  describe(`${label} conformance`, () => {
    test("allows up to capacity and denies the next request", async () => {
      const limiter = new Limiter({
        storage: makeStorage(),
        limit: tokenBucket(3, "1h"),
      });

      const results = [
        await limiter.limit("capacity"),
        await limiter.limit("capacity"),
        await limiter.limit("capacity"),
        await limiter.limit("capacity"),
      ];

      expect(results.map((result) => result.success)).toEqual([
        true,
        true,
        true,
        false,
      ]);
      expect(results.at(-1)?.remaining).toBe(0);
    });

    test("refills over time", async () => {
      const limiter = new Limiter({
        storage: makeStorage(),
        limit: tokenBucket(1, "20ms"),
      });

      expect((await limiter.limit("refill")).success).toBe(true);
      expect((await limiter.limit("refill")).success).toBe(false);
      await sleep(35);
      expect((await limiter.limit("refill")).success).toBe(true);
    });

    test("serializes concurrent requests on one key", async () => {
      for (let i = 0; i < 50; i += 1) {
        const limiter = new Limiter({
          storage: makeStorage(),
          limit: tokenBucket(10, "1h"),
        });

        const results = await Promise.all(
          Array.from({ length: 100 }, () => limiter.limit(`race-${i}`)),
        );
        const successes = results.filter((result) => result.success).length;

        expect(successes).toBe(10);
        expect(results.length - successes).toBe(90);
      }
    }, 30_000);

    test("keeps independent keys isolated", async () => {
      const limiter = new Limiter({
        storage: makeStorage(),
        limit: tokenBucket(2, "1h"),
      });

      expect((await limiter.limit("a")).success).toBe(true);
      expect((await limiter.limit("a")).success).toBe(true);
      expect((await limiter.limit("a")).success).toBe(false);
      expect((await limiter.limit("b")).success).toBe(true);
      expect((await limiter.limit("b")).success).toBe(true);
      expect((await limiter.limit("b")).success).toBe(false);
    });

    test("reset clears a key", async () => {
      const storage = makeStorage();
      const limiter = new Limiter({
        storage,
        limit: tokenBucket(1, "1h"),
      });

      expect((await limiter.limit("reset")).success).toBe(true);
      expect((await limiter.limit("reset")).success).toBe(false);
      await storage.reset("rl:reset");
      expect((await limiter.limit("reset")).success).toBe(true);
    });

    test("returns a complete result shape", async () => {
      const limiter = new Limiter({
        storage: makeStorage(),
        limit: tokenBucket(1, "1h"),
      });

      expectShape(await limiter.limit("shape"), 1);
      expectShape(await limiter.limit("shape"), 1);
    });
  });
}
