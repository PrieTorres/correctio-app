import { createAnswerSheetCode } from './answer-sheet-code'
import type { AnswerSheet, Exam, ExamQuestion, ExamVersion, ExamVersionLayout, Question, Student } from './domain'
import type { RandomSource } from './draw-questions'
import type { VersionShuffle } from './schemas'

/** What laying out a version reads of a question: the alternatives it may shuffle. */
export type LayoutQuestion = Pick<Question, 'id' | 'alternatives'>

export interface VersionCriteria {
  applicationId: string
  /** The questions of the exam, each with its order and whether its alternatives may move. */
  exam: Pick<Exam, 'questions'>
  /**
   * The questions themselves, deleted ones included: one deleted from the bank
   * after it joined the exam is still printed, and without its alternatives the
   * layout could not say which letter is which.
   */
  questions: readonly LayoutQuestion[]
  /** How each version shuffles, in version order (RF22); one entry per version to print. */
  versions: readonly VersionShuffle[]
  withStudentIdentification: boolean
}

/** Shuffles a copy, leaving the caller's array untouched. */
function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1))
    const here = copy[index]
    const there = copy[swapWith]
    if (here !== undefined && there !== undefined) {
      copy[index] = there
      copy[swapWith] = here
    }
  }
  return copy
}

/** What one version is laid out from. */
interface LayoutSource {
  ordered: readonly ExamQuestion[]
  questions: ReadonlyMap<string, LayoutQuestion>
  shuffle: VersionShuffle
  random: RandomSource
}

/**
 * The order one version prints. A question whose own `allowShuffleAlternatives`
 * is false keeps its alternatives in place even when the version shuffles
 * them: some only make sense in sequence, such as "todas as anteriores".
 */
function layoutOf({ ordered, questions, shuffle, random }: LayoutSource): ExamVersionLayout {
  const entries = shuffle.shuffleQuestions ? shuffled(ordered, random) : ordered
  const alternativeOrder = entries.flatMap((entry) => {
    const alternatives = questions.get(entry.questionId)?.alternatives
    if (alternatives === undefined) return []

    const mayShuffle = shuffle.shuffleAlternatives && entry.allowShuffleAlternatives
    const printed = mayShuffle ? shuffled(alternatives, random) : alternatives
    return [{ questionId: entry.questionId, printedOrder: printed.map((alternative) => alternative.id) }]
  })

  return { questionOrder: entries.map((entry) => entry.questionId), alternativeOrder }
}

/**
 * Builds the printed versions of an application.
 *
 * The layout is recorded rather than recomputed: correction reads a sheet by
 * the position a mark sits in, so the order the paper was printed in is the
 * only thing that can say which question and which alternative that position
 * meant. Losing it makes the sheet unreadable, which is why the Spec keeps
 * `ExamVersion.layout` and why this writes it down at generation time.
 *
 * Each version shuffles as its own entry says (RF22), so the versions of one
 * application may differ in more than the draw. Shared by the API, which
 * generates for real, and by the demo that runs in the browser.
 */
export function buildVersions(criteria: VersionCriteria, random: RandomSource = Math.random): ExamVersion[] {
  const questions = new Map(criteria.questions.map((question) => [question.id, question]))
  const ordered = [...criteria.exam.questions].sort((a, b) => a.order - b.order)

  return criteria.versions.map((shuffle, index) => {
    const publicCode = createAnswerSheetCode()

    return {
      id: globalThis.crypto.randomUUID(),
      applicationId: criteria.applicationId,
      versionNumber: index + 1,
      shuffleQuestions: shuffle.shuffleQuestions,
      shuffleAlternatives: shuffle.shuffleAlternatives,
      withStudentIdentification: criteria.withStudentIdentification,
      layout: layoutOf({ ordered, questions, shuffle, random }),
      answerKeyPublished: false,
      publicCode,
      qrCodePayload: publicCode,
    }
  })
}

/**
 * Builds one answer sheet per student, spread evenly across the versions.
 *
 * Round-robin rather than random so neighbours get different papers, which is
 * the reason for having versions at all. Every sheet carries its own code, and
 * that code is what the public lookup resolves.
 *
 * A sheet printed without identification is deliberately not tied to anyone.
 * The paper carries no name, so nobody knows which student took which one until
 * the correction says so — recording a guess here would make that screen
 * pointless and quietly attach grades to the wrong people.
 */
export function buildAnswerSheets(
  applicationId: string,
  versions: readonly Pick<ExamVersion, 'id'>[],
  students: readonly Pick<Student, 'id'>[],
  withStudentIdentification = true,
): AnswerSheet[] {
  if (versions.length === 0) return []

  return students.map((student, index) => ({
    id: globalThis.crypto.randomUUID(),
    applicationId,
    examVersionId: versions[index % versions.length]?.id ?? '',
    ...(withStudentIdentification ? { studentId: student.id } : {}),
    sheetNumber: index + 1,
    code: createAnswerSheetCode(),
  }))
}
