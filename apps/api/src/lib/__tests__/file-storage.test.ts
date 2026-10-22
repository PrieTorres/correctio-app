import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api-error'
import {
  createBucketFileStorage,
  createFileStorage,
  createLocalFileStorage,
  firebaseBucket,
  keySegments,
  unavailableFileStorage,
  type StorageBucket,
} from '../file-storage'

const PDF = Buffer.from('%PDF-1.7 conteúdo')

describe('keySegments', () => {
  it('splits a key built by the server', () => {
    expect(keySegments('applications/a1/7f3e.pdf')).toEqual(['applications', 'a1', '7f3e.pdf'])
  })

  it.each(['../secrets', 'applications/../../etc', '/absolute', 'a//b', '', '.hidden', 'a/ b'])(
    'refuses %j, which could leave the storage folder or name nothing',
    (key) => {
      expect(() => keySegments(key)).toThrow(/Invalid file storage key/)
    },
  )
})

describe('createLocalFileStorage', () => {
  let folder: string

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'correctio-files-'))
  })

  afterEach(() => rm(folder, { recursive: true, force: true }))

  it('reads back what it saved', async () => {
    const storage = createLocalFileStorage(folder)

    await storage.save('applications/a1/exam.pdf', PDF, 'application/pdf')

    await expect(storage.read('applications/a1/exam.pdf')).resolves.toEqual(PDF)
  })

  it('answers null for a key that holds nothing', async () => {
    await expect(createLocalFileStorage(folder).read('applications/a1/none.pdf')).resolves.toBeNull()
  })

  it('replaces the file saved under the same key', async () => {
    const storage = createLocalFileStorage(folder)

    await storage.save('a/exam.pdf', Buffer.from('first'), 'application/pdf')
    await storage.save('a/exam.pdf', PDF, 'application/pdf')

    await expect(storage.read('a/exam.pdf')).resolves.toEqual(PDF)
  })

  /** The file is written under another name and renamed, so no half-written copy is ever left behind. */
  it('leaves only the final file in the folder', async () => {
    await createLocalFileStorage(folder).save('a/exam.pdf', PDF, 'application/pdf')

    await expect(readdir(join(folder, 'a'))).resolves.toEqual(['exam.pdf'])
  })

  it('removes a file, and removing it again changes nothing', async () => {
    const storage = createLocalFileStorage(folder)
    await storage.save('a/exam.pdf', PDF, 'application/pdf')

    await storage.remove('a/exam.pdf')
    await storage.remove('a/exam.pdf')

    await expect(storage.read('a/exam.pdf')).resolves.toBeNull()
  })

  it('refuses a key that would reach outside its folder', async () => {
    await expect(createLocalFileStorage(folder).read('../outside.pdf')).rejects.toThrow(/Invalid file storage key/)
  })

  it('passes on a failure other than a missing file', async () => {
    const storage = createLocalFileStorage(folder)
    await storage.save('a/exam.pdf', PDF, 'application/pdf')

    await expect(storage.read('a')).rejects.toMatchObject({ code: 'EISDIR' })
  })
})

/**
 * An in-memory bucket with the calls the storage makes, answering 404 as Cloud
 * Storage does: for a missing object, and for anything at all when the bucket
 * itself was never created.
 */
function fakeBucket({ created = true }: { created?: boolean } = {}) {
  const objects = new Map<string, { data: Buffer; contentType: string }>()
  const notFound = Object.assign(new Error('No such object'), { code: 404 })
  const noBucket = Object.assign(new Error('The specified bucket does not exist.'), { code: 404 })
  const bucket: StorageBucket = {
    exists: () => Promise.resolve([created]),
    file: (name) => ({
      save: (data, { contentType }) =>
        created ? Promise.resolve(objects.set(name, { data, contentType })) : Promise.reject(noBucket),
      download: () => {
        const stored = objects.get(name)
        if (!created) return Promise.reject(noBucket)
        return stored === undefined ? Promise.reject(notFound) : Promise.resolve([stored.data])
      },
      delete: () => Promise.resolve(objects.delete(name)),
    }),
  }
  return { bucket, objects, noBucket }
}

