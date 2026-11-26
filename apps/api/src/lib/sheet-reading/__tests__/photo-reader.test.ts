import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createWorkerPhotoReader } from '../photo-reader'

/**
 * A stand-in for the bundled worker, speaking the same messages: the first
 * byte of the photo says how it should answer, so each test drives the thread
 * without decoding a real photo. Byte 3 answers a moment later and reports how
 * many photos the thread held at once, which is what a real decode costs in
 * memory.
 */
const FAKE_WORKER = `
import { parentPort } from 'node:worker_threads'
let held = 0
parentPort.on('message', ({ id, photo }) => {
  if (photo[0] === 1) parentPort.postMessage({ id, error: 'broken photo' })
  else if (photo[0] === 2) process.exit(3)
  else if (photo[0] === 8) throw new Error('decoder crashed')
  else if (photo[0] === 3) {
    held += 1
    const heldWithThis = held
    setTimeout(() => {
      held -= 1
      parentPort.postMessage({ id, reading: { status: 'QR_NOT_RECOGNIZED', byte: 3, held: heldWithThis } })
    }, 20)
  }
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

  /**
   * Decoding a 12 MP phone photo takes 90 to 140 MB, so photos sent together
   * would add up past the function's memory if the thread held them all.
   */
  it('hands the thread one photo at a time, however many arrive together', async () => {
    const read = createWorkerPhotoReader(workerUrl)

    const readings = await Promise.all([1, 2, 3, 4].map(() => read(Uint8Array.of(3), CONTEXT)))

    expect(readings.map((reading) => (reading as unknown as { held: number }).held)).toEqual([1, 1, 1, 1])
  })

  /** The photos queued behind it never reached the thread that stopped, so a new thread reads them. */
  it('fails only the photo whose thread stopped, and reads the ones queued behind it', async () => {
    const read = createWorkerPhotoReader(workerUrl)

    const [stopped, queued] = await Promise.allSettled([read(Uint8Array.of(2), CONTEXT), read(Uint8Array.of(6), CONTEXT)])

    expect(stopped).toMatchObject({ status: 'rejected', reason: new Error('The sheet reader stopped with code 3') })
    expect(queued).toEqual({ status: 'fulfilled', value: { status: 'QR_NOT_RECOGNIZED', byte: 6 } })
  })

  /** A thread that crashes reports the error and then exits: the photo fails with the cause, and the exit stops nothing else. */
  it('fails the photo with the error that crashed its thread, and only once', async () => {
    const read = createWorkerPhotoReader(workerUrl)

    const [crashed, queued] = await Promise.allSettled([read(Uint8Array.of(8), CONTEXT), read(Uint8Array.of(5), CONTEXT)])

    expect(crashed).toMatchObject({ status: 'rejected', reason: new Error('decoder crashed') })
    expect(queued).toEqual({ status: 'fulfilled', value: { status: 'QR_NOT_RECOGNIZED', byte: 5 } })
  })
})
