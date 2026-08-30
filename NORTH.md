# NORTH

## Product promise

Add correct distributed rate limiting without adopting another datastore.

## Selected direction

- BYO storage remains the product architecture.
- Neon HTTP is the first production adapter and dogfood path.
- A native adapter must make one atomic storage operation per decision.
- The public API keeps the limiter, algorithm, and storage decisions separate.
- Agent identity becomes a later differentiator after the storage foundation is proven.

## Current release

`v0.1` ships `Limiter`, `fixedWindow`, `memory()`, and `neonHttp()`.

## Non-goals

- Hosted infrastructure or dashboard.
- Public edge traffic protection.
- Runtime schema creation.
- Background cleanup workers.
- Redis, sliding window, token bucket on Neon, or framework middleware in `v0.1`.

## Evidence

- Petdex exhausted an Upstash request quota and rate limiting became a production 500 dependency.
- Petdex already runs Neon Postgres for durable application state.
- Existing PostgreSQL rate-limit adapters depend on pools, interactive transactions, or runtime timers.
- Neon HTTP is designed for one-shot non-interactive queries.

## Decision rules

- Prefer one atomic native operation over generic read-then-write abstractions.
- Never put high-volume anonymous asset traffic on Postgres.
- Fail-open versus fail-closed must be explicit at each adapter instance.
- Dogfood every production adapter before adding another storage backend.
- New algorithms must pass the same concurrent conformance test across adapters.
