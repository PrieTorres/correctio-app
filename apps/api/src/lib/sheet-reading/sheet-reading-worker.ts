import { parentPort } from 'node:worker_threads'
import { readPhoto, type ReadingContext } from './read-photo'

/** One reading asked of the worker; `id` pairs the answer with the request it answers. */
export interface ReadingRequest {
  id: number
  photo: Uint8Array
  context: ReadingContext
}

/**
 * The thread that decodes and reads the photos, apart from the one that
 * answers requests: decoding a phone photo takes hundreds of milliseconds of
 * CPU, which on the main thread would hold every other request of the API
 * (`docs/Seguranca_e_LGPD.md`, section 7; ADR-007). Bundled on its own, next
 * to the API, by `build.mjs`.
 */
parentPort?.on('message', (request: ReadingRequest) => {
  readPhoto(request.photo, request.context).then(
    (reading) => parentPort?.postMessage({ id: request.id, reading }),
    (error: unknown) => parentPort?.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) }),
  )
})
