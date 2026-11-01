import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createLocalFileStorage, type FileStorage } from '../../lib/file-storage'
import type { PhotoReader } from '../../lib/sheet-reading/photo-reader'
import type { Database } from '../../models/tables'
import { createActivityLogRepository } from '../../repositories/activity-log-repository'
import { createApplicationRepository } from '../../repositories/application-repository'
import { createPrintingRepository } from '../../repositories/printing-repository'
import { createSheetImageRepository } from '../../repositories/sheet-image-repository'
import { createSheetImageService, type DailyPhotoLimits } from '../sheet-image-service'

/** A printed application, as far as the service asks: one sheet, so photos are taken. */
const PRINTED = { sheets: [{ id: 'sheet-1', code: 'ABCDEFGHJKLMNPQRSTUVWXYZ27', examVersionId: 'version-1' }], layouts: {} }

const notRecognized: PhotoReader = () => Promise.resolve({ status: 'QR_NOT_RECOGNIZED' })

/**
 * What the upload routes cannot reach without hundreds of photos or a broken
 * reader: the daily limits, counted from the database, and a reading that
 * fails instead of ending in one of its outcomes.
 */
describe.runIf(DATABASE_TEST_URL !== undefined)('sheet image service (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let folder: string
  let fileStorage: FileStorage
  let photo: Buffer

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values({ id: 'ana', role: 'professor', fullName: 'Ana', email: 'ana@exemplo.edu.br', passwordHash: 'x' }).execute()
    await db
      .insertInto('classes')
      .values({ id: 'class-ana', teacherId: 'ana', name: 'Cálculo I', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'CALCULO1' })
      .execute()
    await db
      .insertInto('exams')
      .values({ id: 'exam-ana', teacherId: 'ana', title: 'Prova 1', description: '', status: 'ready', defaultShuffleQuestions: false, defaultShuffleAlternatives: false })
      .execute()
    await db
      .insertInto('applications')
      .values({ id: 'app-ana', examId: 'exam-ana', classId: 'class-ana', teacherId: 'ana', status: 'generated', pdfUrl: null, date: new Date('2026-10-05T12:00:00.000Z'), gradesReleased: false })
      .execute()
    folder = await mkdtemp(join(tmpdir(), 'correctio-photos-'))
    fileStorage = createLocalFileStorage(folder)
    photo = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer()
  })

  afterAll(async () => {
    await database.drop()
    await rm(folder, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await db.deleteFrom('activity_logs').execute()
    await db.deleteFrom('sheet_images').execute()
  })

  function serviceWith({ readPhoto = notRecognized, dailyLimits, logger = { error: vi.fn() } }: { readPhoto?: PhotoReader; dailyLimits?: DailyPhotoLimits; logger?: { error: ReturnType<typeof vi.fn> } } = {}) {
    return createSheetImageService({
      applications: createApplicationRepository(db),
      printing: { ...createPrintingRepository(db), readingContextOf: () => Promise.resolve(PRINTED) },
      sheetImages: createSheetImageRepository(db),
      activityLog: createActivityLogRepository(db),
      fileStorage,
      readPhoto,
      logger: logger as unknown as Logger,
      ...(dailyLimits !== undefined && { dailyLimits }),
    })
  }

  it('holds the daily limit of photos per teacher, counted from what was stored', async () => {
    const service = serviceWith({ dailyLimits: { count: 2, bytes: 1024 * 1024 } })
    await service.upload('ana', 'app-ana', photo)
    await service.upload('ana', 'app-ana', photo)

    await expect(service.upload('ana', 'app-ana', photo)).rejects.toMatchObject({ status: 429, code: 'too-many-requests' })
  })

  it('holds the daily limit of bytes per teacher', async () => {
    const service = serviceWith({ dailyLimits: { count: 100, bytes: photo.length * 1.5 } })
    await service.upload('ana', 'app-ana', photo)

    await expect(service.upload('ana', 'app-ana', photo)).rejects.toMatchObject({ status: 429 })
  })

  /** The photo is stored before the reading, so a reader that breaks still leaves something the teacher grades by hand. */
  it('counts a broken reading as a photo with no QR Code recognized, and logs the cause', async () => {
    const logger = { error: vi.fn() }
    const service = serviceWith({ readPhoto: () => Promise.reject(new Error('decoder crashed')), logger })

    const reading = await service.upload('ana', 'app-ana', photo)

    expect(reading).toEqual({ imageId: expect.any(String) as string, status: 'QR_NOT_RECOGNIZED' })
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ imageId: reading.imageId }), 'The photo of a sheet could not be read')
    expect(await service.readFailures('ana', 'app-ana')).toEqual([expect.objectContaining({ imageId: reading.imageId })])
  })
})
