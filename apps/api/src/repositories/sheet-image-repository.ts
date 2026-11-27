import type { SheetReadingStatus } from '@correctio/domain'
import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

/** A photo of a sheet as kept: where the file is and how its reading ended. */
export interface StoredSheetImage {
  id: string
  applicationId: string
  teacherId: string
  storageKey: string
  contentType: string
  byteSize: number
  status: SheetReadingStatus
  answerSheetId?: string
}

/** How much a teacher sent since a moment, to hold the daily limit of uploads. */
export interface UploadUsage {
  count: number
  bytes: number
}

export interface SheetImageRepository {
  insert: (image: StoredSheetImage) => Promise<void>
  /** One photo, looked for inside its application, so the id of another application's photo finds nothing. */
  find: (applicationId: string, id: string) => Promise<StoredSheetImage | undefined>
  usageSince: (teacherId: string, since: Date) => Promise<UploadUsage>
  /**
   * Where the photos of a student's sheets are stored: the sheets printed for
   * the student and the ones a correction gave to the student. The photo shows
   * the student's handwriting and may carry the name, so anonymization erases
   * these files (RF38).
   */
  storageKeysOfStudent: (studentId: string) => Promise<string[]>
}

/** The photos of the sheets sent for correction (#47), scoped by application as the corrections are. */
export function createSheetImageRepository(db: Kysely<Database>): SheetImageRepository {
  return {
    async insert({ answerSheetId, ...image }) {
      await db
        .insertInto('sheet_images')
        .values({ ...image, answerSheetId: answerSheetId ?? null })
        .execute()
    },

    async find(applicationId, id) {
      const row = await db
        .selectFrom('sheet_images')
        .select(['id', 'applicationId', 'teacherId', 'storageKey', 'contentType', 'byteSize', 'status', 'answerSheetId'])
        .where('applicationId', '=', applicationId)
        .where('id', '=', id)
        .executeTakeFirst()
      if (row === undefined) return undefined
      const { answerSheetId, ...image } = row
      return answerSheetId === null ? image : { ...image, answerSheetId }
    },

    async usageSince(teacherId, since) {
      const row = await db
        .selectFrom('sheet_images')
        .select((eb) => [eb.fn.countAll<number>().as('count'), eb.fn.sum<number | null>('byteSize').as('bytes')])
        .where('teacherId', '=', teacherId)
        .where('createdAt', '>=', since)
        .executeTakeFirstOrThrow()
      return { count: Number(row.count), bytes: Number(row.bytes ?? 0) }
    },

    async storageKeysOfStudent(studentId) {
      const rows = await db
        .selectFrom('sheet_images')
        .select('storageKey')
        .where((eb) =>
          eb.or([
            eb('answerSheetId', 'in', eb.selectFrom('answer_sheets').select('id').where('studentId', '=', studentId)),
            eb('answerSheetId', 'in', eb.selectFrom('corrections').select('answerSheetId').where('studentId', '=', studentId)),
          ]),
        )
        .execute()
      return rows.map((row) => row.storageKey)
    },
  }
}
