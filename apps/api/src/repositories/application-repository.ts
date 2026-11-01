import {
  CORRECTION_PROGRESS,
  CORRECTION_STATUS,
  type Application,
  type ApplicationProgress,
  type ApplicationStatus,
  type CorrectionProgress,
} from '@correctio/domain'
import type { Expression, ExpressionBuilder, Kysely, Selectable, SelectQueryBuilder, SqlBool } from 'kysely'
import { dayContains } from '../db/text-search'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { ApplicationsTable, Database } from '../models/tables'

/** The fields of `Application` in the contract; `createdAt` and `updatedAt` are technical and stay in the database. */
const APPLICATION_FIELDS = ['id', 'examId', 'classId', 'teacherId', 'status', 'pdfUrl', 'date', 'gradesReleased'] as const

/**
 * The same fields, named with their table: the list joins the exam and the
 * class, which have an `id`, a `teacherId` and a `status` of their own.
 */
const APPLICATION_COLUMNS = APPLICATION_FIELDS.map((field) => `applications.${field}` as const)

type ApplicationRow = Pick<Selectable<ApplicationsTable>, (typeof APPLICATION_FIELDS)[number]>

/** What MySQL answers for a `COUNT`, which the driver may hand over as text. */
type CountColumn = number | string | bigint | null

/** An application with the names and the counts its overview needs, as the query answers them. */
interface OverviewRow extends ApplicationRow {
  examTitle: string
  className: string
  versions: CountColumn
  publishedAnswerKeys: CountColumn
  sheets: CountColumn
  correctedSheets: CountColumn
  corrections: CountColumn
}

/** The status of an archived application (RF42); `draft` and `generated` are the active ones. */
const ARCHIVED: ApplicationStatus = 'closed'

/**
 * An application as stored. The `pdfUrl` column keeps the key of the PDF in
 * the file storage, not an address (`docs/adr/ADR-004`), so it travels here as
 * `pdfKey`; the service turns it into the address the API serves the file at,
 * and the key itself never reaches a client.
 */
export type StoredApplication = Omit<Application, 'pdfUrl'> & { pdfKey?: string }

/** An application as the screens read it (`ApplicationOverview`), with the key of its PDF still where `StoredApplication` keeps it. */
export type StoredOverview = StoredApplication & { examTitle: string; className: string; progress: ApplicationProgress }

/** The filters of P11, all optional, on top of the shared list parameters. */
export interface ApplicationFilters extends PageRequest {
  classId?: string
  examId?: string
  status?: ApplicationStatus
  /** Where the correction stands (`CORRECTION_PROGRESS`). */
  correction?: CorrectionProgress
}

/** Why the grades cannot be released, given whether each version's answer key is published; `undefined` when nothing blocks. */
export type ReleaseBlocker = (answerKeysPublished: readonly boolean[]) => string | undefined

/** What makes two applications the same sitting: the same exam, to the same class, on the same day. */
export type Sitting = Pick<Application, 'examId' | 'classId' | 'date'>

/** Another application of the same sitting, archived ones included. */
export interface ApplicationClash {
  id: string
  status: ApplicationStatus
}

/** What a write of a sitting is checked against, read under lock. */
export interface SittingState {
  clash?: ApplicationClash
  /** Whether versions were already printed for the application being changed; never for a new one. */
  printed: boolean
}

/** Why a sitting cannot be written, given its state under lock; `undefined` when nothing blocks. */
export type SittingBlocker = (state: SittingState) => string | undefined

/** An edit of the sitting: where the application ends up, and the columns the request carried. */
export interface SittingChange {
  sitting: Sitting
  /** Only these columns are written, so a field the request did not carry is never touched. */
  changes: Partial<Sitting>
}

