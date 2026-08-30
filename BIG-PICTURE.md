# Big Picture

## Outcome

Crafter Station can rate-limit authenticated and administrative actions using the Neon database it already operates, without Redis becoming a separate production dependency.

## Selected shape

`@crafter/limit` keeps a storage-agnostic core and ships Neon HTTP as its first production adapter. A fixed-window recipe is executed as one atomic Postgres upsert. Memory uses the same pure reducer for local tests.

## Boundaries

- Neon-backed limits are for actions already coupled to application state.
- Anonymous high-volume traffic stays at Vercel WAF.
- Runtime DDL, interactive transactions, pools, and cleanup timers are excluded.
- The package is dogfooded before new adapters or algorithms are added.

## Delivery status

| Slice | Outcome | Status |
|---|---|---|
| L1 | Core, fixed window, memory, and Neon HTTP adapter | In progress |
| L2 | Package release installable by consumers | Pending |
| L3 | Petdex Admin QR and authenticated actions use Neon limits | Pending |
| L4 | Petdex public traffic leaves application-level Redis limiting | Pending |
