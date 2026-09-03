import { createError, getRequestIP, type H3Event } from 'h3'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Simple in-memory sliding-window rate limiter, keyed by client IP + route.
 * Good enough for a single-instance MVP; swap for a shared store (Redis)
 * if the app ever runs multiple instances.
 */
export function enforceRateLimit(event: H3Event, routeKey: string, limit: number, windowMs: number) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const bucketKey = `${routeKey}:${ip}`
  const now = Date.now()

  sweepExpired(now)

  const bucket = buckets.get(bucketKey)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return
  }

  if (bucket.count >= limit) {
    throw createError({ statusCode: 429, statusMessage: 'Muitas tentativas. Aguarde um instante e tente novamente.' })
  }

  bucket.count++
}
