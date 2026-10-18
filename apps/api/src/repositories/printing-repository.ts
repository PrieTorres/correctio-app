import type { AnswerSheet, ExamVersion } from '@correctio/domain'
import type { Kysely, Selectable } from 'kysely'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { AnswerSheetsTable, Database, ExamVersionsTable } from '../models/tables'

const VERSION_COLUMNS = [
  'id',
  'applicationId',
  'versionNumber',
  'shuffleQuestions',
  'shuffleAlternatives',
  'withStudentIdentification',
  'layout',
  'answerKeyPublished',
  'answerKeyPublishedAt',
  'publicCode',
  'qrCodePayload',
] as const

const SHEET_COLUMNS = ['id', 'applicationId', 'examVersionId', 'studentId', 'sheetNumber', 'code'] as const

type VersionRow = Pick<Selectable<ExamVersionsTable>, (typeof VERSION_COLUMNS)[number]>
type SheetRow = Pick<Selectable<AnswerSheetsTable>, (typeof SHEET_COLUMNS)[number]>

type PageWindowRequest = Pick<PageRequest, 'page' | 'pageSize'>

export interface PrintingRepository {
  /** The versions of an application, by `versionNumber`. */
  listVersions: (applicationId: string, request: PageWindowRequest) => Promise<Page<ExamVersion>>
  findVersion: (applicationId: string, versionId: string) => Promise<ExamVersion | undefined>
  /** One entry per version of the application: whether its answer key is published. */
  answerKeysPublished: (applicationId: string) => Promise<boolean[]>
  /** `null` takes the answer key back; a date publishes it, as of that moment. */
  setAnswerKeyPublished: (applicationId: string, versionId: string, publishedAt: Date | null) => Promise<void>
  /** The sheets of an application, by `sheetNumber`. */
  listSheets: (applicationId: string, request: PageWindowRequest) => Promise<Page<AnswerSheet>>
}

function toVersion(row: VersionRow): ExamVersion {
  return {
    id: row.id,
    applicationId: row.applicationId,
    versionNumber: row.versionNumber,
    shuffleQuestions: row.shuffleQuestions,
    shuffleAlternatives: row.shuffleAlternatives,
    withStudentIdentification: row.withStudentIdentification,
    layout: row.layout,
    answerKeyPublished: row.answerKeyPublished,
    ...(row.answerKeyPublishedAt !== null && { answerKeyPublishedAt: row.answerKeyPublishedAt.toISOString() }),
    publicCode: row.publicCode,
    qrCodePayload: row.qrCodePayload,
  }
}

function toSheet(row: SheetRow): AnswerSheet {
  return {
    id: row.id,
    applicationId: row.applicationId,
    examVersionId: row.examVersionId,
    ...(row.studentId !== null && { studentId: row.studentId }),
    sheetNumber: row.sheetNumber,
    code: row.code,
  }
}

/**
 * The printed side of an application: its versions and the sheets handed out.
 * Both belong to an application rather than to a teacher, so this repository
 * scopes by application, and the service checks first that the application is
 * the teacher's, as the students do with their class.
 */
export function createPrintingRepository(db: Kysely<Database>): PrintingRepository {
  const versionsOf = (applicationId: string) => db.selectFrom('exam_versions').where('applicationId', '=', applicationId)
  const sheetsOf = (applicationId: string) => db.selectFrom('answer_sheets').where('applicationId', '=', applicationId)

  return {
    async listVersions(applicationId, request) {
      const { total } = await versionsOf(applicationId).select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow(request)
      const rows = await versionsOf(applicationId).select(VERSION_COLUMNS).orderBy('versionNumber').limit(limit).offset(offset).execute()
      return { items: rows.map(toVersion), total: Number(total) }
    },

    async findVersion(applicationId, versionId) {
      const row = await versionsOf(applicationId).select(VERSION_COLUMNS).where('id', '=', versionId).executeTakeFirst()
      return row === undefined ? undefined : toVersion(row)
    },

    async answerKeysPublished(applicationId) {
      const rows = await versionsOf(applicationId).select('answerKeyPublished').execute()
      return rows.map((row) => row.answerKeyPublished)
    },

    async setAnswerKeyPublished(applicationId, versionId, publishedAt) {
      await db
        .updateTable('exam_versions')
        .set({ answerKeyPublished: publishedAt !== null, answerKeyPublishedAt: publishedAt })
        .where('applicationId', '=', applicationId)
        .where('id', '=', versionId)
        .execute()
    },

    async listSheets(applicationId, request) {
      const { total } = await sheetsOf(applicationId).select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow(request)
      const rows = await sheetsOf(applicationId).select(SHEET_COLUMNS).orderBy('sheetNumber').limit(limit).offset(offset).execute()
      return { items: rows.map(toSheet), total: Number(total) }
    },
  }
}
