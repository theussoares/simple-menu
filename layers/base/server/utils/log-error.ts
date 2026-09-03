/**
 * Logs the real error server-side (visible in Vercel/Nitro runtime logs)
 * while the client only ever sees the generic message we throw alongside it.
 */
export function logServerError(context: string, error: unknown) {
  console.error(`[${context}]`, error)
}
