---
type: prd
created: 2026-05-31
updated: 2026-08-30
status: implementing
org: crafter-station
project: limit
---

# PRD: @crafter/limit v0.1

## Problem

Petdex used Upstash rate limiting as a hard dependency. When the Upstash database was rate-limited and its request quota was exhausted, unrelated application actions returned 500. Petdex already has Neon Postgres, but existing PostgreSQL rate-limit adapters are not designed for Neon HTTP one-shot queries.

## Goal

Ship a small open-source SDK that performs exact fixed-window rate limiting through one atomic Neon HTTP query and can be dogfooded by Petdex without adding another datastore.

## Success criteria

1. One call to `Limiter.limit()` causes exactly one Neon HTTP query.
2. One hundred concurrent calls to a limit of ten yield exactly ten successes.
3. The adapter uses no pool, interactive transaction, runtime DDL, or timer.
4. Callers explicitly choose fail-open or fail-closed behavior.
5. The package builds as ESM with strict TypeScript and installs from its packed artifact.
6. Petdex admin QR rotation no longer depends on Upstash.
7. Public anonymous traffic remains outside the Postgres adapter.

## Public API

```ts
import { neon } from "@neondatabase/serverless";
import { fixedWindow, Limiter } from "@crafter/limit";
import { neonHttp } from "@crafter/limit/neon";

const limiter = new Limiter({
  storage: neonHttp({
    client: neon(process.env.DATABASE_URL!),
    failureMode: "open",
  }),
  limit: fixedWindow(5, "1h"),
  prefix: "wechat-qr-upload",
});
```

## Release scope

- `Limiter`
- `fixedWindow()`
- `memory()`
- `neonHttp()`
- Migration statement export
- Explicit cleanup method
- Explicit failure policy and error hook
- Unit, build, packed-consumer, and real-Neon concurrency verification

## Non-goals

- Hosted service or dashboard
- Public edge traffic limiting
- Sliding window
- Neon token bucket
- Redis
- Agent identity resolvers
- Framework middleware

## Delivery

See `slices.md` for independently deployable slices and `NORTH.md` for decision boundaries.
