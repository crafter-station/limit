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
  private readonly opts: LimiterOptions<TReq>;
  private readonly prefix: string;

  constructor(opts: LimiterOptions<TReq>) {
    this.opts = opts;
    this.prefix = opts.prefix ?? "rl";
  }

  /**
   * Consume one token for `idOrReq`. If a `key` resolver was configured, pass a
   * request; otherwise pass the raw id string.
   */
  async limit(idOrReq: TReq | string): Promise<RateLimitResult> {
    const id = this.opts.key ? this.opts.key(idOrReq as TReq) : String(idOrReq);
    const key = `${this.prefix}:${id}`;
    const result = await this.opts.storage.transition(
      key,
      this.opts.limit.step(Date.now()),
    );

    this.opts.onResult?.(key, result);
    return result;
  }
}
