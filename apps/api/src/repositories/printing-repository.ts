import type { AnswerSheet, Application, ExamVersion } from '@correctio/domain'
import type { Insertable, Kysely, Selectable } from 'kysely'
import { byText } from '../db/text-search'
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

const SHEET_COLUMNS = ['id', 'applicationId', 'examVersionId', 'studentId', 'sheetNumber', 'code', 'answerCardVersion'] as const

type VersionRow = Pick<Selectable<ExamVersionsTable>, (typeof VERSION_COLUMNS)[number]>
type SheetRow = Pick<Selectable<AnswerSheetsTable>, (typeof SHEET_COLUMNS)[number]>

type PageWindowRequest = Pick<PageRequest, 'page' | 'pageSize'>

/** A student who gets a sheet, with what the cover prints when the application identifies the students. */
export interface SheetHolder {
  id: string
  fullName: string
  registration: string
}

/** What a generation is checked against, read under the lock of the application. */
export interface GenerationState {
  application: Pick<Application, 'status' | 'gradesReleased'>
  corrections: readonly { id: string }[]
}

/** Why a generation cannot replace the paper, given its state under lock; `undefined` when nothing blocks. */
export type GenerationBlocker = (state: GenerationState) => string | undefined

/** What one generation writes: the versions and sheets that replace the printed ones, and where their PDF was stored. */
export interface NewPaper {
  versions: readonly ExamVersion[]
  sheets: readonly AnswerSheet[]
  pdfKey: string
}

/** How replacing the paper ended: refused for a reason, or done, with the key of the PDF it replaced, if any. */
export type PaperSwap = { kind: 'REFUSED'; reason: string } | { kind: 'REPLACED'; previousPdfKey?: string }

export interface PrintingRepository {
  /** The versions of an application, by `versionNumber`. */
  listVersions: (applicationId: string, request: PageWindowRequest) => Promise<Page<ExamVersion>>
  findVersion: (applicationId: string, versionId: string) => Promise<ExamVersion | undefined>
  /** Publishes the answer key of the version as of `publishedAt`; publishing never conflicts with released grades. */
  publishAnswerKey: (applicationId: string, versionId: string, publishedAt: Date) => Promise<void>
  /**
   * Takes the answer key back unless the grades are released, and answers
   * whether it did. Checked and written under the lock of the application row,
   * which `ApplicationRepository.releaseGrades` also takes first, so a release
   * at the same moment waits instead of passing on a key about to go (RF46).
   */
  takeBackAnswerKey: (applicationId: string, versionId: string) => Promise<boolean>
  /** The sheets of an application, by `sheetNumber`. */
  listSheets: (applicationId: string, request: PageWindowRequest) => Promise<Page<AnswerSheet>>
  /** One sheet, looked for inside its application, so the id of another application's sheet finds nothing. */
  findSheet: (applicationId: string, sheetId: string) => Promise<AnswerSheet | undefined>
  /**
   * The students of a class who get a sheet, by name, all at once: the ones
   * still in the class (#41) whose data was not anonymized, since a sheet for
   * "Aluno anonimizado" would serve nobody.
   */
  sheetHolders: (classId: string) => Promise<SheetHolder[]>
  /** The corrections already made from the sheets of an application, which keep it from being printed again (RF24). */
  correctionsOf: (applicationId: string) => Promise<{ id: string }[]>
  /**
   * Replaces the versions and sheets of an application with `paper`, marks it
   * `generated` and points `pdfUrl` at the new PDF, unless `blockerOf` names a
   * reason, all in one transaction. The application row is locked first, as
   * the release of grades does, and then its sheets: a correction of one of
   * them made at the same moment waits instead of pointing at a sheet about to
   * go, and every correction already made is seen before anything is deleted.
   */
  replacePaper: (applicationId: string, paper: NewPaper, blockerOf: GenerationBlocker) => Promise<PaperSwap>
}

function versionRow(version: ExamVersion): Insertable<ExamVersionsTable> {
  return { ...version, layout: JSON.stringify(version.layout) }
}

