---
type: prd
created: 2026-05-31
status: ready
org: crafter-station
project: ratelimit-sdk
source: 04_Projects/_shaping/ratelimit-sdk/shaping.md
---

# PRD — @crafter/limit (agent-first rate limiting, BYO storage)

## Problem

Rate limiting SDKs force a choice between vendor lock-in (Upstash ties you to
their Redis HTTP client) or hosted infra you depend on (Unkey). None model the
caller being an *agent* rather than a human IP. As agent traffic grows (MCP
fan-out, autonomous workers, Claude sessions hammering endpoints), per-IP
keying is the wrong unit.

## Goal

Ship the simplest rate-limiting SDK that is (a) storage-agnostic via a clean
adapter interface, (b) multiserver-correct by construction, and (c) agent-first
— `by.agent` keying is a first-class citizen. Developer adds correct,
distributed rate limiting in one decision.

## Non-goals (v0.1)

- Hosted backend / dashboard (that's Unkey; we're an SDK).
- Framework middleware (deferred to v0.2).
- Sliding/fixed window (deferred to v0.2; interface must not break to add them).
- Postgres/DynamoDB/DurableObject adapters (deferred to v0.3+).

## Success criteria

1. `new Limiter({ storage, limit, key }).limit(id)` works identically across
   `memory()` and `redis()` — swapping the adapter is a one-line change.
2. A concurrency test (N parallel `limit()` calls on one key against redis)
   never exceeds the configured limit. Zero race conditions.
3. `memory()` throws at construction in a detected serverless runtime unless
   explicitly opted in.
4. `by.agent` resolves agent identity from `x-agent-id` header / MCP session id
   / UA fingerprint.
5. README opens with the agent-first story, not "another agnostic limiter".
6. Published to npm as `@crafter/limit`, TypeScript strict, Bun, ESM.

## Architecture (locked)

Hybrid B-core + C-surface. See `shaping.md`. Key contracts:

```ts
export interface CounterState { count: number; ts: number; prev?: number }

export type Step = (prev: CounterState | null, now: number) =>
  { next: CounterState; result: RateLimitResult; ttlMs: number };

export interface Storage {
  kind: string;
  distributed: boolean;
  transition(key: string, step: Step): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  readonly raw: unknown;
}

export interface RateLimitResult {
  success: boolean; remaining: number; reset: number; limit: number;
}
```

- Algorithm = pure `Step` reducer in core. Adapter only does atomic
  read-modify-write.
- `casLoop(step, { load, commit })` helper in core = the only race logic;
  CAS-based adapters reuse it. Redis takes a 1-round-trip Lua fast path.
- `by.*` helpers produce the key. Default `by.ip`.
- Serverless guard via `storage.distributed`.

## Decisions resolved

| Decision | Resolution |
|---|---|
| Package name | `@crafter/limit` |
| Sliding window precision | Approximated (2-counter), v0.2 — keeps single primitive |
| Conformance suite | Build in v0.1: a shared race/correctness test every adapter imports and runs |

## Vertical slices (issues)

Each slice is independently demoable. Tracer-bullet order.

- **RL-1**: Core types + `tokenBucket` + `Limiter` + `casLoop` + `memory()`.
  Demo: in-memory limiter rejects after N calls in a single process. Includes
  the conformance test harness (race test) running against memory.
- **RL-2**: `redis()` adapter (Lua fast path) passing the conformance suite
  under real concurrency. Demo: 100 parallel calls on one key never exceed N.
- **RL-3**: `by.*` identity helpers incl `by.agent`, `by.fallback`,
  `by.header`, `by.custom`. Demo: limiter keyed per-agent from a request.
- **RL-4**: Serverless loud-failure (`memory()` throws + `Limiter` backstop via
  `distributed`). Demo: importing memory() under VERCEL=1 throws with fix hint.
- **RL-5**: Escape hatch typing (`redis().raw` typed as the underlying client)
  + README with agent-first positioning + npm publish config (tsup, exports map,
  subpath adapters).

## Stack

Bun, TypeScript strict (no `any`), Biome, ESM, tsup for build, vitest/bun:test
for the conformance suite. Monorepo or single package with subpath exports
(`@crafter/limit`, `@crafter/limit/redis`, `@crafter/limit/memory`).
