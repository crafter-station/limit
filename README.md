# @crafter/limit

Rate limiting on storage you already run.

The first production adapter targets Neon HTTP: one atomic SQL statement per decision, no Redis, no pool, no interactive transaction, and no runtime cleanup timer.

## Install

```bash
bun add @crafter/limit @neondatabase/serverless
```

## Migrate

Apply this through your normal migration system:

```sql
CREATE TABLE IF NOT EXISTS public.crafter_rate_limits (
  key text PRIMARY KEY,
  count bigint NOT NULL,
  window_started_at bigint NOT NULL,
  expires_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS crafter_rate_limits_expires_at_idx
  ON public.crafter_rate_limits (expires_at);
```

The adapter also exposes the same statements as `storage.migration` for migration tooling and isolated tests. It never executes DDL during a request.

## Use Neon HTTP

```ts
import { neon } from "@neondatabase/serverless";
import { fixedWindow, Limiter } from "@crafter/limit";
import { neonHttp } from "@crafter/limit/neon";

const sql = neon(process.env.DATABASE_URL!);

const storage = neonHttp({
  client: sql,
  failureMode: "open",
});

const limiter = new Limiter({
  storage,
  limit: fixedWindow(10, "1m"),
  prefix: "feedback",
});

const result = await limiter.limit(userId);
```

`result` contains `success`, `remaining`, `reset`, and `limit`.

## Failure policy

`failureMode` defaults to `"closed"`, which propagates storage failures. Use `"open"` when product availability is more important than enforcing the limit during a database incident. `onError` receives failures in either mode for observability.

## Cleanup

Expired rows do not affect decisions. Delete them explicitly from a cron or maintenance job:

```ts
await storage.clearExpired();
```

The adapter never starts timers or background workers.

## Boundaries

Use Postgres-backed limits for authenticated actions, admin operations, and expensive mutations already coupled to the database. Keep high-volume anonymous traffic at the CDN or WAF layer so every asset request does not become a database write.

## Other storage

`@crafter/limit/memory` is available for tests and long-lived single-process applications. It refuses to start in detected serverless runtimes unless explicitly acknowledged.

## License

MIT
