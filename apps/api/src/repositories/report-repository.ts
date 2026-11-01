import {
  CORRECTION_STATUS,
  RECENT_ACTIVITY_LIMIT,
  type ApplicationReportSource,
  type ApplicationStatus,
  type ConsolidatedRowSource,
  type DashboardActivity,
  type ReportedCorrection,
  type ReportedQuestion,
} from '@correctio/domain'
import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

/** An archived application (RF42), which leaves the panel and the consolidated report as it leaves the lists. */
const ARCHIVED: ApplicationStatus = 'closed'

/** The only status with printed sheets to grade: a draft has none, and an archived one left the list. */
const GENERATED: ApplicationStatus = 'generated'

/** What MySQL answers for a `COUNT`, which the driver may hand over as text. */
type CountColumn = number | string | bigint

/** The counts of the panel (P1). */
export interface DashboardCounts {
  classes: number
  questions: number
  exams: number
  applications: number
  pendingCorrections: number
}

export interface ReportRepository {
  counts: (teacherId: string) => Promise<DashboardCounts>
  /** The active applications, the most recent day first and, on the same day, the one created last. */
  recentApplications: (teacherId: string, limit?: number) => Promise<DashboardActivity[]>
  /** The applications with printed sheets, the most recent day first. */
  gradableApplications: (teacherId: string) => Promise<DashboardActivity[]>
  /** Everything one application's report is made of; `undefined` when the application is not the teacher's. */
  applicationSource: (teacherId: string, applicationId: string) => Promise<ApplicationReportSource | undefined>
  /** One entry per active application, with the totals of its finished corrections. */
  consolidatedSources: (teacherId: string) => Promise<ConsolidatedRowSource[]>
}

async function totalOf(query: Promise<{ total: CountColumn }>): Promise<number> {
  return Number((await query).total)
}

/** Groups rows under the key `keyOf` gives each one, keeping their order. */
function groupBy<Row, Value>(rows: readonly Row[], keyOf: (row: Row) => string, valueOf: (row: Row) => Value): Map<string, Value[]> {
  const groups = new Map<string, Value[]>()
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), valueOf(row)])
  return groups
}

/**
 * The reports of P1, P18 and P19, read in a handful of queries for the whole
 * teacher instead of the 2N + 5 requests the browser made (#50).
 *
 * Exams, classes and questions are joined by id without filtering what was
 * archived or deleted: an exam archived after it was applied still names its
 * row, and a question deleted from the bank still counts in the accuracy of
 * its tag. Only the applications are filtered, because an archived
 * application has left the lists the panel and the reports summarise.
 */
