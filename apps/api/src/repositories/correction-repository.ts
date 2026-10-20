import type { Correction, CorrectionStatus, DiscursiveScore, ObjectiveResult } from '@correctio/domain'
import type { Insertable, Kysely, Selectable } from 'kysely'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { CorrectionsTable, Database } from '../models/tables'

/** The unique indexes of `corrections`, named after their column, which the service turns into a 409. */
export const CORRECTION_INDEX = Object.freeze({
  /** One correction per sheet: a second one is an edit, through `PATCH`. */
  SHEET: 'answerSheetId',
  /** The app's deduplication key: the same correction sent twice is stored once. */
  CLIENT_ID: 'clientCorrectionId',
} as const)

const CORRECTION_COLUMNS = [
  'corrections.id',
  'corrections.examVersionId',
  'corrections.studentId',
  'corrections.reportedStudentName',
  'corrections.reportedStudentRegistration',
  'corrections.totalScore',
  'corrections.notes',
  'corrections.confirmedAt',
  'corrections.correctedBy',
  'corrections.isAutomaticallyAssigned',
  'corrections.clientCorrectionId',
  'corrections.syncStatus',
  'corrections.answerSheetId',
  'corrections.source',
  'corrections.status',
  'corrections.imageUrl',
] as const

type CorrectionRow = Omit<Selectable<CorrectionsTable>, 'createdAt' | 'updatedAt'>

/** The filters of P15 and P17, on top of the page. */
export interface CorrectionFilters extends Pick<PageRequest, 'page' | 'pageSize'> {
  /** `false` lists only the corrections still waiting for a student (P17); `true`, only the assigned ones. */
  assigned?: boolean
  status?: CorrectionStatus
}

export interface CorrectionRepository {
  /** The corrections of an application, in the order of the sheets. */
  list: (applicationId: string, filters: CorrectionFilters) => Promise<Page<Correction>>
  findById: (applicationId: string, id: string) => Promise<Correction | undefined>
  /** The correction already made for the student on the version, other than `exceptId`, if any. */
  findStudentIn: (examVersionId: string, studentId: string, exceptId?: string) => Promise<string | undefined>
  create: (correction: Correction) => Promise<void>
  /** Replaces the stored correction with `correction`, which the service already merged with it. */
  update: (correction: Correction) => Promise<void>
}

function optionalFields(row: CorrectionRow): Partial<Correction> {
  return {
    ...(row.studentId !== null && { studentId: row.studentId }),
    ...(row.reportedStudentName !== null && { reportedStudentName: row.reportedStudentName }),
    ...(row.reportedStudentRegistration !== null && { reportedStudentRegistration: row.reportedStudentRegistration }),
    ...(row.notes !== null && { notes: row.notes }),
    ...(row.imageUrl !== null && { imageUrl: row.imageUrl }),
  }
}

function toCorrection(row: CorrectionRow, objectiveResults: ObjectiveResult[], discursiveScores: DiscursiveScore[]): Correction {
  return {
    id: row.id,
    examVersionId: row.examVersionId,
    objectiveResults,
    discursiveScores,
    totalScore: row.totalScore,
    confirmedAt: row.confirmedAt.toISOString(),
    correctedBy: row.correctedBy,
    isAutomaticallyAssigned: row.isAutomaticallyAssigned,
    clientCorrectionId: row.clientCorrectionId,
    syncStatus: row.syncStatus,
    answerSheetId: row.answerSheetId,
    source: row.source,
    status: row.status,
    ...optionalFields(row),
  }
}

/** The parent row of a correction; the results live in their own tables. */
function toRow(correction: Correction): Insertable<CorrectionsTable> {
  return {
    id: correction.id,
    examVersionId: correction.examVersionId,
    studentId: correction.studentId ?? null,
    reportedStudentName: correction.reportedStudentName ?? null,
    reportedStudentRegistration: correction.reportedStudentRegistration ?? null,
    totalScore: correction.totalScore,
    notes: correction.notes ?? null,
    confirmedAt: new Date(correction.confirmedAt),
    correctedBy: correction.correctedBy,
    isAutomaticallyAssigned: correction.isAutomaticallyAssigned,
    clientCorrectionId: correction.clientCorrectionId,
    syncStatus: correction.syncStatus,
    answerSheetId: correction.answerSheetId,
    source: correction.source,
    status: correction.status,
    imageUrl: correction.imageUrl ?? null,
  }
}

