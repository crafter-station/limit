# @crafter/limit

Agent-first rate limiting. Limit once, run anywhere.

The rate limiter for the agent era: budget per **agent**, not per IP. When the
caller is an MCP server fanning out or a Claude session hammering your endpoint,
an IP means nothing. `@crafter/limit` keys on the agent and counts correctly
across every server instance, on any storage you already run.

```ts
import { Limiter, tokenBucket, by } from "@crafter/limit";
import { redis } from "@crafter/limit/redis";

const limiter = new Limiter({
  storage: redis({ url: process.env.REDIS_URL! }),
  limit: tokenBucket(10, "10s"),
  key: by.agent, // the differentiator. default: by.ip
});

const { success, remaining, reset, limit } = await limiter.limit(agentId);
if (!success) return new Response("rate limited", { status: 429 });
```

## Why

- **BYO storage.** Unlike `@upstash/ratelimit` (which ties you to their Redis
  HTTP client), this accepts any backend through one small adapter interface.
  Swap `redis()` for `memory()` for `dynamodb()` and your call sites never change.
- **Agent-first.** `by.agent` is a first-class citizen. Per-agent budgets, not
  per-IP — the abuse vector nobody else models.
- **Correct by construction.** One atomic primitive per adapter. No
  read-then-write, so no multiserver race. A single shared CAS loop is the only
  race logic in the library.
- **Loud when wrong.** `memory()` throws at boot in a serverless runtime instead
  of silently letting `limit × instances` requests through.

## Status

`v0.1` in progress. Scaffold + typed contracts landed; implementation lands via
slices RL-1..RL-5. See `PRD.md`.

| Ships | |
|---|---|
| v0.1 | `Limiter` + `tokenBucket` + `memory()` + `redis()` + `by.*` + serverless guard |
| v0.2 | `slidingWindow` + `fixedWindow` + presets + framework middleware |
| v0.3+ | `postgres()`, `dynamodb()`, `durableObject()` adapters |

## License

MIT
