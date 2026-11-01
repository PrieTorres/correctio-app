import { MutationCache, QueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard/hooks/useDashboard'
import { reportKeys } from '@/features/reports/hooks/report-keys'
import { StorageError } from '@/lib/storage/errors'

/**
 * How long a read stays fresh. What the screens read changes only by the
 * teacher's own actions, and every action already invalidates the keys it
 * touches, so asking the API again sooner would only repeat the same answer.
 */
const STALE_TIME_MS = 5 * 60 * 1000

/**
 * One more try, and only for a failure. A 400, 404 or 409 is an answer: asking
 * again gets the same one, a moment later. A failure (network down, server
 * error, rate limit) may go through the second time.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  return !(error instanceof StorageError) || error.code === 'failure'
}

function markCountsStale(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    queryClient.invalidateQueries({ queryKey: reportKeys.all }),
  ])
}

/**
 * The cache of everything the API returns. It lives in memory only, never in
 * `localStorage`, so the next person on the same browser finds nothing.
 *
 * The dashboard and the reports count what every other screen writes, so any
 * successful write marks them stale instead of each mutation having to
 * remember them. A job that only reads, such as exporting a report, says so
 * (`READS_ONLY`) and leaves them as they are.
 */
export function createAppQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: shouldRetry, refetchOnWindowFocus: false },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) =>
        mutation.meta?.readsOnly === true ? undefined : markCountsStale(queryClient),
    }),
  })
  return queryClient
}