function groupBy<Item extends { correctionId: string }>(rows: readonly Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>()
  for (const row of rows) groups.set(row.correctionId, [...(groups.get(row.correctionId) ?? []), row])
  return groups
}

/**
 * Corrections hang from an answer sheet, and the sheet from an application, so
 * every read goes through `answer_sheets.applicationId`: a correction of
 * another application is simply not found. The service has already checked
 * the application is the teacher's.
 */
export function createCorrectionRepository(db: Kysely<Database>): CorrectionRepository {
  const ofApplication = (applicationId: string) =>
    db
      .selectFrom('corrections')
      .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
      .where('answer_sheets.applicationId', '=', applicationId)

  /** The results of each correction, read in two queries for the whole page. */
  async function withResults(rows: readonly CorrectionRow[]): Promise<Correction[]> {
    if (rows.length === 0) return []
    const ids = rows.map((row) => row.id)
    const [objectives, discursives] = await Promise.all([
      db.selectFrom('correction_objective_results').selectAll().where('correctionId', 'in', ids).execute(),
      db.selectFrom('correction_discursive_scores').selectAll().where('correctionId', 'in', ids).execute(),
    ])
    const objectivesOf = groupBy(objectives)
    const discursivesOf = groupBy(discursives)

    return rows.map((row) =>
      toCorrection(
        row,
        (objectivesOf.get(row.id) ?? []).map(({ questionId, correct, score, selectedAlternativeId }) => ({
          questionId,
          correct,
          score,
          ...(selectedAlternativeId !== null && { selectedAlternativeId }),
        })),
        (discursivesOf.get(row.id) ?? []).map(({ questionId, score }) => ({ questionId, score })),
      ),
    )
  }

  /** Writes the results of a correction; the parent row must already exist. */
  async function insertResults(executor: Kysely<Database>, correction: Correction): Promise<void> {
    const correctionId = correction.id
    if (correction.objectiveResults.length > 0) {
      await executor
        .insertInto('correction_objective_results')
        .values(correction.objectiveResults.map((result) => ({ correctionId, ...result, selectedAlternativeId: result.selectedAlternativeId ?? null })))
        .execute()
    }
    if (correction.discursiveScores.length > 0) {
      await executor
        .insertInto('correction_discursive_scores')
        .values(correction.discursiveScores.map((entry) => ({ correctionId, ...entry })))
        .execute()
    }
  }

  return {
    async list(applicationId, { assigned, status, ...page }) {
      let query = ofApplication(applicationId)
      if (assigned !== undefined) query = query.where('corrections.studentId', assigned ? 'is not' : 'is', null)
      if (status !== undefined) query = query.where('corrections.status', '=', status)

      const { total } = await query.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow(page)
      const rows = await query.select(CORRECTION_COLUMNS).orderBy('answer_sheets.sheetNumber').limit(limit).offset(offset).execute()
      return { items: await withResults(rows), total: Number(total) }
    },

    async findById(applicationId, id) {
      const row = await ofApplication(applicationId).select(CORRECTION_COLUMNS).where('corrections.id', '=', id).executeTakeFirst()
      if (row === undefined) return undefined
      const [correction] = await withResults([row])
      return correction
    },

    async findStudentIn(examVersionId, studentId, exceptId) {
      let query = db.selectFrom('corrections').select('id').where('examVersionId', '=', examVersionId).where('studentId', '=', studentId)
      if (exceptId !== undefined) query = query.where('id', '<>', exceptId)
      const row = await query.executeTakeFirst()
      return row?.id
    },

    async create(correction) {
      await db.transaction().execute(async (trx) => {
        await trx.insertInto('corrections').values(toRow(correction)).execute()
        await insertResults(trx, correction)
      })
    },

    async update(correction) {
      await db.transaction().execute(async (trx) => {
        const { id, ...changes } = toRow(correction)
        await trx.updateTable('corrections').set(changes).where('id', '=', id).execute()
        await trx.deleteFrom('correction_objective_results').where('correctionId', '=', id).execute()
        await trx.deleteFrom('correction_discursive_scores').where('correctionId', '=', id).execute()
        await insertResults(trx, correction)
      })
    },
  }
}
