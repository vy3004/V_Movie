import { redis } from "./redis";

/**
 * Rate limiter using sliding window algorithm with Redis
 * @param identifier - Unique identifier (e.g., userId, IP)
 * @param limit - Maximum number of requests allowed
 * @param window - Time window in seconds
 * @returns Object with success status and remaining requests
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  window: number,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!redis) {
    // If Redis is not available, allow the request (fail open)
    return { success: true, remaining: limit - 1, reset: Date.now() + window * 1000 };
  }

  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowStart = now - window * 1000;

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, { score: now, member: `${now}` });

    // Set expiry
    pipeline.expire(key, window);

    const results = await pipeline.exec();

    // results[1] is the count before adding current request
    const count = (results[1] as number) || 0;

    if (count >= limit) {
      return {
        success: false,
        remaining: 0,
        reset: now + window * 1000,
      };
    }

    return {
      success: true,
      remaining: limit - count - 1,
      reset: now + window * 1000,
    };
  } catch (error) {
    console.error("[RateLimit] Error:", error);
    // Fail open: allow request if Redis fails
    return { success: true, remaining: limit - 1, reset: now + window * 1000 };
  }
}
