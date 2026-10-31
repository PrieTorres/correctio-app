import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MutationObserver, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  backgroundJobKeys,
  dropBackgroundJobs,
  jobOf,
  useBackgroundJob,
  useBackgroundJobs,
  useDismissBackgroundJob,
  useIsJobRunning,
} from '../jobs'

const FILE = { blob: new Blob(['Aluno;Nota']), filename: 'relatorio-aplicacao-2026-10-05.csv' }

/** One client for every hook of a test, as the app has one: what a screen starts, the layout reads. */
function sharedClient() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, wrapper }
}

/** A job that finishes when the test says so, to see it while it runs. */
function controllable<Result>() {
  let finish: (result: Result) => void = () => undefined
  let fail: (error: Error) => void = () => undefined
  const run = () =>
    new Promise<Result>((resolve, reject) => {
      finish = resolve
      fail = reject
    })
  return { run, finish: (result: Result) => finish(result), fail: (error: Error) => fail(error) }
}

describe('background jobs', () => {
  /** RF41: the notice shows the job the moment it starts, before anything comes back. */
  it('shows a job as running at once, and as done with its file when it finishes', async () => {
    const { wrapper } = sharedClient()
    const job = controllable<typeof FILE>()
    const { result } = renderHook(() => ({ start: useBackgroundJob('EXPORT', job.run), jobs: useBackgroundJobs(), running: useIsJobRunning('EXPORT') }), { wrapper })

    act(() => result.current.start.mutate({ label: 'Relatório da aplicação em CSV' }))

    await waitFor(() => expect(result.current.jobs).toMatchObject([{ type: 'EXPORT', status: 'RUNNING', label: 'Relatório da aplicação em CSV' }]))
    expect(result.current.running).toBe(true)

    act(() => job.finish(FILE))

    await waitFor(() => expect(result.current.jobs).toMatchObject([{ status: 'DONE', file: FILE }]))
    expect(result.current.running).toBe(false)
  })

  it('says why a job failed', async () => {
    const { wrapper } = sharedClient()
    const job = controllable<typeof FILE>()
    const { result } = renderHook(() => ({ start: useBackgroundJob('EXPORT', job.run), jobs: useBackgroundJobs() }), { wrapper })

    act(() => result.current.start.mutate({ label: 'Relatório' }))
    await waitFor(() => expect(result.current.jobs).toMatchObject([{ status: 'RUNNING' }]))
    act(() => job.fail(new Error('Muitas consultas seguidas.')))

    await waitFor(() => expect(result.current.jobs).toMatchObject([{ status: 'FAILED', error: 'Muitas consultas seguidas.' }]))
  })

  /** The teacher leaves the report screen while the file is made, and finds it on the next one. */
  it('keeps the job after the screen that started it is gone', async () => {
    const { wrapper } = sharedClient()
    const job = controllable<typeof FILE>()
    const screen = renderHook(() => useBackgroundJob('EXPORT', job.run), { wrapper })
    const notice = renderHook(() => useBackgroundJobs(), { wrapper })

    act(() => screen.result.current.mutate({ label: 'Relatório consolidado em PDF' }))
    await waitFor(() => expect(notice.result.current).toMatchObject([{ status: 'RUNNING' }]))
    screen.unmount()
    act(() => job.finish(FILE))

    await waitFor(() => expect(notice.result.current).toMatchObject([{ status: 'DONE', label: 'Relatório consolidado em PDF', file: FILE }]))
  })

  it('removes the job of a notice the teacher closed', async () => {
    const { wrapper } = sharedClient()
    const { result } = renderHook(
      () => ({ start: useBackgroundJob('EXPORT', () => Promise.resolve(FILE)), jobs: useBackgroundJobs(), dismiss: useDismissBackgroundJob() }),
      { wrapper },
    )
    await act(() => result.current.start.mutateAsync({ label: 'Relatório' }))
    const [job] = result.current.jobs

    act(() => result.current.dismiss(job?.id ?? ''))

    await waitFor(() => expect(result.current.jobs).toEqual([]))
  })

  it('drops every job at once, and only the jobs', async () => {
    const { queryClient } = sharedClient()
    await new MutationObserver(queryClient, { mutationKey: backgroundJobKeys.ofType('EXPORT'), mutationFn: () => Promise.resolve(FILE) }).mutate()
    await new MutationObserver(queryClient, { mutationKey: ['classes'], mutationFn: () => Promise.resolve('saved') }).mutate()

    dropBackgroundJobs(queryClient)

    expect(queryClient.getMutationCache().getAll().map((mutation) => mutation.options.mutationKey)).toEqual([['classes']])
  })
})

describe('jobOf', () => {
  it('leaves out a mutation that is not a job, or never started', async () => {
    const { queryClient } = sharedClient()
    await new MutationObserver(queryClient, { mutationKey: backgroundJobKeys.all, mutationFn: () => Promise.resolve(FILE) }).mutate()
    const [untyped] = queryClient.getMutationCache().getAll()

    expect(untyped === undefined ? undefined : jobOf(untyped)).toBeNull()
  })

  it('has no file for a job that produced none, and no label for one started without it', async () => {
    const { queryClient } = sharedClient()
    await new MutationObserver(queryClient, { mutationKey: backgroundJobKeys.ofType('IMPORT'), mutationFn: (_request: object) => Promise.resolve({ created: 3 }) }).mutate({})
    const [job] = queryClient.getMutationCache().getAll()

    expect(job === undefined ? undefined : jobOf(job)).toMatchObject({ type: 'IMPORT', status: 'DONE', label: '' })
    expect(job === undefined ? undefined : jobOf(job)).not.toHaveProperty('file')
  })
})