export interface ApplicationRepository {
  /** Active or archived applications, searched by the day they happen, the most recent first, each with its overview. */
  list: (teacherId: string, filters: ApplicationFilters) => Promise<Page<StoredOverview>>
  findById: (teacherId: string, id: string) => Promise<StoredApplication | undefined>
  /** One application with its overview, in a single query, as the detail (P14) shows it. */
  findOverview: (teacherId: string, id: string) => Promise<StoredOverview | undefined>
  setStatus: (teacherId: string, id: string, status: ApplicationStatus) => Promise<void>
  /**
   * Releases the grades unless `blockerOf` names a reason, and answers that
   * reason. The answer keys are read and the grades written under the lock of
   * the application row, the same lock `PrintingRepository.takeBackAnswerKey`
   * takes first: a key taken back at the same moment waits, so the two can
   * never both pass and leave a grade without its key (RF46).
   */
  releaseGrades: (teacherId: string, id: string, blockerOf: ReleaseBlocker) => Promise<string | undefined>
  /** Takes the grades back, which RF46 always allows. */
  withdrawGrades: (teacherId: string, id: string) => Promise<void>
  /**
   * Stores a new application unless `blockerOf` names a reason, and answers
   * that reason. The other application of the same sitting is looked for under
   * the lock of the exam row, which every write of a sitting takes first, so
   * two requests for one sitting at the same moment, such as a double click,
   * cannot both pass.
   */
  insert: (application: StoredApplication, blockerOf: SittingBlocker) => Promise<string | undefined>
  /**
   * Writes the columns in `change.changes` unless `blockerOf` names a reason,
   * and answers that reason. Read under the lock of the application row, which
   * the generation takes too, and of the exam row, as `insert` does, so neither
   * a generation nor another request can slip in between the check and the
   * write.
   */
  changeSitting: (teacherId: string, id: string, change: SittingChange, blockerOf: SittingBlocker) => Promise<string | undefined>
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The day of a sitting, as the instants it covers. Dates are kept in UTC and
 * the form stores noon UTC of the day picked (`fromDateInputValue` in the web
 * app), so the UTC day is the day the teacher chose.
 */
function dayOf(iso: string): { start: Date; end: Date } {
  const instant = new Date(iso)
  const start = new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()))
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

/**
 * Takes the lock of the exam the sitting names, then looks for another
 * application of the same sitting. A second request for the same sitting
 * waits on that lock until the first has committed, and the read that
 * follows, under READ COMMITTED, already sees it.
 */
async function clashUnderLock(trx: Kysely<Database>, teacherId: string, sitting: Sitting, exceptId?: string): Promise<ApplicationClash | undefined> {
  await trx.selectFrom('exams').select('id').where('teacherId', '=', teacherId).where('id', '=', sitting.examId).forUpdate().execute()

  const { start, end } = dayOf(sitting.date)
  const sameSitting = trx
    .selectFrom('applications')
    .select(['id', 'status'])
    .where('teacherId', '=', teacherId)
    .where('examId', '=', sitting.examId)
    .where('classId', '=', sitting.classId)
    .where('date', '>=', start)
    .where('date', '<', end)
  return (exceptId === undefined ? sameSitting : sameSitting.where('id', '<>', exceptId)).executeTakeFirst()
}

/** The columns of a change, with the date as the instant the database stores. */
function columnsOf({ date, ...ids }: Partial<Sitting>) {
  return { ...ids, ...(date !== undefined && { date: new Date(date) }) }
}

function toStoredApplication(row: ApplicationRow): StoredApplication {
  return {
    id: row.id,
    examId: row.examId,
    classId: row.classId,
    teacherId: row.teacherId,
    status: row.status,
    date: row.date.toISOString(),
    gradesReleased: row.gradesReleased,
    ...(row.pdfUrl !== null && { pdfKey: row.pdfUrl }),
  }
}

function toStoredOverview(row: OverviewRow): StoredOverview {
  return {
    ...toStoredApplication(row),
    examTitle: row.examTitle,
    className: row.className,
    progress: {
      versions: Number(row.versions),
      publishedAnswerKeys: Number(row.publishedAnswerKeys),
      sheets: Number(row.sheets),
      correctedSheets: Number(row.correctedSheets),
      corrections: Number(row.corrections),
    },
  }
}

