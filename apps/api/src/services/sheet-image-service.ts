import { randomUUID } from 'node:crypto'
import { SHEET_READING, type ReadFailure, type SheetImageUpload } from '@correctio/domain'
import type { Logger } from 'pino'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import type { FileStorage } from '../lib/file-storage'
import { EXTENSION_OF, sheetPhotoTypeOf, type SheetPhotoType } from '../lib/image-type'
import type { PhotoReader } from '../lib/sheet-reading/photo-reader'
import type { PhotoReading, ReadingContext } from '../lib/sheet-reading/read-photo'
import type { ActivityLogRepository } from '../repositories/activity-log-repository'
import type { ApplicationRepository } from '../repositories/application-repository'
import type { PrintingRepository } from '../repositories/printing-repository'
import type { SheetImageRepository } from '../repositories/sheet-image-repository'
import { requireApplication } from './application-service'

/** The largest photo taken (RNF16); a phone photo is 3 to 7 MB. */
export const PHOTO_LIMIT_BYTES = 10 * 1024 * 1024

/**
 * What one teacher may send in 24 hours (`docs/Seguranca_e_LGPD.md`, section
 * 4): far above a day of grading, and a ceiling on what a stolen session could
 * fill the bucket with. Counted from the database, so a restart of the API
 * does not reset it.
 */
export const DAILY_PHOTO_LIMITS = Object.freeze({ count: 500, bytes: 200 * 1024 * 1024 })

const DAY_MS = 24 * 60 * 60 * 1000

const NO_PHOTO = 'Envie a foto da folha.'
const PHOTO_TOO_LARGE = 'A foto passou de 10 MB. Tire outra com menos resolução.'
const NOT_A_PHOTO = 'Envie a foto em JPG, PNG ou WebP.'
const NOT_PRINTED = 'Gere o PDF antes de corrigir as folhas.'
const DAILY_LIMIT = 'Você chegou ao limite de fotos enviadas em 24 horas. Tente de novo mais tarde.'
const IMAGE_NOT_FOUND = 'Foto não encontrada.'

export interface DailyPhotoLimits {
  count: number
  bytes: number
}

export interface SheetImageServiceDependencies {
  applications: ApplicationRepository
  printing: PrintingRepository
  sheetImages: SheetImageRepository
  activityLog: ActivityLogRepository
  fileStorage: FileStorage
  readPhoto: PhotoReader
  logger: Logger
  /** Injected so a test can reach the limit with a few photos. */
  dailyLimits?: DailyPhotoLimits
  now?: () => Date
}

/** A stored photo, as the review screen shows it (P16). */
export interface SheetImageContent {
  content: Buffer
  contentType: string
}

export interface SheetImageService {
  upload: (teacherId: string, applicationId: string, body: Buffer | undefined) => Promise<SheetImageUpload>
  image: (teacherId: string, applicationId: string, imageId: string) => Promise<SheetImageContent>
  readFailures: (teacherId: string, applicationId: string) => Promise<ReadFailure[]>
}

/** The photo, checked by its own bytes before anything is stored (`docs/Seguranca_e_LGPD.md`, section 7). */
function checkedPhoto(body: Buffer | undefined): { photo: Buffer; type: SheetPhotoType } {
  if (body === undefined || body.length === 0) throw new ApiError(API_ERROR_CODE.INVALID, NO_PHOTO)
  if (body.length > PHOTO_LIMIT_BYTES) throw new ApiError(API_ERROR_CODE.INVALID, PHOTO_TOO_LARGE)
  const type = sheetPhotoTypeOf(body)
  if (type === undefined) throw new ApiError(API_ERROR_CODE.INVALID, NOT_A_PHOTO)
  return { photo: body, type }
}

/**
 * The photos of the sheets of an application (#47): stored privately, read,
 * and served back only to the application's teacher. A reading is never a
 * correction: it goes back to the screen, which opens the review (RF28), and
 * the correction is written only when the teacher confirms it.
 */
export function createSheetImageService(deps: SheetImageServiceDependencies): SheetImageService {
  const { applications, printing, sheetImages, activityLog, fileStorage, readPhoto, logger } = deps
  const limits = deps.dailyLimits ?? DAILY_PHOTO_LIMITS
  const now = deps.now ?? (() => new Date())

  async function requireRoomFor(teacherId: string, bytes: number): Promise<void> {
    const usage = await sheetImages.usageSince(teacherId, new Date(now().getTime() - DAY_MS))
    if (usage.count + 1 > limits.count || usage.bytes + bytes > limits.bytes) {
      throw new ApiError(API_ERROR_CODE.TOO_MANY_REQUESTS, DAILY_LIMIT, { retryAfterSeconds: 60 * 60 })
    }
  }

  async function requirePrinted(applicationId: string): Promise<ReadingContext> {
    const context = await printing.readingContextOf(applicationId)
    if (context.sheets.length === 0) throw new ApiError(API_ERROR_CODE.CONFLICT, NOT_PRINTED)
    return context
  }

  /**
   * A reading that breaks, rather than ending in one of its outcomes, still
   * leaves a stored photo the teacher can grade by hand, so it counts as a
   * photo whose QR Code was not recognized, and the cause goes to the log.
   */
  async function read(photo: Buffer, context: ReadingContext, imageId: string): Promise<PhotoReading> {
    try {
      return await readPhoto(photo, context)
    } catch (error) {
      logger.error({ err: error, imageId }, 'The photo of a sheet could not be read')
      return { status: SHEET_READING.QR_NOT_RECOGNIZED }
    }
  }

  return {
    async upload(teacherId, applicationId, body) {
      await requireApplication(applications, teacherId, applicationId)
      const { photo, type } = checkedPhoto(body)
      const context = await requirePrinted(applicationId)
      await requireRoomFor(teacherId, photo.length)

      const imageId = randomUUID()
      const storageKey = `answer-sheets/${applicationId}/${imageId}.${EXTENSION_OF[type]}`
      await fileStorage.save(storageKey, photo, type)

      const reading = await read(photo, context, imageId)
      const answerSheetId = 'answerSheetId' in reading ? reading.answerSheetId : undefined
      await sheetImages.insert({
        id: imageId,
        applicationId,
        teacherId,
        storageKey,
        contentType: type,
        byteSize: photo.length,
        status: reading.status,
        ...(answerSheetId !== undefined && { answerSheetId }),
      })
      if (reading.status !== SHEET_READING.READ) {
        await activityLog.recordReadFailure({ teacherId, applicationId, imageId, status: reading.status, ...(answerSheetId !== undefined && { answerSheetId }) })
      }
      return { imageId, ...reading }
    },

    async image(teacherId, applicationId, imageId) {
      await requireApplication(applications, teacherId, applicationId)
      const stored = await sheetImages.find(applicationId, imageId)
      const content = stored === undefined ? null : await fileStorage.read(stored.storageKey)
      if (stored === undefined || content === null) throw new ApiError(API_ERROR_CODE.NOT_FOUND, IMAGE_NOT_FOUND)
      return { content, contentType: stored.contentType }
    },

    async readFailures(teacherId, applicationId) {
      await requireApplication(applications, teacherId, applicationId)
      return activityLog.readFailures(applicationId)
    },
  }
}
