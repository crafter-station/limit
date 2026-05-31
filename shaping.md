---
type: shaping
created: 2026-05-30
status: shaped
org: crafter-station
themes: [rate-limiting, agent-first, sdk, oss]
---

# ratelimit-sdk — Agent-first rate limiting, BYO storage

## One-liner

The simplest SDK for rate limiting so you can forget about it, agnostic to every
platform. The `@upstash/ratelimit` competitor whose differentiator is **BYO
storage** + **agent-first keying** (budgets per agent, not per IP).

## Why this exists

- **Upstash** has the DX but ties you to *their* Redis client (the constructor
  takes `@upstash/redis`, an HTTP REST client; a normal Redis won't fit). It is
  de-facto vendor-locked.
- **Unkey** is the hosted product (pivoted to stateful Go servers Dec 2025) —
  not "just an SDK", it's infra you depend on.
- **Files SDK** (files-sdk.dev) proved the pattern for storage: "Write once,
  store anywhere", single-import, adapter-as-function, identical call sites,
  escape hatch. This is the same product, applied to rate limiting.
- **The gap nobody filled**: rate limiting where the caller is an *agent*
  (MCP server fan-out, a Claude session hammering an endpoint), not a human IP.
  Connects to [[pattern_agent_first]] and [[pattern_selfish_source]] — build for
  Hunter's own stack (Kai swarm, agent-first CLIs) first, package after.

## Positioning

**Agent-first rate limiting.** "Rate limiting for the agent era: budgets per
agent, not per IP." Base technical story: runs on any storage. Hook: `by.agent`
as a first-class citizen, which neither Upstash nor Unkey model.

## Architecture decision: hybrid B-core + C-surface

Chosen after a 3-shape "Design It Twice" pass (2026-05-30). All three shapes
independently converged on: **algorithm lives in core, adapter only counts
atomically; one atomic primitive in the Storage interface; CounterState is an
opaque pair of numbers.** That foundation is settled.

The divergence was *where the algorithm math runs*. Decision:

### Core (from Shape B — correctness-first)
- **`Step` reducer**: a pure function `(prev: CounterState | null, now) =>
  { next, result, ttlMs }`. This IS the entire algorithm. No I/O, `now`
  injected for testability.
- **`casLoop` helper in core**: the ONLY race-handling logic in the whole
  library, written once. Adapters that can't run server-side scripts (DynamoDB,
  Postgres) plug their load + conditional-commit ops into it. Redis takes a
  1-round-trip Lua fast path as a special case.
- **One `Storage` primitive**: `transition(key, step) => Promise<RateLimitResult>`.
  Atomic read-modify-write per key. No generic get/set (that's the race).

### Surface (from Shape C — forget-about-it)
- **`by.*` identity helpers**: `by.ip`, `by.user`, `by.apiKey`, **`by.agent`**
  (x-agent-id header / MCP session id / UA fingerprint), `by.fallback(...)`,
  `by.header(...)`, `by.custom(...)`. `by.agent` is the differentiator.
- **Loud failure for the serverless-memory footgun**: `memory()` throws at
  construction if it detects a serverless runtime (AWS_LAMBDA / VERCEL / CF
  Workers) unless `allowInServerless: true`. Backstop in the `Limiter`
  constructor via `storage.distributed: boolean`. The classic silent
  "effective limit × N instances" abuse bug becomes a boot-time crash with a
  copy-pasteable fix.

### Rejected (from Shape A)
- The dual `compute` closure + declarative `recipe` (algorithm written twice,
  JS + recipe-to-Lua). Premature complexity for v0.1. If a user ever needs
  1-round-trip Redis, the Redis adapter drops to Lua internally without forcing
  every algorithm to be authored twice.

## Public API (target)

```ts
import { Limiter, tokenBucket, by } from "@crafter/limit";
import { redis } from "@crafter/limit/redis";
import { memory } from "@crafter/limit/memory";

const limiter = new Limiter({
  storage: redis({ url: process.env.REDIS_URL! }),
  limit: tokenBucket(10, "10s"),
  key: by.agent,            // <- the differentiator. default: by.ip
  prefix: "api",            // optional
});

const { success, remaining, reset, limit } = await limiter.limit(agentId);
if (!success) return new Response("rate limited", { status: 429 });
```

Swapping `redis(...)` -> `memory(...)` -> `dynamodb(...)` is a one-line change;
the `await limiter.limit(...)` call site never changes.

## Storage interface (the contract)

```ts
export interface CounterState {
  count: number;   // tokens / request count (algorithm-defined)
  ts: number;      // last-update epoch ms
  prev?: number;   // reserved now for sliding-window 2-counter (no future break)
}

export type Step = (prev: CounterState | null, now: number) =>
  { next: CounterState; result: RateLimitResult; ttlMs: number };

export interface Storage {
  kind: string;            // "memory" | "redis" | ... (for loud-failure check)
  distributed: boolean;    // shared across instances? gates serverless guard
  transition(key: string, step: Step): Promise<RateLimitResult>;  // THE primitive
  reset(key: string): Promise<void>;
  readonly raw: unknown;   // escape hatch to native client
}
```

## Roadmap

| Version | Ships |
|---|---|
| v0.1 | `Limiter` + `tokenBucket` + `memory()` + `redis()` + `by.*` (incl `by.agent`) + serverless loud-failure + escape hatch |
| v0.2 | `slidingWindow` (approx 2-counter) + `fixedWindow` + presets + framework middleware (`@crafter/limit/next`, `/hono`, `/express`) |
| v0.3 | `postgres()` adapter |
| v0.4 | `dynamodb()` + `durableObject()` adapters |

`redis()` alone makes it "agnostic to AWS/GCP/Vercel/Azure" — they all offer
managed Redis. No need to ship N cloud adapters; ship N *store* adapters.

## Open decisions (for PRD / scaffold)

1. Package name: `@crafter/limit` vs `@crafter/ratelimit`. (Leaning `@crafter/limit`.)
2. `slidingWindow` precise vs approximated in v0.2. (Approximated keeps the
   single-primitive interface; recommend approximated.)
3. Conformance test suite every adapter must pass (race test under concurrency).
   Build this in v0.1 so adapter authors have a correctness gate.

## Prior context

- Files SDK reference: https://files-sdk.dev/
- Upstash ratelimit: https://github.com/upstash/ratelimit-js
- Unkey serverless exit: https://www.unkey.com/blog/serverless-exit
- 3-shape design pass outputs: this conversation, 2026-05-30.
