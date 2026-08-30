import { describe, expect, test } from "bun:test";
import { neonHttp, neonHttpMigration } from "../src/adapters/neon-http.js";
import { fixedWindow, tokenBucket } from "../src/algorithms.js";
import { Limiter } from "../src/limiter.js";

describe("neonHttp", () => {
  test("maps one atomic query into the public result", async () => {
    const calls: Array<{ query: string; params: unknown[] | undefined }> = [];
    const client = {
      async query(query: string, params?: unknown[]) {
        calls.push({ query, params });
        return [{ count: "2", window_started_at: "1000" }];
      },
    };
    const limiter = new Limiter({
      storage: neonHttp({ client }),
      limit: fixedWindow(3, "1s"),
    });

    const result = await limiter.limit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.limit).toBe(3);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("ON CONFLICT");
    expect(calls[0]?.params?.[0]).toBe("rl:user-1");
  });

  test("fails open only when configured", async () => {
    const failure = new Error("offline");
    const client = {
      async query() {
        throw failure;
      },
    };
    const errors: unknown[] = [];
    const limiter = new Limiter({
      storage: neonHttp({
        client,
        failureMode: "open",
        onError: (error) => errors.push(error),
      }),
      limit: fixedWindow(3, "1s"),
    });

    expect((await limiter.limit("user-1")).success).toBe(true);
    expect(errors).toEqual([failure]);
  });

  test("rejects unsupported algorithms", async () => {
    const client = {
      async query() {
        return [];
      },
    };
    const limiter = new Limiter({
      storage: neonHttp({ client, failureMode: "open" }),
      limit: tokenBucket(3, "1s"),
    });

    expect(limiter.limit("user-1")).rejects.toThrow(
      "neonHttp() does not support token-bucket",
    );
  });

  test("validates migration table names", () => {
    expect(neonHttpMigration("rate_limits")).toHaveLength(2);
    expect(() => neonHttpMigration("rate_limits; DROP TABLE users")).toThrow(
      "invalid rate limit table",
    );
  });
});
