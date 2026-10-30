import { z } from 'zod'
import { readPhotoInBrowser, type PhotoReading, type ReadingContext } from '@/lib/grading/read-photo-in-browser'
import { readFailureSchema, sheetImageUploadSchema } from '@/lib/schemas'
import { StorageError } from '@/lib/storage/errors'
import { createId } from '@/lib/utils'
import type { ReadFailure, SheetImageUpload } from '@/lib/schemas'
import type { ApiClient, FileClient } from './http/api-client'
import { parseEntity } from './http/create-http-repository'

/**
 * The photos of the sheets sent for correction (#47, #48): one goes up and its
 * reading comes back, never a grade. The reading stays on the screen until the
 * teacher confirms the review (RF28).
 */
export interface SheetImageRepository {
  upload: (applicationId: string, photo: Blob) => Promise<SheetImageUpload>
  /** The photo, for the review screen; it travels with the token, since it carries a student's handwriting. */
  photo: (applicationId: string, imageId: string) => Promise<Blob>
  /** The photos whose reading failed, which the upload screen lists so none is forgotten (P15). */
  readFailures: (applicationId: string) => Promise<ReadFailure[]>
}

const imagesPath = (applicationId: string) => `/applications/${encodeURIComponent(applicationId)}`

/** On the API, which reads the photo itself (ADR-007) and keeps the failures in its log. */
export function createHttpSheetImageRepository(api: ApiClient & FileClient): SheetImageRepository {
  return {
    async upload(applicationId, photo) {
      return parseEntity(sheetImageUploadSchema, await api.upload(`${imagesPath(applicationId)}/sheet-images`, photo))
    },

    async photo(applicationId, imageId) {
      return (await api.download(`${imagesPath(applicationId)}/sheet-images/${encodeURIComponent(imageId)}`)).blob
    },

    async readFailures(applicationId) {
      return parseEntity(z.array(readFailureSchema), await api.request('GET', `${imagesPath(applicationId)}/read-failures`))
    },
  }
}

const NOT_PRINTED = 'Gere o PDF antes de corrigir as folhas.'
const PHOTO_NOT_FOUND = 'Foto não encontrada.'

export interface LocalSheetImageSources {
  /** The sheets and layouts of the application, read when a photo arrives. */
  contextOf: (applicationId: string) => Promise<ReadingContext>
  /** The reader; the browser's by default, replaced in the unit tests, which run without a canvas. */
  readPhoto?: (photo: Blob, context: ReadingContext) => Promise<PhotoReading>
}

/**
 * The demo without an API: the photo is read in this browser (ADR-006) and
 * kept in memory only, since a phone photo would not fit in `localStorage`.
 * Reloading the page forgets the photos, and the corrections keep their key.
 */
export function createLocalSheetImageRepository({ contextOf, readPhoto = readPhotoInBrowser }: LocalSheetImageSources): SheetImageRepository {
  const photos = new Map<string, { applicationId: string; photo: Blob }>()
  const failures: { applicationId: string; failure: ReadFailure }[] = []

  return {
    async upload(applicationId, photo) {
      const context = await contextOf(applicationId)
      if (context.sheets.length === 0) throw new StorageError(NOT_PRINTED, 'conflict')

      const imageId = createId()
      photos.set(imageId, { applicationId, photo })
      const reading = await readPhoto(photo, context)
      if (reading.status !== 'READ') {
        failures.unshift({ applicationId, failure: { imageId, createdAt: new Date().toISOString(), ...reading } })
      }
      return { imageId, ...reading }
    },

    async photo(applicationId, imageId) {
      const stored = photos.get(imageId)
      if (stored?.applicationId !== applicationId) throw new StorageError(PHOTO_NOT_FOUND, 'not-found')
      return stored.photo
    },

    async readFailures(applicationId) {
      return failures.filter((entry) => entry.applicationId === applicationId).map((entry) => entry.failure)
    },
  }
}
