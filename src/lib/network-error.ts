/** Heuristic: connection failed or device offline — safe to retry the request later. */
export function isOfflineOrNetworkError(e: unknown): boolean {
  if (typeof TypeError !== 'undefined' && e instanceof TypeError) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch|NetworkError|fetch.*network|LOAD_FAILED|offline|ECONNREFUSED|timed out|ERR_INTERNET_DISCONNECTED|NSURLErrorDomain/i.test(
    msg,
  )
}