/** A query on the applications, before the overview joins their exam and class. */
type ApplicationScope = ExpressionBuilder<Database, 'applications'>

/** The corrections of the sheets of the application the outer query is on: a correction names its sheet, not its application. */
function correctionsOfEach(eb: ApplicationScope) {
  return eb
    .selectFrom('corrections')
    .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
    .whereRef('answer_sheets.applicationId', '=', 'applications.id')
}

const hasCorrection = (eb: ApplicationScope) => eb.exists(correctionsOfEach(eb).select('corrections.id'))

/** A correction still waiting for an open-ended score (RF48), which the panel counts as pending. */
const hasWaitingCorrection = (eb: ApplicationScope) =>
  eb.exists(correctionsOfEach(eb).where('corrections.status', '=', CORRECTION_STATUS.IN_PROGRESS).select('corrections.id'))

/** Each stage of `CorrectionProgress` as a condition on the application; its JSDoc says why `DONE` does not wait for every sheet. */
const IN_CORRECTION_STAGE: Readonly<Record<CorrectionProgress, (eb: ApplicationScope) => Expression<SqlBool>>> = {
  [CORRECTION_PROGRESS.NOT_STARTED]: (eb) => eb.not(hasCorrection(eb)),
  [CORRECTION_PROGRESS.IN_PROGRESS]: hasWaitingCorrection,
  [CORRECTION_PROGRESS.DONE]: (eb) => eb.and([hasCorrection(eb), eb.not(hasWaitingCorrection(eb))]),
}

/**
 * The counts of `ApplicationProgress`, each a subquery on the application of
 * the row. The sheets and versions are found by the index that starts with
 * `applicationId`, and a correction by the unique index of its sheet, so a
 * page costs one query however many applications it holds.
 */
function progressColumns(eb: ApplicationScope) {
  const versions = () => eb.selectFrom('exam_versions').whereRef('exam_versions.applicationId', '=', 'applications.id')
  const sheets = () => eb.selectFrom('answer_sheets').whereRef('answer_sheets.applicationId', '=', 'applications.id')
  return [
    versions()
      .select((sub) => sub.fn.countAll<number>().as('n'))
      .as('versions'),
    versions()
      .where('exam_versions.answerKeyPublished', '=', true)
      .select((sub) => sub.fn.countAll<number>().as('n'))
      .as('publishedAnswerKeys'),
    sheets()
      .select((sub) => sub.fn.countAll<number>().as('n'))
      .as('sheets'),
    correctionsOfEach(eb)
      .where('corrections.status', '=', CORRECTION_STATUS.DONE)
      .select((sub) => sub.fn.countAll<number>().as('n'))
      .as('correctedSheets'),
    correctionsOfEach(eb)
      .select((sub) => sub.fn.countAll<number>().as('n'))
      .as('corrections'),
  ]
}

/** The applications of `query` with their overview: the counts first, then the exam and the class, whose names are read even when archived. */
function overviewOf(query: SelectQueryBuilder<Database, 'applications', object>) {
  return query
    .select(APPLICATION_COLUMNS)
    .select(progressColumns)
    .innerJoin('exams', 'exams.id', 'applications.examId')
    .innerJoin('classes', 'classes.id', 'applications.classId')
    .select(['exams.title as examTitle', 'classes.name as className'])
}

/**
 * Every query is scoped by `teacherId` here, so no service can forget it: an
 * application of another teacher is simply not found (`docs/Seguranca_e_LGPD.md`,
 * section 2). The list is ordered by date because an application is an event,
 * and the one a teacher looks for is the one of a given day; the most recent
 * come first, so a new one never lands on a page nobody opens.
 */
