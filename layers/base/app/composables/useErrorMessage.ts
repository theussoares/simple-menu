interface FetchLikeError {
  statusMessage?: string
  data?: { statusMessage?: string; message?: string }
}

/** Extracts a safe, user-facing message from a $fetch error thrown by our own /api routes. */
export function getErrorMessage(error: unknown): string | undefined {
  const fetchError = error as FetchLikeError
  return fetchError?.data?.statusMessage ?? fetchError?.statusMessage ?? fetchError?.data?.message
}
