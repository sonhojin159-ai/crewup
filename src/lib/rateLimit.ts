// Simple in-memory rate limiter for API routes
// Production 환경에서는 @upstash/ratelimit + Redis 사용 권장

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 만료된 항목 주기적 정리 (메모리 누수 방지)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000; // 1분

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count };
}

// 프리셋
export function rateLimitByUser(userId: string, endpoint: string, maxRequests = 10, windowMs = 60_000) {
  return rateLimit(`${endpoint}:${userId}`, maxRequests, windowMs);
}
