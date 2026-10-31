import { z } from 'zod'
import { ANSWER_CARD, columnLetter } from './answer-card'
import {
  CORRECTION_STATUS,
  type AnswerSheet,
  type Class,
  type Correction,
  type ExamQuestion,
  type ExamVersion,
  type ObjectiveResult,
  type Question,
  type QuestionType,
  type Student,
} from './domain'
import { totalScore } from './exam-score'
import { accuracyByTag, accuracyOf, distribute, summarise, type Distribution, type ScoreSummary, type TagAccuracy } from './statistics'

/**
 * The reports of P1, P18 and P19 (RF34, RF35), calculated by the API (#50) and,
 * in the demo, by this browser, with the same functions: two places that
 * calculate the same number are two places to be wrong.
 */

/**
 * The formats a report is exported in (RF36), written as the Spec writes
 * `?format=csv|xlsx|pdf`, which is why they are lower case.
 */
export const REPORT_FORMAT = Object.freeze({ XLSX: 'xlsx', CSV: 'csv', PDF: 'pdf' } as const)

export type ReportFormat = (typeof REPORT_FORMAT)[keyof typeof REPORT_FORMAT]

/** How many applications "Atividade recente" lists on the panel (P1). */
export const RECENT_ACTIVITY_LIMIT = 5

/** One application as the panel names it: the exam it applied, to which class, on which day. */
export interface DashboardActivity {
  id: string
  title: string
  detail: string
  date: string
}

/** What the panel (P1) shows at a glance. */
export interface DashboardSummary {
  /** Active classes; an archived one is out of the term's numbers. */
  classes: number
  questions: number
  exams: number
  applications: number
  /** Corrections waiting for an open-ended score (RF48) or for a student (RF31), counted once each. */
  pendingCorrections: number
  /** The most recent applications by the day they happen, at most `RECENT_ACTIVITY_LIMIT`. */
  recent: DashboardActivity[]
  /** What "Corrigir folhas" offers: the applications with printed sheets, the most recent first. */
  gradable: DashboardActivity[]
}

/** How a class did on one multiple-choice question, with the most marked alternative by the letter of the bank. */
export interface ReportQuestionAccuracy {
  answered: number
  correct: number
  percentage: number
  /** The letter of the alternative in the order the question bank keeps them, as P18 has always named it. */
  mostMarkedLetter?: string
}

/** A question of the exam as the report shows it. */
export interface ReportQuestion {
  questionId: string
  /** Its place in the exam from 1, which is the "Q1" of the export whatever order each version printed. */
  number: number
  statement: string
  type: QuestionType
  /** What the question is worth in this exam. */
  score: number
  /** Only for a multiple-choice question; an open-ended one has no right alternative to count. */
  accuracy?: ReportQuestionAccuracy
}

/** One finished correction, as the list of grades (P18) and the export (RF36) show it. */
export interface ReportStudentRow {
  correctionId: string
  /** The student's name, or "Folha N" for a sheet still without one. */
  name: string
  /** Empty for a sheet still without a student. */
  registration: string
  /** `null` only if the version was lost, which the database does not allow. */
  versionNumber: number | null
  totalScore: number
  /**
   * The score of each question of the exam, in the exam's order, `null` where
   * the correction has none. Keyed by the question and never by where the
   * version printed it, so the score of question 1 lands in column 1 whatever
   * version the student had.
   */
  questionScores: (number | null)[]
}

/** The report of one application (P18, RF34 and RF35). */
export interface ApplicationReport {
  applicationId: string
  examTitle: string
  className: string
  date: string
  /** What the exam is worth, the top of the distribution. */
  maximumScore: number
  /** Sheets printed for the application, the total of "corrigidas de N". */
  sheets: number
  /** Corrections still waiting for an open-ended score (RF48), which no number below includes. */
  inProgress: number
  /** Of the finished corrections only: a grade counts once the correction is `DONE`. */
  summary: ScoreSummary
  distribution: Distribution[]
  questions: ReportQuestion[]
  tags: TagAccuracy[]
  /** One row per finished correction, in name order. */
  students: ReportStudentRow[]
}

/** One application of the consolidated report (P19), with what its filters match against. */
export interface ConsolidatedReportRow {
  applicationId: string
  examTitle: string
  classId: string
  className: string
  subject: string
  term: string
  date: string
  /** Of the finished corrections only; `count` is the "Corrigidas" of the table. */
  summary: ScoreSummary
}

/** A question as the report reads it: what it is, its tags and, for a multiple-choice one, its alternatives in the bank's order. */
export type ReportedQuestion = Pick<Question, 'id' | 'type' | 'statement' | 'tags'> & { alternatives?: readonly { id: string }[] }

export type ReportedCorrection = Pick<
  Correction,
  'id' | 'answerSheetId' | 'examVersionId' | 'studentId' | 'status' | 'totalScore' | 'objectiveResults' | 'discursiveScores'