export function createReportRepository(db: Kysely<Database>): ReportRepository {
  const activities = (teacherId: string) =>
    db
      .selectFrom('applications')
      .innerJoin('exams', 'exams.id', 'applications.examId')
      .innerJoin('classes', 'classes.id', 'applications.classId')
      .where('applications.teacherId', '=', teacherId)
      .select(['applications.id as id', 'exams.title as title', 'classes.name as detail', 'applications.date as date'])
      .orderBy('applications.date', 'desc')
      .orderBy('applications.createdAt', 'desc')

  const toActivity = ({ date, ...activity }: { id: string; title: string; detail: string; date: Date }): DashboardActivity => ({
    ...activity,
    date: date.toISOString(),
  })

  /**
   * Waiting for something from the teacher: an open-ended score (RF48) or the
   * student the sheet belongs to (RF31). One `OR`, so a correction that owes
   * both counts once: the panel counts sheets to deal with, not reasons.
   */
  const pendingCorrections = (teacherId: string) =>
    totalOf(
      db
        .selectFrom('corrections')
        .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
        .innerJoin('applications', 'applications.id', 'answer_sheets.applicationId')
        .where('applications.teacherId', '=', teacherId)
        .where('applications.status', '<>', ARCHIVED)
        .where((eb) => eb.or([eb('corrections.status', '=', CORRECTION_STATUS.IN_PROGRESS), eb('corrections.studentId', 'is', null)]))
        .select((eb) => eb.fn.countAll<CountColumn>().as('total'))
        .executeTakeFirstOrThrow(),
    )

  async function questionsOf(ids: readonly string[]): Promise<ReportedQuestion[]> {
    if (ids.length === 0) return []
    const [rows, tags, alternatives] = await Promise.all([
      db.selectFrom('questions').select(['id', 'type', 'statement']).where('id', 'in', ids).execute(),
      db.selectFrom('question_tags').select(['questionId', 'tag']).where('questionId', 'in', ids).orderBy('tag').execute(),
      db.selectFrom('question_alternatives').select(['questionId', 'id']).where('questionId', 'in', ids).orderBy('position').execute(),
    ])
    const tagsOf = groupBy(tags, (row) => row.questionId, (row) => row.tag)
    const alternativesOf = groupBy(alternatives, (row) => row.questionId, (row) => ({ id: row.id }))
    return rows.map((row) => ({ ...row, tags: tagsOf.get(row.id) ?? [], alternatives: alternativesOf.get(row.id) ?? [] }))
  }

  /** Every correction of the application with its results, in the order of the sheets. */
  async function correctionsOf(applicationId: string): Promise<ReportedCorrection[]> {
    const rows = await db
      .selectFrom('corrections')
      .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
      .where('answer_sheets.applicationId', '=', applicationId)
      .select(['corrections.id', 'corrections.answerSheetId', 'corrections.examVersionId', 'corrections.studentId', 'corrections.status', 'corrections.totalScore'])
      .orderBy('answer_sheets.sheetNumber')
      .execute()
    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    const [objectives, discursives] = await Promise.all([
      db.selectFrom('correction_objective_results').selectAll().where('correctionId', 'in', ids).execute(),
      db.selectFrom('correction_discursive_scores').selectAll().where('correctionId', 'in', ids).execute(),
    ])
    const objectivesOf = groupBy(objectives, (row) => row.correctionId, ({ questionId, correct, score, selectedAlternativeId }) => ({
      questionId,
      correct,
      score,
      ...(selectedAlternativeId !== null && { selectedAlternativeId }),
    }))
    const discursivesOf = groupBy(discursives, (row) => row.correctionId, ({ questionId, score }) => ({ questionId, score }))

    return rows.map(({ studentId, ...row }) => ({
      ...row,
      ...(studentId !== null && { studentId }),
      objectiveResults: objectivesOf.get(row.id) ?? [],
      discursiveScores: discursivesOf.get(row.id) ?? [],
    }))
  }

  return {
    async counts(teacherId) {
      const [classes, questions, exams, applications, pending] = await Promise.all([
        totalOf(db.selectFrom('classes').where('teacherId', '=', teacherId).where('status', '=', 'active').select((eb) => eb.fn.countAll<CountColumn>().as('total')).executeTakeFirstOrThrow()),
        totalOf(db.selectFrom('questions').where('teacherId', '=', teacherId).where('deletedAt', 'is', null).select((eb) => eb.fn.countAll<CountColumn>().as('total')).executeTakeFirstOrThrow()),
        totalOf(db.selectFrom('exams').where('teacherId', '=', teacherId).where('status', '<>', 'closed').select((eb) => eb.fn.countAll<CountColumn>().as('total')).executeTakeFirstOrThrow()),
        totalOf(db.selectFrom('applications').where('teacherId', '=', teacherId).where('status', '<>', ARCHIVED).select((eb) => eb.fn.countAll<CountColumn>().as('total')).executeTakeFirstOrThrow()),
        pendingCorrections(teacherId),
      ])
      return { classes, questions, exams, applications, pendingCorrections: pending }
    },

    async recentApplications(teacherId, limit = RECENT_ACTIVITY_LIMIT) {
      const rows = await activities(teacherId).where('applications.status', '<>', ARCHIVED).limit(limit).execute()
      return rows.map(toActivity)
    },

    async gradableApplications(teacherId) {
      const rows = await activities(teacherId).where('applications.status', '=', GENERATED).execute()
      return rows.map(toActivity)
    },

    async applicationSource(teacherId, applicationId) {
      const application = await db
        .selectFrom('applications')
        .innerJoin('exams', 'exams.id', 'applications.examId')
        .innerJoin('classes', 'classes.id', 'applications.classId')
        .where('applications.id', '=', applicationId)
        .where('applications.teacherId', '=', teacherId)
        .select(['applications.id', 'applications.date', 'applications.examId', 'applications.classId', 'exams.title as examTitle', 'classes.name as className'])
        .executeTakeFirst()
      if (application === undefined) return undefined

      const examQuestions = await db.selectFrom('exam_questions').select(['questionId', 'order', 'score']).where('examId', '=', application.examId).execute()
      const [questions, versions, sheets, students, corrections] = await Promise.all([
        questionsOf(examQuestions.map((entry) => entry.questionId)),
        db.selectFrom('exam_versions').select(['id', 'versionNumber']).where('applicationId', '=', applicationId).execute(),
        db.selectFrom('answer_sheets').select(['id', 'sheetNumber']).where('applicationId', '=', applicationId).execute(),
        db.selectFrom('students').select(['id', 'fullName', 'registration']).where('classId', '=', application.classId).execute(),
        correctionsOf(applicationId),
      ])

      return {
        application: { id: application.id, date: application.date.toISOString() },
        examTitle: application.examTitle,
        className: application.className,
        examQuestions,
        questions,
        versions,
        sheets,
        students,
        corrections,
      }
    },

    async consolidatedSources(teacherId) {
      const [applications, finished] = await Promise.all([
        db
          .selectFrom('applications')
          .innerJoin('exams', 'exams.id', 'applications.examId')
          .innerJoin('classes', 'classes.id', 'applications.classId')
          .where('applications.teacherId', '=', teacherId)
          .where('applications.status', '<>', ARCHIVED)
          .select(['applications.id', 'applications.date', 'exams.title as examTitle', 'classes.id as classId', 'classes.name', 'classes.subject', 'classes.term'])
          .execute(),
        db
          .selectFrom('corrections')
          .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
          .innerJoin('applications', 'applications.id', 'answer_sheets.applicationId')
          .where('applications.teacherId', '=', teacherId)
          .where('corrections.status', '=', CORRECTION_STATUS.DONE)
          .select(['answer_sheets.applicationId', 'corrections.totalScore'])
          .execute(),
      ])
      const scoresOf = groupBy(finished, (row) => row.applicationId, (row) => row.totalScore)

      return applications.map(({ id, date, examTitle, classId, name, subject, term }) => ({
        application: { id, date: date.toISOString() },
        examTitle,
        schoolClass: { id: classId, name, subject, term },
        scores: scoresOf.get(id) ?? [],
      }))
    },
  }
}
