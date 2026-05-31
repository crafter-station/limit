import type { KeyResolver } from "../types.js";

/**
 * Identity helpers — the keying decision, solved. Default for a Limiter is `ip`.
 *
 * `agent` is the differentiator: agent traffic (MCP fan-out, a single Claude
 * session hammering an endpoint) is keyed per-agent, not per-IP.
 *
 * TODO(RL-3): implement all resolvers against a minimal Request-like shape
 * (headers.get(...)). Keep the request type generic; do not hard-depend on
 * node:http or the Fetch API. Provide:
 *  - ip      : X-Forwarded-For aware, trusted-proxy safe
 *  - user    : pluggable auth-user resolver
 *  - apiKey  : Authorization bearer / x-api-key
 *  - agent   : x-agent-id header -> MCP session id -> UA fingerprint
 *  - header(name)
 *  - custom(fn)
 *  - fallback(...resolvers): first non-empty wins (e.g. user else ip)
 */
export const by = {
  ip: (() => {
    throw new Error("not implemented: by.ip (RL-3)");
  }) as unknown as KeyResolver,
  user: (() => {
    throw new Error("not implemented: by.user (RL-3)");
  }) as unknown as KeyResolver,
  apiKey: (() => {
    throw new Error("not implemented: by.apiKey (RL-3)");
  }) as unknown as KeyResolver,
  agent: (() => {
    throw new Error("not implemented: by.agent (RL-3)");
  }) as unknown as KeyResolver,
  header(_name: string): KeyResolver {
    throw new Error("not implemented: by.header (RL-3)");
  },
  custom<TReq>(fn: KeyResolver<TReq>): KeyResolver<TReq> {
    return fn;
  },
  fallback<TReq>(..._resolvers: KeyResolver<TReq>[]): KeyResolver<TReq> {
    throw new Error("not implemented: by.fallback (RL-3)");
  },
};