function sheetRow({ studentId, ...sheet }: AnswerSheet): Insertable<AnswerSheetsTable> {
  return { ...sheet, studentId: studentId ?? null }
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
    answerCardVersion: row.answerCardVersion,
  }
}

/** One version, always looked for inside its application, so a version id of another application changes nothing. */
function versionUpdate(db: Kysely<Database>, applicationId: string, versionId: string) {
  return db.updateTable('exam_versions').where('applicationId', '=', applicationId).where('id', '=', versionId)
}

/**
 * The printed side of an application: its versions and the sheets handed out,
 * and, for a generation, who gets a sheet and which sheets were corrected.
 * All of it belongs to an application rather than to a teacher, so this
 * repository scopes by application, or by the class of one, and the service
 * checks first that the application is the teacher's, as the students do with
 * their class.
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

    async publishAnswerKey(applicationId, versionId, publishedAt) {
      await versionUpdate(db, applicationId, versionId).set({ answerKeyPublished: true, answerKeyPublishedAt: publishedAt }).execute()
    },

    async takeBackAnswerKey(applicationId, versionId) {
      return db.transaction().execute(async (trx) => {
        const application = await trx
          .selectFrom('applications')
          .select('gradesReleased')
          .where('id', '=', applicationId)
          .forUpdate()
          .executeTakeFirst()
        if (application === undefined || application.gradesReleased) return false

        await versionUpdate(trx, applicationId, versionId).set({ answerKeyPublished: false, answerKeyPublishedAt: null }).execute()
        return true
      })
    },

    async findSheet(applicationId, sheetId) {
      const row = await sheetsOf(applicationId).select(SHEET_COLUMNS).where('id', '=', sheetId).executeTakeFirst()
      return row === undefined ? undefined : toSheet(row)
    },

    async listSheets(applicationId, request) {
      const { total } = await sheetsOf(applicationId).select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow(request)
      const rows = await sheetsOf(applicationId).select(SHEET_COLUMNS).orderBy('sheetNumber').limit(limit).offset(offset).execute()
      return { items: rows.map(toSheet), total: Number(total) }
    },

    sheetHolders: (classId) =>
      db
        .selectFrom('students')
        .select(['id', 'fullName', 'registration'])
        .where('classId', '=', classId)
        .where('removedAt', 'is', null)
        .where('anonymizedAt', 'is', null)
        .orderBy(byText('fullName'))
        .orderBy('id')
        .execute(),

    correctionsOf: (applicationId) =>
      db
        .selectFrom('corrections')
        .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
        .select('corrections.id')
        .where('answer_sheets.applicationId', '=', applicationId)
        .execute(),

    async replacePaper(applicationId, { versions, sheets, pdfKey }, blockerOf) {
      return db
        .transaction()
        .setIsolationLevel('read committed')
        .execute(async (trx): Promise<PaperSwap> => {
          const application = await trx
            .selectFrom('applications')
            .select(['status', 'gradesReleased', 'pdfUrl'])
            .where('id', '=', applicationId)
            .forUpdate()
            .executeTakeFirstOrThrow()
          await trx.selectFrom('answer_sheets').select('id').where('applicationId', '=', applicationId).forUpdate().execute()
          const corrections = await createPrintingRepository(trx).correctionsOf(applicationId)

          const reason = blockerOf({ application, corrections })
          if (reason !== undefined) return { kind: 'REFUSED', reason }

          await trx.deleteFrom('answer_sheets').where('applicationId', '=', applicationId).execute()
          await trx.deleteFrom('exam_versions').where('applicationId', '=', applicationId).execute()
          if (versions.length > 0) await trx.insertInto('exam_versions').values(versions.map(versionRow)).execute()
          if (sheets.length > 0) await trx.insertInto('answer_sheets').values(sheets.map(sheetRow)).execute()
          await trx.updateTable('applications').set({ status: 'generated', pdfUrl: pdfKey }).where('id', '=', applicationId).execute()
          return { kind: 'REPLACED', ...(application.pdfUrl !== null && { previousPdfKey: application.pdfUrl }) }
        })
    },
  }
}
