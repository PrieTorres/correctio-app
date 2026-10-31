import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { readPhoto, type PhotoReading, type ReadingContext } from './read-photo'

/** Reads the photo of a sheet; where it runs is up to the implementation. */
export type PhotoReader = (photo: Uint8Array, context: ReadingContext) => Promise<PhotoReading>

/** What the worker sends back: the reading, or why it failed. */
type WorkerAnswer = { id: number; reading: PhotoReading } | { id: number; error: string }

interface Pending {
  resolve: (reading: PhotoReading) => void
  reject: (error: Error) => void
}

/**
 * Readings on one worker thread, started on the first photo and kept for the
 * next ones, since loading the decoder costs more than a reading. Photos queue
 * on it one after another. If the thread dies, every reading still waiting
 * fails, and the next photo starts a new one.
 *
 * The thread holds the process only while a reading is under way, so an idle
 * reader never keeps the API from shutting down, and a reading is never cut
 * short by it.
 */
export function createWorkerPhotoReader(workerUrl: URL): PhotoReader {
  let worker: Worker | undefined
  let nextId = 0
  const pending = new Map<number, Pending>()

  const failAll = (error: Error) => {
    for (const waiting of pending.values()) waiting.reject(error)
    pending.clear()
    worker = undefined
  }

  const start = (): Worker => {
    const started = new Worker(workerUrl)
    started.on('message', (answer: WorkerAnswer) => {
      const waiting = pending.get(answer.id)
      pending.delete(answer.id)
      if (pending.size === 0) started.unref()
      if ('reading' in answer) waiting?.resolve(answer.reading)
      else waiting?.reject(new Error(answer.error))
    })
    started.on('error', failAll)
    started.on('exit', (code) => failAll(new Error(`The sheet reader stopped with code ${code}`)))
    return started
  }

  return (photo, context) =>
    new Promise<PhotoReading>((resolve, reject) => {
      worker ??= start()
      worker.ref()
      const id = nextId++
      pending.set(id, { resolve, reject })
      worker.postMessage({ id, photo, context })
    })
}

/** The reading on the thread that asked: for the tests and the local server, which run from source and have no bundled worker. */
export const readPhotoHere: PhotoReader = readPhoto

/**
 * The bundle puts the worker next to the API (`build.mjs`), and there the
 * reading runs on it. From source, under the tests or `tsx`, there is no
 * bundled worker, and the reading runs in process instead: slower for the
 * other requests, which only matters with real traffic.
 */
export function createPhotoReader(): PhotoReader {
  const workerUrl = new URL('./sheet-reading-worker.js', import.meta.url)
  return existsSync(fileURLToPath(workerUrl)) ? createWorkerPhotoReader(workerUrl) : readPhotoHere
}