>

/**
 * Everything one application's report is made of. The questions include any
 * deleted from the bank after the exam was printed, and the names come from
 * the exam and the class even when archived: the report describes what
 * happened, not what is active today.
 */
export interface ApplicationReportSource {
  application: { id: string; date: string }
  examTitle: string
  className: string
  examQuestions: readonly Pick<ExamQuestion, 'questionId' | 'order' | 'score'>[]
  questions: readonly ReportedQuestion[]
  versions: readonly Pick<ExamVersion, 'id' | 'versionNumber'>[]
  sheets: readonly Pick<AnswerSheet, 'id' | 'sheetNumber'>[]
  /** The students the class has had, removed ones included, so a grade keeps its name (#161). */
  students: readonly Pick<Student, 'id' | 'fullName' | 'registration'>[]
  corrections: readonly ReportedCorrection[]
}

/** What the name of a correction falls back to when its student is no longer anywhere to be found. */
export const MISSING_STUDENT_NAME = 'Aluno removido'

/** A sheet without identification and still without a student is named by its number, as on P15. */
export function sheetLabel(sheetNumber: number | undefined): string {
  return `Folha ${sheetNumber ?? '—'}`
}

/**
 * Only a finished correction has a grade: until every open-ended question has
 * a mark, the total lacks part of it (requirements, section 5; RF47).
 */
export function finishedCorrections<Item extends Pick<Correction, 'status'>>(corrections: readonly Item[]): Item[] {
  return corrections.filter((correction) => correction.status === CORRECTION_STATUS.DONE)
}

/**
 * What the panel counts as pending (#93): a correction still owing an
 * open-ended score (RF48) or the student it belongs to (RF31). Either one
 * alone is enough, and one owing both counts once, because the panel counts
 * sheets to deal with, not reasons. The API's query applies the same rule.
 */
export function isPendingCorrection(correction: Pick<Correction, 'status' | 'studentId'>): boolean {
  return correction.status === CORRECTION_STATUS.IN_PROGRESS || correction.studentId === undefined
}

function letterAt(index: number): string | undefined {
  return index >= 0 && index < ANSWER_CARD.columns.length ? columnLetter(index) : undefined
}

function accuracyFor(question: ReportedQuestion, results: readonly ObjectiveResult[]): ReportQuestionAccuracy {
  const { answered, correct, percentage, mostMarkedAlternativeId } = accuracyOf(question.id, results)
  const index = question.alternatives?.findIndex((alternative) => alternative.id === mostMarkedAlternativeId) ?? -1
  const mostMarkedLetter = letterAt(index)
  return { answered, correct, percentage, ...(mostMarkedLetter !== undefined && { mostMarkedLetter }) }
}

/** The exam's questions by their order, the order every column and section of a report follows. */
export function examOrder<Entry extends Pick<ExamQuestion, 'order'>>(examQuestions: readonly Entry[]): Entry[] {
  return examQuestions.toSorted((a, b) => a.order - b.order)
}

function questionsOf(source: ApplicationReportSource, results: readonly ObjectiveResult[]): ReportQuestion[] {
  const byId = new Map(source.questions.map((question) => [question.id, question]))
  return examOrder(source.examQuestions).flatMap((entry, index): ReportQuestion[] => {
    const question = byId.get(entry.questionId)
    if (question === undefined) return []
    return [
      {
        questionId: entry.questionId,
        number: index + 1,
        statement: question.statement,
        type: question.type,
        score: entry.score,
        ...(question.type === 'objetiva' && { accuracy: accuracyFor(question, results) }),
      },
    ]
  })
}

/** What one correction scored in each question, keyed by the question so the version's printed order never matters. */
export function questionScoresOf(
  correction: Pick<Correction, 'objectiveResults' | 'discursiveScores'>,
  examQuestions: readonly Pick<ExamQuestion, 'questionId' | 'order'>[],
): (number | null)[] {
  const scored = new Map<string, number>()
  for (const { questionId, score } of correction.objectiveResults) scored.set(questionId, score)
  for (const { questionId, score } of correction.discursiveScores) scored.set(questionId, score)
  return examOrder(examQuestions).map((entry) => scored.get(entry.questionId) ?? null)
}

