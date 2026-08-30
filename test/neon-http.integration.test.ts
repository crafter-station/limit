import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { neon } from "@neondatabase/serverless";
import { neonHttp } from "../src/adapters/neon-http.js";
import { fixedWindow } from "../src/algorithms.js";
import { Limiter } from "../src/limiter.js";

const databaseUrl = process.env.NEON_DATABASE_URL;

if (databaseUrl) {
  const client = neon(databaseUrl);
  const table = `crafter_rate_limits_test_${Date.now()}`;
  const storage = neonHttp({ client, table });

  describe("neonHttp integration", () => {
    beforeAll(async () => {
      for (const statement of storage.migration) await client.query(statement);
    });

    afterAll(async () => {
      await client.query(`DROP TABLE IF EXISTS "${table}"`);
    });

    test("keeps a fixed window exact under concurrent HTTP queries", async () => {
      const limiter = new Limiter({
        storage,
        limit: fixedWindow(10, "1h"),
        prefix: `integration:${Date.now()}`,
      });
      const results = await Promise.all(
        Array.from({ length: 100 }, () => limiter.limit("same-key")),
      );

      expect(results.filter((result) => result.success)).toHaveLength(10);
      expect(results.filter((result) => !result.success)).toHaveLength(90);
    });
  });
}
