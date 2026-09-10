import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Per-IP sliding window. When Upstash isn't configured (local dev), rate
// limiting is a no-op that allows everything — the endpoint still works, it
// just isn't protected. Production must set both env vars.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

const perTenMinutes = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '10 m'), prefix: 'chat:10m', analytics: false })
  : null;
const perDay = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, '1 d'), prefix: 'chat:1d', analytics: false })
  : null;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!perTenMinutes || !perDay) return { allowed: true };
  const [short, long] = await Promise.all([perTenMinutes.limit(ip), perDay.limit(ip)]);
  if (!short.success) return { allowed: false, reason: '10 messages per 10 minutes' };
  if (!long.success) return { allowed: false, reason: '40 messages per day' };
  return { allowed: true };
}