function studentRowsOf(source: ApplicationReportSource, finished: readonly ReportedCorrection[]): ReportStudentRow[] {
  const students = new Map(source.students.map((student) => [student.id, student]))
  const sheetNumbers = new Map(source.sheets.map((sheet) => [sheet.id, sheet.sheetNumber]))
  const versionNumbers = new Map(source.versions.map((version) => [version.id, version.versionNumber]))

  const identityOf = (correction: ReportedCorrection) => {
    if (correction.studentId === undefined) return { name: sheetLabel(sheetNumbers.get(correction.answerSheetId)), registration: '' }
    const student = students.get(correction.studentId)
    return { name: student?.fullName ?? MISSING_STUDENT_NAME, registration: student?.registration ?? '' }
  }

  return finished
    .map((correction) => ({
      correctionId: correction.id,
      ...identityOf(correction),
      versionNumber: versionNumbers.get(correction.examVersionId) ?? null,
      totalScore: correction.totalScore,
      questionScores: questionScoresOf(correction, source.examQuestions),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * The report of one application (RF34, RF35). Every number comes from the
 * finished corrections only; the ones still in progress are counted apart,
 * so the teacher knows the report is not the whole class yet (RF48).
 */
export function buildApplicationReport(source: ApplicationReportSource): ApplicationReport {
  const finished = finishedCorrections(source.corrections)
  const scores = finished.map((correction) => correction.totalScore)
  const maximumScore = totalScore(source.examQuestions)
  const results = finished.flatMap((correction) => correction.objectiveResults)
  const tagsById = new Map(source.questions.map((question) => [question.id, question.tags]))

  return {
    applicationId: source.application.id,
    examTitle: source.examTitle,
    className: source.className,
    date: source.application.date,
    maximumScore,
    sheets: source.sheets.length,
    inProgress: source.corrections.length - finished.length,
    summary: summarise(scores),
    distribution: distribute(scores, maximumScore),
    questions: questionsOf(source, results),
    tags: accuracyByTag(results, (questionId) => tagsById.get(questionId) ?? []),
    students: studentRowsOf(source, finished),
  }
}

export interface ConsolidatedRowSource {
  application: { id: string; date: string }
  examTitle: string
  schoolClass: Pick<Class, 'id' | 'name' | 'subject' | 'term'>
  /** The totals of the application's finished corrections. */
  scores: readonly number[]
}

export function consolidatedRowOf({ application, examTitle, schoolClass, scores }: ConsolidatedRowSource): ConsolidatedReportRow {
  return {
    applicationId: application.id,
    examTitle,
    classId: schoolClass.id,
    className: schoolClass.name,
    subject: schoolClass.subject,
    term: schoolClass.term,
    date: application.date,
    summary: summarise(scores),
  }
}

/**
 * The consolidated report keeps an application once it has a grade, the most
 * recent first. An application with nothing finished is not a row of zeros:
 * it has no grade to compare yet.
 */
export function consolidatedRows(rows: readonly ConsolidatedReportRow[]): ConsolidatedReportRow[] {
  return rows.filter((row) => row.summary.count > 0).toSorted((a, b) => b.date.localeCompare(a.date))
}

const scoreSummarySchema = z.object({
  count: z.number(),
  mean: z.number(),
  median: z.number(),
  standardDeviation: z.number(),
  lowest: z.number(),
  highest: z.number(),
})

const dashboardActivitySchema = z.object({ id: z.string(), title: z.string(), detail: z.string(), date: z.string() })

/** The answers of the report routes, which the web app validates like every other answer of the API. */
export const dashboardSummarySchema: z.ZodType<DashboardSummary> = z.object({
  classes: z.number(),
  questions: z.number(),
  exams: z.number(),
  applications: z.number(),
  pendingCorrections: z.number(),
  recent: z.array(dashboardActivitySchema),
  gradable: z.array(dashboardActivitySchema),
})

const reportQuestionSchema = z.object({
  questionId: z.string(),
  number: z.number(),
  statement: z.string(),
  type: z.enum(['objetiva', 'discursiva']),
  score: z.number(),
  accuracy: z
    .object({ answered: z.number(), correct: z.number(), percentage: z.number(), mostMarkedLetter: z.string().optional() })
    .optional(),
})

const reportStudentRowSchema = z.object({
  correctionId: z.string(),
  name: z.string(),
  registration: z.string(),
  versionNumber: z.number().nullable(),
  totalScore: z.number(),
  questionScores: z.array(z.number().nullable()),
})

export const applicationReportSchema: z.ZodType<ApplicationReport> = z.object({
  applicationId: z.string(),
  examTitle: z.string(),
  className: z.string(),
  date: z.string(),
  maximumScore: z.number(),
  sheets: z.number(),
  inProgress: z.number(),
  summary: scoreSummarySchema,
  distribution: z.array(z.object({ from: z.number(), to: z.number(), count: z.number() })),
  questions: z.array(reportQuestionSchema),
  tags: z.array(z.object({ tag: z.string(), answered: z.number(), correct: z.number(), percentage: z.number() })),
  students: z.array(reportStudentRowSchema),
})

export const consolidatedReportRowSchema: z.ZodType<ConsolidatedReportRow> = z.object({
  applicationId: z.string(),
  examTitle: z.string(),
  classId: z.string(),
  className: z.string(),
  subject: z.string(),
  term: z.string(),
  date: z.string(),
  summary: scoreSummarySchema,
})
