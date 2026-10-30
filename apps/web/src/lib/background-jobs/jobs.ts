import {
  useIsMutating,
  useMutation,
  useMutationState,
  useQueryClient,
  type Mutation,
  type QueryClient,
} from '@tanstack/react-query'
import { BACKGROUND_JOB_TYPE, type BackgroundJob, type BackgroundJobType } from '@/types/domain'

/**
 * RF41: a long operation confirms at once, runs out of the way and says when
 * it is done, wherever the teacher went meanwhile (`docs/Arquitetura.md`,
 * section 7). Each job is a TanStack Query mutation under one key: the cache
 * keeps it after the screen that started it is gone, so the notice of the
 * layout reads every job from there, and no screen keeps a state of its own.
 * Exporting a report is the first job (#82); generating the PDF and importing
 * reuse the same three hooks.
 */
export const backgroundJobKeys = {
  all: ['background-job'] as const,
  ofType: (type: BackgroundJobType) => ['background-job', type] as const,
}

/** What starting any job takes: the line the notice shows for it. */
export interface JobRequest {
  label: string
}

/** A file a job produced, which the notice hands to the browser when the teacher asks. */
export interface JobFile {
  blob: Blob
  filename: string
}

/** A job as the notice shows it: the domain's `BackgroundJob`, and the file it produced, if any. */
export type BackgroundJobView = BackgroundJob & { file?: JobFile }

/** Mutation metadata telling the app's cache the job only reads, so its success marks nothing stale. */
export const READS_ONLY = { readsOnly: true } as const

const GENERIC_FAILURE = 'Não foi possível concluir. Tente de novo em instantes.'

function hasLabel(variables: unknown): variables is JobRequest {
  return typeof variables === 'object' && variables !== null && 'label' in variables && typeof variables.label === 'string'
}

function isJobFile(data: unknown): data is JobFile {
  return typeof data === 'object' && data !== null && 'blob' in data && data.blob instanceof Blob && 'filename' in data && typeof data.filename === 'string'
}

const JOB_TYPES: readonly unknown[] = Object.values(BACKGROUND_JOB_TYPE)

function isJobType(value: unknown): value is BackgroundJobType {
  return JOB_TYPES.includes(value)
}

/** The type is the second part of the key, where `useBackgroundJob` puts it. */
function typeOf(mutation: Mutation<unknown, Error, unknown>): BackgroundJobType | undefined {
  const [, type] = mutation.options.mutationKey ?? []
  return isJobType(type) ? type : undefined
}

/** The job behind one mutation of the cache, or `null` for one that never started. */
export function jobOf(mutation: Mutation<unknown, Error, unknown>): BackgroundJobView | null {
  const { status, variables, submittedAt, data, error } = mutation.state
  const type = typeOf(mutation)
  if (status === 'idle' || type === undefined) return null

  const base = {
    id: String(mutation.mutationId),
    type,
    label: hasLabel(variables) ? variables.label : '',
    startedAt: new Date(submittedAt).toISOString(),
  }
  if (status === 'pending') return { ...base, status: 'RUNNING' }
  if (status === 'error') return { ...base, status: 'FAILED', error: error?.message ?? GENERIC_FAILURE }
  return { ...base, status: 'DONE', ...(isJobFile(data) && { file: data }) }
}

/**
 * Starts jobs of one type. The job stays in the cache until the teacher
 * dismisses its notice (`gcTime: Infinity`), so a file finished while she was
 * on another screen is still there to download.
 */
export function useBackgroundJob<Request extends JobRequest, Result>(
  type: BackgroundJobType,
  run: (request: Request) => Promise<Result>,
  { readsOnly = false }: { readsOnly?: boolean } = {},
) {
  return useMutation({
    mutationKey: backgroundJobKeys.ofType(type),
    mutationFn: run,
    gcTime: Infinity,
    ...(readsOnly && { meta: READS_ONLY }),
  })
}

/** Every job of this session, the oldest first, for the notice of the layout. */
export function useBackgroundJobs(): BackgroundJobView[] {
  const jobs = useMutationState({ filters: { mutationKey: backgroundJobKeys.all }, select: jobOf })
  return jobs.filter((job) => job !== null)
}

/** Whether a job of this type is running: one export at a time per teacher (RNF13). */
export function useIsJobRunning(type: BackgroundJobType): boolean {
  return useIsMutating({ mutationKey: backgroundJobKeys.ofType(type) }) > 0
}

/**
 * Removes the job of a notice the teacher closed, and with it the file it held.
 * `findAll`, not `find`: `find` matches the key exactly by default, and every
 * job's key is longer than the prefix they share, so it found nothing and the
 * notice never closed.
 */
export function useDismissBackgroundJob(): (id: string) => void {
  const queryClient = useQueryClient()
  return (id) => {
    const cache = queryClient.getMutationCache()
    for (const mutation of cache.findAll({ mutationKey: backgroundJobKeys.all, predicate: (item) => String(item.mutationId) === id })) {
      cache.remove(mutation)
    }
  }
}

/** The jobs belong to whoever started them: a session that ends takes them, and their files, along. */
export function dropBackgroundJobs(queryClient: QueryClient): void {
  const cache = queryClient.getMutationCache()
  for (const mutation of cache.findAll({ mutationKey: backgroundJobKeys.all })) cache.remove(mutation)
}