export function createApplicationRepository(db: Kysely<Database>): ApplicationRepository {
  const owned = (teacherId: string) => db.selectFrom('applications').where('applications.teacherId', '=', teacherId)
  const ownedUpdate = (teacherId: string, id: string) =>
    db.updateTable('applications').where('teacherId', '=', teacherId).where('id', '=', id)

  /** Every filter applies before paging, so `total` counts what the filters let through. */
  function filtered(teacherId: string, { search, archived, classId, examId, status, correction }: ApplicationFilters) {
    let query = owned(teacherId).where('applications.status', archived ? '=' : '<>', ARCHIVED)
    if (classId !== undefined) query = query.where('applications.classId', '=', classId)
    if (examId !== undefined) query = query.where('applications.examId', '=', examId)
    if (status !== undefined) query = query.where('applications.status', '=', status)
    if (correction !== undefined) query = query.where(IN_CORRECTION_STAGE[correction])
    if (search !== '') query = query.where(dayContains('applications.date', search))
    return query
  }

  return {
    async list(teacherId, filters) {
      const query = filtered(teacherId, filters)
      const { total } = await query.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow(filters)
      const rows = await overviewOf(query)
        .orderBy('applications.date', 'desc')
        .orderBy('applications.id')
        .limit(limit)
        .offset(offset)
        .execute()
      return { items: rows.map(toStoredOverview), total: Number(total) }
    },

    async findById(teacherId, id) {
      const row = await owned(teacherId).select(APPLICATION_COLUMNS).where('applications.id', '=', id).executeTakeFirst()
      return row === undefined ? undefined : toStoredApplication(row)
    },

    async findOverview(teacherId, id) {
      const row = await overviewOf(owned(teacherId).where('applications.id', '=', id)).executeTakeFirst()
      return row === undefined ? undefined : toStoredOverview(row)
    },

    async setStatus(teacherId, id, status) {
      await ownedUpdate(teacherId, id).set({ status }).execute()
    },

    async releaseGrades(teacherId, id, blockerOf) {
      return db.transaction().execute(async (trx) => {
        await trx.selectFrom('applications').select('id').where('teacherId', '=', teacherId).where('id', '=', id).forUpdate().execute()
        const versions = await trx.selectFrom('exam_versions').select('answerKeyPublished').where('applicationId', '=', id).forShare().execute()

        const blocker = blockerOf(versions.map((version) => version.answerKeyPublished))
        if (blocker === undefined) {
          await trx.updateTable('applications').set({ gradesReleased: true }).where('teacherId', '=', teacherId).where('id', '=', id).execute()
        }
        return blocker
      })
    },

    async withdrawGrades(teacherId, id) {
      await ownedUpdate(teacherId, id).set({ gradesReleased: false }).execute()
    },

    async insert({ pdfKey, ...application }, blockerOf) {
      return db
        .transaction()
        .setIsolationLevel('read committed')
        .execute(async (trx) => {
          const blocker = blockerOf({ clash: await clashUnderLock(trx, application.teacherId, application), printed: false })
          if (blocker === undefined) {
            await trx
              .insertInto('applications')
              .values({ ...application, date: new Date(application.date), pdfUrl: pdfKey ?? null })
              .execute()
          }
          return blocker
        })
    },

    async changeSitting(teacherId, id, { sitting, changes }, blockerOf) {
      return db
        .transaction()
        .setIsolationLevel('read committed')
        .execute(async (trx) => {
          await trx.selectFrom('applications').select('id').where('teacherId', '=', teacherId).where('id', '=', id).forUpdate().execute()
          const printed = await trx.selectFrom('exam_versions').select('id').where('applicationId', '=', id).limit(1).executeTakeFirst()

          const blocker = blockerOf({ clash: await clashUnderLock(trx, teacherId, sitting, id), printed: printed !== undefined })
          if (blocker === undefined) {
            await trx.updateTable('applications').set(columnsOf(changes)).where('teacherId', '=', teacherId).where('id', '=', id).execute()
          }
          return blocker
        })
    },
  }
}
