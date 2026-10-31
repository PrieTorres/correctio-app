import type { AnswerSheet, ExamVersion, Question } from '@correctio/domain'

/**
 * What the PDF reads of a question: its statement and, for an objective one,
 * its alternatives. The contract's `Question` fits, and so does the record the
 * API loads from the database.
 */
export type PrintableQuestion = Pick<Question, 'id' | 'statement' | 'alternatives'>

/** A question as the exam prints it: the question itself and what it is worth in this exam. */
export interface PrintedQuestion {
  question: PrintableQuestion
  score: number
}

/** One sheet to print, with the student only when the application identifies them. */
export interface PrintedSheet {
  sheet: AnswerSheet
  student?: { fullName: string; registration: string }
}

/**
 * Everything the PDF of an application prints, already read from the database:
 * the renderer reads nothing on its own, so it can be tested with plain data
 * and the generation (#46) decides what goes in.
 */
export interface PrintJob {
  examTitle: string
  className: string
  subject: string
  term: string
  /** The date of the application, ISO 8601. */
  date: string
  /**
   * The origin of the web app (`PUBLIC_APP_URL`), which the QR code of every
   * sheet points at. It is printed on paper, so it comes from the environment
   * and never from the code (`docs/Arquitetura.md`, section 3).
   */
  publicAppUrl: string
  versions: readonly ExamVersion[]
  /**
   * The questions of the exam by id, deleted ones included: a version printed
   * before a question was deleted still names it in its layout.
   */
  questions: ReadonlyMap<string, PrintedQuestion>
  sheets: readonly PrintedSheet[]
}
