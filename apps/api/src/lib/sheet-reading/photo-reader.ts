import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { readPhoto, type PhotoReading, type ReadingContext } from './read-photo'

/** Reads the photo of a sheet; where it runs is up to the implementation. */
export type PhotoReader = (photo: Uint8Array, context: ReadingContext) => Promise<PhotoReading>

/** What the worker sends back: the reading, or why it failed. */
type WorkerAnswer = { id: number; reading: PhotoReading } | { id: number; error: string }

interface QueuedReading {
  photo: Uint8Array
  context: ReadingContext
  resolve: (reading: PhotoReading) => void
  reject: (error: Error) => void
}

/**
 * Readings on one worker thread, started on the first photo and kept for the
 * next ones, since loading the decoder costs more than a reading. The thread
 * gets one photo at a time and the rest wait in the queue: decoding a 12 MP
 * phone photo takes 90 to 140 MB, and photos sent together would add up past
 * the function's memory. If the thread dies, only the photo it was reading
 * fails, and a new thread goes on with the queue.
 *
 * The thread holds the process only while a reading is under way, so an idle
 * reader never keeps the API from shutting down, and a reading is never cut
 * short by it.
 */
export function createWorkerPhotoReader(workerUrl: URL): PhotoReader {
  let worker: Worker | undefined
  let current: QueuedReading | undefined
  let nextId = 0
  const queue: QueuedReading[] = []

  function sendNext(thread: Worker): void {
    current = queue.shift()
    if (current === undefined) {
      thread.unref()
      return
    }
    thread.ref()
    thread.postMessage({ id: nextId++, photo: current.photo, context: current.context })
  }

  function stop(thread: Worker, error: Error): void {
    if (worker !== thread) return
    worker = undefined
    current?.reject(error)
    current = undefined
    if (queue.length > 0) sendNext(running())
  }

  function start(): Worker {
    const thread = new Worker(workerUrl)
    thread.on('message', (answer: WorkerAnswer) => {
      if ('reading' in answer) current?.resolve(answer.reading)
      else current?.reject(new Error(answer.error))
      sendNext(thread)
    })
    thread.on('error', (error) => stop(thread, error))
    thread.on('exit', (code) => stop(thread, new Error(`The sheet reader stopped with code ${code}`)))
    return thread
  }

  function running(): Worker {
    worker ??= start()
    return worker
  }

  return (photo, context) =>
    new Promise<PhotoReading>((resolve, reject) => {
      queue.push({ photo, context, resolve, reject })
      const thread = running()
      if (current === undefined) sendNext(thread)
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
