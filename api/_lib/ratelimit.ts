// Per-IP fixed-window limiter held in module memory. Each edge instance keeps
// its own Map, so the limit is per-instance and best-effort — good enough to
// blunt casual abuse on a portfolio site, with no external store to fail.
// It never throws: any internal error allows the request.

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
// Bound memory on a long-lived instance; expired entries are swept first.
const MAX_TRACKED_IPS = 5000;

interface Window {
  start: number;
  count: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

function sweep(now: number) {
  for (const [ip, w] of windows) {
    if (now - w.start >= RATE_LIMIT_WINDOW_MS) windows.delete(ip);
  }
  // Still full after dropping expired entries: forget the oldest ones.
  while (windows.size >= MAX_TRACKED_IPS) {
    const oldest = windows.keys().next().value;
    if (oldest === undefined) break;
    windows.delete(oldest);
  }
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  try {
    const w = windows.get(ip);
    if (!w || now - w.start >= RATE_LIMIT_WINDOW_MS) {
      if (!w && windows.size >= MAX_TRACKED_IPS) sweep(now);
      windows.set(ip, { start: now, count: 1 });
      return { allowed: true };
    }
    if (w.count >= RATE_LIMIT_MAX) {
      return { allowed: false, reason: `${RATE_LIMIT_MAX} messages per minute` };
    }
    w.count++;
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/** Test hook. */
export function resetRateLimit() {
  windows.clear();
}
