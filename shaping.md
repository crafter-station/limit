---
type: shaping
created: 2026-05-30
updated: 2026-08-30
status: selected
org: crafter-station
selected_shape: C
---

# @crafter/limit

## Source

> fuck como podemos hacer para tener uno persistente no depender de upstash y que siempre este up y sea ultrabarato?

> existe un adaptador para neon para hacer ratelimit barato? capaz eso puede ser un buen project open source dogfoodeable par acrafter station

> listo hagamoslo asi go

## Requirements

| Req | Requirement | Status |
|---|---|---|
| R0 | Persist distributed rate-limit state without adopting Redis | Core goal |
| R1 | Consume a limit with one atomic storage operation | Must-have |
| R2 | Remain exact under concurrent requests | Must-have |
| R3 | Require no pool, interactive transaction, or runtime timer on Neon HTTP | Must-have |
| R4 | Work in Next.js, Vercel, Bun, Node.js, and edge-compatible runtimes | Must-have |
| R5 | Never create or migrate tables during a request | Must-have |
| R6 | Expose explicit fail-open and fail-closed policies | Must-have |
| R7 | Return `success`, `remaining`, `reset`, and `limit` | Must-have |
| R8 | Support isolated integration tests against real Neon branches | Must-have |
| R9 | Keep public high-volume edge limiting outside Postgres | Must-have |
| R10 | Ship flexible fixed window in the first release | Must-have |
| R11 | Preserve a storage-agnostic core for later adapters | Must-have |
| R12 | Add agent identity, Redis, and additional algorithms only after dogfooding | Nice-to-have |

## C: BYO storage with Neon HTTP first

| Part | Mechanism | Flagged |
|---|---|---|
| C1 | `Limiter` composes one algorithm and one storage adapter | No |
| C2 | `fixedWindow()` provides a pure reducer plus a serializable transition recipe | No |
| C3 | `neonHttp()` executes the recipe as one atomic `INSERT ... ON CONFLICT ... RETURNING` query | No |
| C4 | `memory()` executes the same reducer under a per-key lock | No |
| C5 | Schema statements are exposed for migrations but never run automatically | No |
| C6 | `failureMode` selects explicit open or closed behavior | No |
| C7 | `clearExpired()` is invoked by maintenance tooling, never a runtime timer | No |
| C8 | Petdex uses Neon for authenticated and admin actions, while WAF handles anonymous public traffic | Yes: separate deployment slice |

## Fit Check

| Req | Requirement | Status | C |
|---|---|---|---|
| R0 | Persist distributed rate-limit state without adopting Redis | Core goal | ✅ |
| R1 | Consume a limit with one atomic storage operation | Must-have | ✅ |
| R2 | Remain exact under concurrent requests | Must-have | ✅ |
| R3 | Require no pool, interactive transaction, or runtime timer on Neon HTTP | Must-have | ✅ |
| R4 | Work in Next.js, Vercel, Bun, Node.js, and edge-compatible runtimes | Must-have | ✅ |
| R5 | Never create or migrate tables during a request | Must-have | ✅ |
| R6 | Expose explicit fail-open and fail-closed policies | Must-have | ✅ |
| R7 | Return `success`, `remaining`, `reset`, and `limit` | Must-have | ✅ |
| R8 | Support isolated integration tests against real Neon branches | Must-have | ✅ |
| R9 | Keep public high-volume edge limiting outside Postgres | Must-have | ✅ |
| R10 | Ship flexible fixed window in the first release | Must-have | ✅ |
| R11 | Preserve a storage-agnostic core for later adapters | Must-have | ✅ |
| R12 | Add agent identity, Redis, and additional algorithms only after dogfooding | Nice-to-have | ✅ |

## Breadboard

```text
request
  -> Limiter.limit(subject)
  -> prefix + subject
  -> fixedWindow.step(now)
     -> pure reducer
     -> fixed-window recipe
  -> storage.transition(key, step)
     -> memory: per-key lock + reducer
     -> neonHttp: atomic SQL recipe
  -> RateLimitResult
  -> application allows request or returns 429
```

## Decision

Shape C was selected on 2026-08-30. The previous Redis-first sequence is superseded. The first production release is Neon HTTP-first and must be dogfooded in Petdex before another distributed adapter is added.
