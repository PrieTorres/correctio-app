import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createWorkerPhotoReader } from '../photo-reader'

/**
 * A stand-in for the bundled worker, speaking the same messages: the first
 * byte of the photo says how it should answer, so each test drives the thread
 * without decoding a real photo.
 */
const FAKE_WORKER = `
import { parentPort } from 'node:worker_threads'
parentPort.on('message', ({ id, photo }) => {
  if (photo[0] === 1) parentPort.postMessage({ id, error: 'broken photo' })
  else if (photo[0] === 2) process.exit(3)
  else parentPort.postMessage({ id, reading: { status: 'QR_NOT_RECOGNIZED', byte: photo[0] } })
})
`

const CONTEXT = { sheets: [], layouts: {} }

describe('createWorkerPhotoReader', () => {
  let folder: string
  let workerUrl: URL

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'correctio-reader-'))
    const file = join(folder, 'fake-worker.mjs')
    await writeFile(file, FAKE_WORKER)
    workerUrl = pathToFileURL(file)
  })

  afterAll(() => rm(folder, { recursive: true, force: true }))

  /** Several photos sent at once share one thread, and each gets the answer to its own request. */
  it('answers each reading with its own result, on one thread', async () => {
    const read = createWorkerPhotoReader(workerUrl)

    const readings = await Promise.all([read(Uint8Array.of(7), CONTEXT), read(Uint8Array.of(9), CONTEXT)])

    expect(readings).toEqual([
      { status: 'QR_NOT_RECOGNIZED', byte: 7 },
      { status: 'QR_NOT_RECOGNIZED', byte: 9 },
    ])
  })

  it('fails the reading the worker could not do, and goes on with the next', async () => {
    const read = createWorkerPhotoReader(workerUrl)

    await expect(read(Uint8Array.of(1), CONTEXT)).rejects.toThrow('broken photo')
    await expect(read(Uint8Array.of(5), CONTEXT)).resolves.toEqual({ status: 'QR_NOT_RECOGNIZED', byte: 5 })
  })

  /** A thread that dies fails what it was reading, and the next photo starts a new one instead of waiting forever. */
  it('starts a new thread after the last one stopped', async () => {
    const read = createWorkerPhotoReader(workerUrl)

    await expect(read(Uint8Array.of(2), CONTEXT)).rejects.toThrow('The sheet reader stopped with code 3')
    await expect(read(Uint8Array.of(4), CONTEXT)).resolves.toEqual({ status: 'QR_NOT_RECOGNIZED', byte: 4 })
  })
})
