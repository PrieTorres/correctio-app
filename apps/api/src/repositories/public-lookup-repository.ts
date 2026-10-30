import type { LookupSources, ObjectiveResult } from '@correctio/domain'
import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

export interface PublicLookupRepository {
  /** What the public lookup reads for one printed code, with `null` where the chain breaks. */
  findSources: (code: string) => Promise<LookupSources>
}

const NOTHING_FOUND: LookupSources = {
  sheet: null,
  version: null,
  application: null,
  exam: null,
  group: null,
  student: null,
  correction: null,
  bank: [],
}

/**
 * The one reader with no teacher to scope by: the printed code is the whole
 * credential. It selects only the columns `resolvePublicLookup` needs, so the
 * registration, the e-mail and the other students of the class are never
 * loaded on this path, let alone answered.
 *
 * Questions are read by the ids printed in the version's layout, deleted ones
 * included: the student holds the paper as it was printed, and a question the
 * teacher deleted afterwards is still on it.
 */
export function createPublicLookupRepository(db: Kysely<Database>): PublicLookupRepository {
  const findObjectiveResults = async (correctionId: string): Promise<ObjectiveResult[]> => {
    const rows = await db
      .selectFrom('correction_objective_results')
      .select(['questionId', 'correct', 'score', 'selectedAlternativeId'])
      .where('correctionId', '=', correctionId)
      .execute()
    return rows.map(({ selectedAlternativeId, ...result }) =>
      selectedAlternativeId === null ? result : { ...result, selectedAlternativeId },
    )
  }

  const findBank = async (questionIds: readonly string[]): Promise<LookupSources['bank']> => {
    if (questionIds.length === 0) return []
    const rows = await db.selectFrom('questions').select(['id', 'correctAlternativeId']).where('id', 'in', questionIds).execute()
    return rows.map(({ id, correctAlternativeId }) => (correctAlternativeId === null ? { id } : { id, correctAlternativeId }))
  }

  /**
   * The correction of the sheet, and the student it names: on an exam without
   * identification the sheet has no student, and the teacher assigns one when
   * correcting.
   */
  const findCorrection = async (answerSheetId: string) => {
    const row = await db
      .selectFrom('corrections')
      .select(['id', 'studentId', 'totalScore', 'status'])
      .where('answerSheetId', '=', answerSheetId)
      .executeTakeFirst()
    if (row === undefined) return { studentId: null, correction: null }
    return { studentId: row.studentId, correction: { totalScore: row.totalScore, status: row.status, objectiveResults: await findObjectiveResults(row.id) } }
  }

  /** A removed student is not named to whoever holds the paper; the page falls back to the sheet number. */
  const findStudent = async (studentId: string | null, classId: string): Promise<LookupSources['student']> => {
    if (studentId === null) return null
    const row = await db
      .selectFrom('students')
      .select('fullName')
      .where('id', '=', studentId)
      .where('classId', '=', classId)
      .where('removedAt', 'is', null)
      .executeTakeFirst()
    return row ?? null
  }

  return {
    async findSources(code) {
      const sheet = await db
        .selectFrom('answer_sheets')
        .select(['id', 'applicationId', 'examVersionId', 'studentId', 'sheetNumber'])
        .where('code', '=', code)
        .executeTakeFirst()
      if (sheet === undefined) return NOTHING_FOUND

      const [version, application, graded] = await Promise.all([
        db
          .selectFrom('exam_versions')
          .select(['versionNumber', 'withStudentIdentification', 'answerKeyPublished', 'layout'])
          .where('id', '=', sheet.examVersionId)
          .executeTakeFirst(),
        db
          .selectFrom('applications')
          .select(['examId', 'classId', 'date', 'gradesReleased', 'status'])
          .where('id', '=', sheet.applicationId)
          .executeTakeFirst(),
        findCorrection(sheet.id),
      ])
      if (version === undefined || application === undefined) return NOTHING_FOUND

      const [exam, group, student, bank] = await Promise.all([
        db.selectFrom('exams').select('title').where('id', '=', application.examId).executeTakeFirst(),
        db.selectFrom('classes').select(['name', 'subject']).where('id', '=', application.classId).executeTakeFirst(),
        findStudent(sheet.studentId ?? graded.studentId, application.classId),
        findBank(version.layout.questionOrder),
      ])

      return {
        sheet,
        version,
        application: { date: application.date.toISOString(), gradesReleased: application.gradesReleased, status: application.status },
        exam: exam ?? null,
        group: group ?? null,
        student,
        correction: graded.correction,
        bank,
      }
    },
  }
}
