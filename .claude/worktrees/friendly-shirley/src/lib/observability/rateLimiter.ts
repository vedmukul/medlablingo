
/**
 * Simple in-memory token bucket rate limiter.
 * Note: In a serverless environment (Next.js Vercel), this memory is ephemeral per lambda instance.
 * For strict global rate limiting, use Redis/KV. For this task, "in-memory" is requested.
 */

interface Bucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, Bucket>();

// Configuration
const REFILL_RATE_MS = 60 * 1000; // Refill every minute
const MAX_TOKENS = process.env.NODE_ENV === "development" ? 100 : 10; // High in dev, 10/min in prod
const REFILL_AMOUNT = MAX_TOKENS;

/**
 * Checks if a request is allowed for the given identifier (IP).
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    let bucket = buckets.get(identifier);

    if (!bucket) {
        bucket = { tokens: MAX_TOKENS, lastRefill: now };
        buckets.set(identifier, bucket);
    }

    // Refill tokens if enough time passed
    if (now - bucket.lastRefill >= REFILL_RATE_MS) {
        bucket.tokens = MAX_TOKENS;
        bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
        bucket.tokens -= 1;
        return true;
    }

    return false;
}
export function resetRateLimiterForTests() {
    // clear in-memory state
    buckets.clear(); // or whatever your map is called
}
