import type { LimiterOptions, RateLimitResult } from "./types.js";

/** Detect a serverless runtime. Used by the loud-failure guard. */
export function detectServerless(): string | null {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  if (env?.AWS_LAMBDA_FUNCTION_NAME)
    return `AWS Lambda (${env.AWS_LAMBDA_FUNCTION_NAME})`;
  if (env?.VERCEL) return "Vercel";
  if (env?.NETLIFY) return "Netlify";
  // Cloudflare Workers exposes navigator.userAgent === "Cloudflare-Workers"
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  if (nav?.userAgent === "Cloudflare-Workers") return "Cloudflare Workers";
  return null;
}

/**
 * The single entry point. Holds a storage adapter + an algorithm, namespaces
 * keys, calls the atomic transition, and shapes the public result.
 */
export class Limiter<TReq = unknown> {
  // TODO(RL-1): store opts, run the serverless guard (see RL-4), expose limit().
  constructor(_opts: LimiterOptions<TReq>) {
    throw new Error("not implemented: Limiter (RL-1, guard in RL-4)");
  }

  /**
   * Consume one token for `idOrReq`. If a `key` resolver was configured, pass a
   * request; otherwise pass the raw id string.
   */
  async limit(_idOrReq: TReq | string): Promise<RateLimitResult> {
    throw new Error("not implemented: Limiter.limit (RL-1)");
  }
}
