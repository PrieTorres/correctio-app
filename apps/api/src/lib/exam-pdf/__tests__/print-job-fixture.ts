import type { ExamVersion, Question } from '@correctio/domain'
import type { PrintedQuestion, PrintedSheet, PrintJob } from '../print-job'

export function multipleChoice(id: string, statement: string, texts: readonly string[]): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'objetiva',
    statement,
    tags: [],
    alternatives: texts.map((text, index) => ({ id: `${id}-${index}`, text })),
    correctAlternativeId: `${id}-0`,
    allowShuffleAlternatives: true,
  }
}

export function openEnded(id: string, statement: string): Question {
  return { id, teacherId: 'ana', type: 'discursiva', statement, tags: [], maxScore: 2, allowShuffleAlternatives: true }
}

export function printedQuestions(entries: readonly (readonly [Question, number])[]): Map<string, PrintedQuestion> {
  return new Map(entries.map(([question, score]) => [question.id, { question, score }]))
}

/** A version that prints the questions in `questionOrder`, every objective one in reverse when `reverse` is set. */
export function versionOf(
  questions: ReadonlyMap<string, PrintedQuestion>,
  { id, versionNumber, questionOrder, reverse = false, identified = true }: {
    id: string
    versionNumber: number
    questionOrder: readonly string[]
    reverse?: boolean
    identified?: boolean
  },
): ExamVersion {
  const alternativeOrder = questionOrder.flatMap((questionId) => {
    const alternatives = questions.get(questionId)?.question.alternatives
    if (alternatives === undefined) return []
    const printed = alternatives.map((alternative) => alternative.id)
    return [{ questionId, printedOrder: reverse ? printed.toReversed() : printed }]
  })

  return {
    id,
    applicationId: 'application-1',
    versionNumber,
    shuffleQuestions: false,
    shuffleAlternatives: reverse,
    withStudentIdentification: identified,
    layout: { questionOrder: [...questionOrder], alternativeOrder },
    answerKeyPublished: false,
    publicCode: `PUBLIC${versionNumber}`,
    qrCodePayload: `PUBLIC${versionNumber}`,
  }
}

export function sheetOf(sheetNumber: number, examVersionId: string, student?: PrintedSheet['student']): PrintedSheet {
  const code = String.fromCharCode(64 + sheetNumber).repeat(26)
  return {
    sheet: {
      id: `sheet-${sheetNumber}`,
      applicationId: 'application-1',
      examVersionId,
      ...(student !== undefined && { studentId: `student-${sheetNumber}` }),
      sheetNumber,
      code,
      answerCardVersion: 1,
    },
    ...(student !== undefined && { student }),
  }
}

export const LIMITS = multipleChoice('q-limits', 'Qual é o valor de lim(x→0) sen(x)/x?', ['0', '1', 'Não existe', 'Infinito'])
export const DERIVATIVE = multipleChoice('q-derivative', 'A derivada de f(x) = x³ é:', ['3x²', 'x²'])
export const CONTINUITY = openEnded('q-continuity', 'Explique o que é uma função contínua.')

export function sampleJob(overrides: Partial<PrintJob> = {}): PrintJob {
  const questions = printedQuestions([
    [LIMITS, 2.5],
    [DERIVATIVE, 1],
    [CONTINUITY, 4],
  ])
  const order = [LIMITS.id, DERIVATIVE.id, CONTINUITY.id]
  const versions = [
    versionOf(questions, { id: 'v1', versionNumber: 1, questionOrder: order }),
    versionOf(questions, { id: 'v2', versionNumber: 2, questionOrder: order.toReversed(), reverse: true }),
  ]

  return {
    examTitle: 'Cálculo I — Prova 1',
    className: 'Cálculo I — Noturno',
    subject: 'Matemática',
    term: '2026/2',
    date: '2026-10-05T12:00:00.000Z',
    publicAppUrl: 'https://correctio-app.web.app',
    versions,
    questions,
    sheets: [
      sheetOf(1, 'v1', { fullName: 'Ana Beatriz Moreira', registration: '202601' }),
      sheetOf(2, 'v2', { fullName: 'Bruno Carvalho Lima', registration: '202602' }),
    ],
    ...overrides,
  }
}

/** The item at `index`, failing the test instead of asserting it exists. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No item at ${index}`)
  return item
}
