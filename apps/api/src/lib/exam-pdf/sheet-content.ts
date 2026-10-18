import { answerCardRows, columnLetter, type AnswerCardRow, type ExamVersion, type Question } from '@correctio/domain'
import type { PrintedQuestion, PrintedSheet, PrintJob } from './print-job'

/** The address a QR code carries: the public lookup of `/r/:code` in the web app (`ROUTES.publicLookup`). */
export function qrPayload(publicAppUrl: string, code: string): string {
  return `${publicAppUrl.replace(/\/+$/, '')}/r/${code}`
}

const DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })
const SCORE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/**
 * The day of the application as the teacher wrote it. Dates are stored at noon
 * UTC (`fromDateInputValue` in the web app), so formatting in UTC never moves
 * the day.
 */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso))
}

/** "1 ponto", "2,5 pontos": the value of a question as printed after its statement. */
export function formatScore(score: number): string {
  return `${SCORE.format(score)} ${score === 1 ? 'ponto' : 'pontos'}`
}

/** A question of one printed sheet, in the order and with the letters of its version. */
export interface PrintedQuestionContent {
  id: string
  number: number
  statement: string
  scoreLabel: string
  /** Absent for an open-ended question, which is answered in the space below it. */
  alternatives?: { letter: string; text: string }[]
}

function printedAlternatives(question: Question, printedOrder: readonly string[]) {
  const byId = new Map((question.alternatives ?? []).map((alternative) => [alternative.id, alternative.text]))
  return printedOrder.map((alternativeId, index) => {
    const text = byId.get(alternativeId)
    if (text === undefined) throw new Error(`Alternative ${alternativeId} of question ${question.id} is missing`)
    return { letter: columnLetter(index), text }
  })
}

function requirePrinted(questions: ReadonlyMap<string, PrintedQuestion>, questionId: string): PrintedQuestion {
  const printed = questions.get(questionId)
  if (printed === undefined) throw new Error(`Question ${questionId} of the layout is missing from the print job`)
  return printed
}

/**
 * The questions of a version in the order its layout recorded, each objective
 * one with its alternatives in `printedOrder` and lettered A onwards. The PDF
 * prints exactly this, so the letters on the paper are the ones the answer
 * card and the correction read.
 */
export function sheetQuestions(version: ExamVersion, questions: ReadonlyMap<string, PrintedQuestion>): PrintedQuestionContent[] {
  const printedOrders = new Map(version.layout.alternativeOrder.map((entry) => [entry.questionId, entry.printedOrder]))

  return version.layout.questionOrder.map((questionId, index) => {
    const { question, score } = requirePrinted(questions, questionId)
    const printedOrder = printedOrders.get(questionId)
    return {
      id: questionId,
      number: index + 1,
      statement: question.statement,
      scoreLabel: `(${formatScore(score)})`,
      ...(printedOrder !== undefined && { alternatives: printedAlternatives(question, printedOrder) }),
    }
  })
}

/** Who answers this sheet, as the cover prints it: a name, or blank lines for the student to fill in. */
export type CoverIdentity = { kind: 'STUDENT'; text: string } | { kind: 'BLANK' }

/** What the cover of one sheet prints, above and inside the answer card. */
export interface CoverContent {
  title: string
  classLine: string
  sittingLine: string
  identity: CoverIdentity
  instructions: string[]
  sheetLabel: string
  codeLabel: string
  qrPayload: string
  rows: AnswerCardRow[]
}

const INSTRUCTIONS = [
  'Use caneta azul ou preta e preencha a bolinha inteira.',
  'Marque uma alternativa por questão: mais de uma anula a questão.',
  'Não dobre nem amasse esta folha e não escreva sobre os quadrados pretos: o cartão é lido pela câmera.',
]

const OPEN_ENDED_INSTRUCTION = 'As questões discursivas são respondidas no espaço da própria questão.'

/**
 * The name is printed only when the application identifies the students.
 * Without identification the sheet is anonymous on purpose, and the student
 * writes their name, which the correction records as reported (#47).
 */
function coverIdentity(version: ExamVersion, printed: PrintedSheet): CoverIdentity {
  if (!version.withStudentIdentification || printed.student === undefined) return { kind: 'BLANK' }
  return { kind: 'STUDENT', text: `Aluno: ${printed.student.fullName} · Matrícula ${printed.student.registration}` }
}

export function coverContent(job: PrintJob, printed: PrintedSheet, version: ExamVersion): CoverContent {
  const rows = answerCardRows(version.layout)
  const { sheetNumber, code } = printed.sheet
  return {
    title: job.examTitle,
    classLine: `Turma: ${job.className} · ${job.subject} · ${job.term}`,
    sittingLine: `Data: ${formatDate(job.date)} · Versão ${version.versionNumber} · Folha ${sheetNumber}`,
    identity: coverIdentity(version, printed),
    instructions: rows.some((row) => row.bubbles === 0) ? [...INSTRUCTIONS, OPEN_ENDED_INSTRUCTION] : INSTRUCTIONS,
    sheetLabel: `Folha ${sheetNumber} · Versão ${version.versionNumber}`,
    codeLabel: `Código ${code}`,
    qrPayload: qrPayload(job.publicAppUrl, code),
    rows,
  }
}
