import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { RateLimitResult, Step, Storage } from "../types.js";

export type NeonHttpClient = Pick<NeonQueryFunction<false, false>, "query">;

export interface NeonHttpOptions<
  TClient extends NeonHttpClient = NeonHttpClient,
> {
  client: TClient;
  table?: string;
  failureMode?: "open" | "closed";
  onError?: (error: unknown) => void;
}

export interface NeonHttpStorage<
  TClient extends NeonHttpClient = NeonHttpClient,
> extends Storage<TClient> {
  clearExpired(now?: number): Promise<number>;
  readonly migration: readonly [string, string];
}

interface NeonHttpRow {
  count: number | string;
  window_started_at: number | string;
}

function quoteTable(table: string): string {
  const parts = table.split(".");
  if (
    parts.length < 1 ||
    parts.length > 2 ||
    parts.some((part) => !/^[a-z_][a-z0-9_]*$/i.test(part))
  ) {
    throw new Error(`invalid rate limit table: ${table}`);
  }
  return parts.map((part) => `"${part}"`).join(".");
}

export function neonHttpMigration(
  table = "public.crafter_rate_limits",
): readonly [string, string] {
  const target = quoteTable(table);
  const indexName = `${table.split(".").at(-1)}_expires_at_idx`;
  const index = quoteTable(indexName);
  return [
    `CREATE TABLE IF NOT EXISTS ${target} ("key" text PRIMARY KEY, "count" bigint NOT NULL, "window_started_at" bigint NOT NULL, "expires_at" bigint NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS ${index} ON ${target} ("expires_at")`,
  ];
}

export function neonHttp<TClient extends NeonHttpClient>(
  options: NeonHttpOptions<TClient>,
): NeonHttpStorage<TClient> {
  const table = quoteTable(options.table ?? "public.crafter_rate_limits");
  const migration = neonHttpMigration(
    options.table ?? "public.crafter_rate_limits",
  );
  const failureMode = options.failureMode ?? "closed";

  return {
    kind: "neon-http",
    distributed: true,
    raw: options.client,
    migration,
    async transition(_key: string, step: Step): Promise<RateLimitResult> {
      if (step.recipe.kind !== "fixed-window") {
        throw new Error(
          `neonHttp() does not support ${step.recipe.kind}; use fixedWindow()`,
        );
      }

      const { limit, now, windowMs } = step.recipe;
      try {
        const rows = (await options.client.query(
          `INSERT INTO ${table} AS rate_limit ("key", "count", "window_started_at", "expires_at") VALUES ($1, 1, $2::bigint, $2::bigint + $3::bigint * 2) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN rate_limit."window_started_at" + $3::bigint <= $2::bigint THEN 1 ELSE LEAST(rate_limit."count" + 1, $4::bigint) END, "window_started_at" = CASE WHEN rate_limit."window_started_at" + $3::bigint <= $2::bigint THEN $2::bigint ELSE rate_limit."window_started_at" END, "expires_at" = CASE WHEN rate_limit."window_started_at" + $3::bigint <= $2::bigint THEN $2::bigint + $3::bigint * 2 ELSE rate_limit."window_started_at" + $3::bigint * 2 END RETURNING "count", "window_started_at"`,
          [_key, now, windowMs, limit + 1],
        )) as unknown as NeonHttpRow[];
        const row = rows[0];
        if (!row) throw new Error("neonHttp() returned no rate limit row");
        const count = Number(row.count);
        const windowStartedAt = Number(row.window_started_at);
        if (
          !Number.isSafeInteger(count) ||
          !Number.isSafeInteger(windowStartedAt)
        ) {
          throw new Error("neonHttp() returned invalid rate limit state");
        }
        return {
          success: count <= limit,
          remaining: Math.max(0, limit - count),
          reset: windowStartedAt + windowMs,
          limit,
        };
      } catch (error) {
        options.onError?.(error);
        if (failureMode === "closed") throw error;
        return {
          success: true,
          remaining: Math.max(0, limit - 1),
          reset: now + windowMs,
          limit,
        };
      }
    },
    async reset(key) {
      await options.client.query(`DELETE FROM ${table} WHERE "key" = $1`, [
        key,
      ]);
    },
    async clearExpired(now = Date.now()) {
      const rows = (await options.client.query(
        `WITH deleted AS (DELETE FROM ${table} WHERE "expires_at" <= $1 RETURNING 1) SELECT count(*)::int AS "count" FROM deleted`,
        [now],
      )) as unknown as Array<{ count: number | string }>;
      return Number(rows[0]?.count ?? 0);
    },
  };
}
