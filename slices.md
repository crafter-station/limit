# Slices

## L1: Neon HTTP SDK

Observable outcome: a consumer can enforce a fixed window with one atomic Neon HTTP query.

- `Limiter`
- `fixedWindow()` recipe and reducer
- `memory()`
- `neonHttp()`
- migration statements
- explicit failure policy
- concurrent real-Neon test

Validation: unit tests, strict typecheck, build, and 100-way concurrent Neon test.

## L2: Public package

Observable outcome: a clean external project can install and execute the packed package.

- truthful README
- ESM exports
- optional Neon peer dependency
- npm package metadata
- registry publication or immutable Git commit fallback

Validation: pack, install into a temporary consumer, import every public export, and run one memory-backed limit.

## L3: Petdex authenticated dogfood

Observable outcome: WeChat QR rotation and selected authenticated mutations do not call Upstash.

- schema migration
- shared Neon rate-limit factory
- Petdex Admin integration first
- Petdex authenticated mutation integration second
- fail-open observability

Validation: route tests, builds, preview deployment, and production QR rotation verification.

## L4: Public edge protection

Observable outcome: public catalog and asset traffic is protected without application database writes.

- Vercel WAF rules in log mode
- route-by-route comparison with existing proxy rules
- enforcement after log review
- removal of public Upstash middleware calls

Validation: WAF logs, expected 429 behavior, no false positives, and no Upstash calls in the public path.
