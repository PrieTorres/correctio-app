import type { GradedExam, GradedQuestion } from '@correctio/domain'
import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

/** A question as a correction is checked against: also the alternatives it offers and what an open-ended one is worth. */
export interface GradingQuestion extends GradedQuestion {
  alternativeIds: ReadonlySet<string>
  maxScore?: number
}

/** The exam a sheet is graded against, and its questions. */
export interface GradingExam {
  exam: GradedExam
  questions: GradingQuestion[]
}

export interface GradingRepository {
  /**
   * The exam as it was printed, with every question it carries, including one
   * deleted from the bank since: the sheet still has it, so the correction
   * does too.
   */
  examOf: (examId: string) => Promise<GradingExam>
  /** Whether the student is in the class; a student of another class is never graded on this application. */
  isStudentOf: (classId: string, studentId: string) => Promise<boolean>
}

/** Groups the alternatives of each question, which the correction checks a marked one against. */
function alternativesByQuestion(rows: readonly { questionId: string; id: string }[]): Map<string, Set<string>> {
  const byQuestion = new Map<string, Set<string>>()
  for (const { questionId, id } of rows) byQuestion.set(questionId, (byQuestion.get(questionId) ?? new Set()).add(id))
  return byQuestion
}

/**
 * What grading reads from the bank and the exam. The questions are looked up
 * without filtering `deletedAt`: a question removed from the bank after the
 * exam was printed is still on the paper, and leaving it out would make it
 * vanish from the correction.
 */
export function createGradingRepository(db: Kysely<Database>): GradingRepository {
  return {
    async examOf(examId) {
      const entries = await db
        .selectFrom('exam_questions')
        .select(['questionId', 'order', 'score'])
        .where('examId', '=', examId)
        .orderBy('order')
        .execute()
      if (entries.length === 0) return { exam: { questions: [] }, questions: [] }

      const ids = entries.map((entry) => entry.questionId)
      const [rows, alternatives] = await Promise.all([
        db.selectFrom('questions').select(['id', 'type', 'correctAlternativeId', 'maxScore']).where('id', 'in', ids).execute(),
        db.selectFrom('question_alternatives').select(['questionId', 'id']).where('questionId', 'in', ids).execute(),
      ])
      const byQuestion = alternativesByQuestion(alternatives)

      const questions = rows.map((row): GradingQuestion => ({
        id: row.id,
        type: row.type,
        alternativeIds: byQuestion.get(row.id) ?? new Set(),
        ...(row.correctAlternativeId !== null && { correctAlternativeId: row.correctAlternativeId }),
        ...(row.maxScore !== null && { maxScore: row.maxScore }),
      }))
      return { exam: { questions: entries }, questions }
    },

    async isStudentOf(classId, studentId) {
      const row = await db.selectFrom('students').select('id').where('id', '=', studentId).where('classId', '=', classId).executeTakeFirst()
      return row !== undefined
    },
  }
}
