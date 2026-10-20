import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { FILE_STORAGE, type Env } from '../config/env'
import { API_ERROR_CODE, ApiError } from './api-error'

/**
 * Where the API keeps files that do not belong in the database, such as the
 * PDF of an application (`docs/adr/ADR-004`). Keys are built by the server,
 * like `applications/<id>/<file>.pdf`; nothing a client sends becomes a key.
 */
export interface FileStorage {
  save: (key: string, content: Uint8Array, contentType: string) => Promise<void>
  /** `null` when nothing is stored under the key: a missing file is an answer, not a failure. */
  read: (key: string) => Promise<Buffer | null>
  /** Does nothing when the key holds nothing, so removing twice is safe. */
  remove: (key: string) => Promise<void>
}

/**
 * A segment starts with a letter or digit, so neither `..` nor a hidden file
 * can be named, and an empty segment (`a//b`) is refused with the rest.
 */
const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** The segments of a valid key. A key outside the pattern is a bug in the caller, never user input. */
export function keySegments(key: string): string[] {
  const segments = key.split('/')
  if (!segments.every((segment) => KEY_SEGMENT.test(segment))) throw new Error(`Invalid file storage key: ${key}`)
  return segments
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

/**
 * A folder on disk, for development, the tests and CI. A file is written beside
 * its final name and then renamed, so a reader never finds half a PDF.
 */
export function createLocalFileStorage(folder: string): FileStorage {
  const root = resolve(folder)
  const pathOf = (key: string) => {
    const path = join(root, ...keySegments(key))
    if (!path.startsWith(root + sep)) throw new Error(`Invalid file storage key: ${key}`)
    return path
  }

  return {
    async save(key, content) {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      const partial = `${path}.${randomUUID()}.partial`
      await writeFile(partial, content)
      await rename(partial, path)
    },

    async read(key) {
      try {
        return await readFile(pathOf(key))
      } catch (error) {
        if (isMissingFile(error)) return null
        throw error
      }
    },

    async remove(key) {
      await rm(pathOf(key), { force: true })
    },
  }
}

/**
 * The part of a Cloud Storage bucket this API uses. `firebase-admin` returns a
 * full bucket; the tests hand in a small fake with the same calls.
 */
export interface StorageBucket {
  /** Whether the bucket itself was created, which a 404 alone does not tell. */
  exists: () => Promise<[boolean]>
  file: (name: string) => {
    save: (data: Buffer, options: { contentType: string; resumable: boolean }) => Promise<unknown>
    download: () => Promise<[Buffer]>
    delete: (options: { ignoreNotFound: boolean }) => Promise<unknown>
  }
}

const BUCKET_MISSING = 'O armazenamento de arquivos do servidor não está disponível.'

function isMissingObject(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 404
}

/**
 * Cloud Storage answers 404 both for a file that is not there and for a bucket
 * that was never created. Taken for a missing file, a missing bucket made the
 * API tell the teacher to generate the exam again, which cannot help: the next
 * PDF has nowhere to go either. The bucket is asked only after a 404, so a
 * normal download costs no extra call. The failure is logged with its cause,
 * which is what whoever sets up the project needs to see.
 */
async function missingBucketFailure(bucket: StorageBucket, error: unknown): Promise<ApiError | undefined> {
  if (!isMissingObject(error)) return undefined
  const [exists] = await bucket.exists()
  return exists ? undefined : new ApiError(API_ERROR_CODE.FAILURE, BUCKET_MISSING, { cause: error })
}

/**
 * Files in Cloud Storage. The bucket is looked up on the first file, not when
 * the API starts: a project whose Storage is not set up yet still serves every
 * other route, and only the routes that touch files answer with a failure.
 * Uploads are not resumable, since a PDF fits in one request.
 */
export function createBucketFileStorage(openBucket: () => StorageBucket): FileStorage {
  let bucket: StorageBucket | undefined
  const open = (): StorageBucket => (bucket ??= openBucket())
  const fileOf = (key: string) => open().file(keySegments(key).join('/'))

  return {
    async save(key, content, contentType) {
      try {
        await fileOf(key).save(Buffer.from(content), { contentType, resumable: false })
      } catch (error) {
        throw (await missingBucketFailure(open(), error)) ?? error
      }
    },

    async read(key) {
      try {
        const [content] = await fileOf(key).download()
        return content
      } catch (error) {
        const failure = await missingBucketFailure(open(), error)
        if (failure !== undefined) throw failure
        if (isMissingObject(error)) return null
        throw error
      }
    },

    async remove(key) {
      await fileOf(key).delete({ ignoreNotFound: true })
    },
  }
}

/**
 * The bucket of the Firebase project the function runs in. On the host,
 * `initializeApp` reads the project and its default bucket from
 * `FIREBASE_CONFIG`, and the function's service account grants the access, so
 * no key is kept anywhere (`docs/adr/ADR-004`).
 */
export function firebaseBucket(name?: string): StorageBucket {
  const app = getApps()[0] ?? initializeApp()
  return getStorage(app).bucket(name)
}

/** Answers every call with a failure: what an app built without storage does, so nothing is silently lost. */
export const unavailableFileStorage: FileStorage = {
  save: () => Promise.reject(storageMissing()),
  read: () => Promise.reject(storageMissing()),
  remove: () => Promise.reject(storageMissing()),
}

function storageMissing(): ApiError {
  return new ApiError(API_ERROR_CODE.FAILURE, 'O armazenamento de arquivos não está configurado.')
}

/** The storage the environment asks for: `docs/adr/ADR-004` on the host, a folder everywhere else. */
export function createFileStorage(env: Pick<Env, 'FILE_STORAGE' | 'FILE_STORAGE_DIR' | 'FILE_STORAGE_BUCKET'>): FileStorage {
  if (env.FILE_STORAGE === FILE_STORAGE.FIREBASE) return createBucketFileStorage(() => firebaseBucket(env.FILE_STORAGE_BUCKET))
  return createLocalFileStorage(env.FILE_STORAGE_DIR)
}