describe('createBucketFileStorage', () => {
  it('saves under the key with the content type, and reads it back', async () => {
    const { bucket, objects } = fakeBucket()
    const storage = createBucketFileStorage(() => bucket)

    await storage.save('applications/a1/exam.pdf', PDF, 'application/pdf')

    expect(objects.get('applications/a1/exam.pdf')?.contentType).toBe('application/pdf')
    await expect(storage.read('applications/a1/exam.pdf')).resolves.toEqual(PDF)
  })

  it('answers null for an object the bucket does not have', async () => {
    const { bucket } = fakeBucket()

    await expect(createBucketFileStorage(() => bucket).read('applications/a1/none.pdf')).resolves.toBeNull()
  })

  /**
   * Cloud Storage answers 404 for a bucket that was never created too. Taken
   * for a missing file, it made the screen say to generate the exam again,
   * which cannot work: the new PDF would have nowhere to go either.
   */
  it('tells a bucket that does not exist apart from a missing file, keeping the cause', async () => {
    const { bucket, noBucket } = fakeBucket({ created: false })
    const storage = createBucketFileStorage(() => bucket)

    const reading = storage.read('applications/a1/exam.pdf')
    await expect(reading).rejects.toBeInstanceOf(ApiError)
    await expect(reading).rejects.toMatchObject({
      code: 'failure',
      message: 'O armazenamento de arquivos do servidor não está disponível.',
      cause: noBucket,
    })
    await expect(storage.save('applications/a1/exam.pdf', PDF, 'application/pdf')).rejects.toMatchObject({
      code: 'failure',
      message: 'O armazenamento de arquivos do servidor não está disponível.',
    })
  })

  /** The bucket is asked about only after a 404, so a normal download costs one call. */
  it('does not ask whether the bucket exists when the file is there', async () => {
    const { bucket } = fakeBucket()
    const exists = vi.spyOn(bucket, 'exists')
    const storage = createBucketFileStorage(() => bucket)
    await storage.save('a/exam.pdf', PDF, 'application/pdf')

    await storage.read('a/exam.pdf')

    expect(exists).not.toHaveBeenCalled()
  })

  it('passes on any other failure of the bucket', async () => {
    const denied = Object.assign(new Error('Permission denied'), { code: 403 })
    const bucket: StorageBucket = {
      exists: () => Promise.resolve([true]),
      file: () => ({
        save: () => Promise.resolve(),
        download: () => Promise.reject(denied),
        delete: () => Promise.resolve(),
      }),
    }

    await expect(createBucketFileStorage(() => bucket).read('a/exam.pdf')).rejects.toBe(denied)
  })

  it('removes an object', async () => {
    const { bucket, objects } = fakeBucket()
    const storage = createBucketFileStorage(() => bucket)
    await storage.save('a/exam.pdf', PDF, 'application/pdf')

    await storage.remove('a/exam.pdf')

    expect(objects.has('a/exam.pdf')).toBe(false)
  })

  /** A project whose Storage is not set up yet still starts: only the routes that touch files fail. */
  it('opens the bucket on the first file, once', async () => {
    const { bucket } = fakeBucket()
    const openBucket = vi.fn(() => bucket)
    const storage = createBucketFileStorage(openBucket)
    expect(openBucket).not.toHaveBeenCalled()

    await storage.save('a/exam.pdf', PDF, 'application/pdf')
    await storage.read('a/exam.pdf')

    expect(openBucket).toHaveBeenCalledTimes(1)
  })

  it('refuses an invalid key before reaching the bucket', async () => {
    const { bucket } = fakeBucket()

    await expect(createBucketFileStorage(() => bucket).save('../x.pdf', PDF, 'application/pdf')).rejects.toThrow(
      /Invalid file storage key/,
    )
  })
})

describe('firebaseBucket', () => {
  it('opens a named bucket without calling Google, which happens only on the first file', () => {
    expect(typeof firebaseBucket('correctio-app-test').file).toBe('function')
  })
})

describe('createFileStorage', () => {
  let folder: string

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'correctio-files-'))
  })

  afterEach(() => rm(folder, { recursive: true, force: true }))

  it('uses the folder of the environment outside the host', async () => {
    const storage = createFileStorage({ FILE_STORAGE: 'local', FILE_STORAGE_DIR: folder, FILE_STORAGE_BUCKET: undefined })

    await storage.save('a/exam.pdf', PDF, 'application/pdf')

    await expect(readdir(join(folder, 'a'))).resolves.toEqual(['exam.pdf'])
  })

  /** Without a bucket configured, starting must not fail: only a file operation can. */
  it('builds the bucket storage without opening the bucket', () => {
    expect(() => createFileStorage({ FILE_STORAGE: 'firebase', FILE_STORAGE_DIR: folder, FILE_STORAGE_BUCKET: undefined })).not.toThrow()
  })
})

describe('unavailableFileStorage', () => {
  it('fails every call with a message for the screen, instead of losing the file', async () => {
    await expect(unavailableFileStorage.read('a/exam.pdf')).rejects.toBeInstanceOf(ApiError)
    await expect(unavailableFileStorage.save('a/exam.pdf', PDF, 'application/pdf')).rejects.toMatchObject({ code: 'failure' })
    await expect(unavailableFileStorage.remove('a/exam.pdf')).rejects.toMatchObject({ code: 'failure' })
  })
})
