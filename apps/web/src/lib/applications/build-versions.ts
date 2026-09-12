import type { AnswerSheet, Exam, ExamVersion, Question, Student } from '@/types/domain'
import { createAnswerSheetCode, createId } from '@/lib/utils'
import type { RandomSource } from '@/lib/exams'

export interface VersionCriteria {
  applicationId: string
  exam: Exam
  /** Only what the exam actually uses, for reading the alternatives. */
  bank: readonly Question[]
  versionCount: number
  shuffleQuestions: boolean
  shuffleAlternatives: boolean
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

/**
 * Builds the printed versions of an application.
 *
 * The layout is recorded rather than recomputed: correction reads a sheet by
 * the position a mark sits in, so the order the paper was printed in is the
 * only thing that can say which question and which alternative that position
 * meant. Losing it makes the sheet unreadable, which is why the Spec keeps
 * `ExamVersion.layout` and why this writes it down at generation time.
 *
 * A question whose own `allowShuffleAlternatives` is false keeps its printed
 * order even when the application shuffles: some alternatives only make sense
 * in sequence, such as "todas as anteriores".
 */
export function buildVersions(
  criteria: VersionCriteria,
  random: RandomSource = Math.random,
): ExamVersion[] {
  const byId = new Map(criteria.bank.map((question) => [question.id, question]))
  const ordered = [...criteria.exam.questions].sort((a, b) => a.order - b.order)

  return Array.from({ length: criteria.versionCount }, (_, index) => {
    const questionOrder = (
      criteria.shuffleQuestions ? shuffled(ordered, random) : ordered
    ).map((entry) => entry.questionId)

    const alternativeOrder = questionOrder.flatMap((questionId) => {
      const question = byId.get(questionId)
      if (question === undefined || question.alternatives === undefined) return []

      const entry = ordered.find((item) => item.questionId === questionId)
      const mayShuffle =
        criteria.shuffleAlternatives && (entry?.allowShuffleAlternatives ?? true)
      const printedOrder = (
        mayShuffle ? shuffled(question.alternatives, random) : question.alternatives
      ).map((alternative) => alternative.id)

      return [{ questionId, printedOrder }]
    })

    const publicCode = createAnswerSheetCode()

    return {
      id: createId(),
      applicationId: criteria.applicationId,
      versionNumber: index + 1,
      shuffleQuestions: criteria.shuffleQuestions,
      shuffleAlternatives: criteria.shuffleAlternatives,
      withStudentIdentification: criteria.withStudentIdentification,
      layout: { questionOrder, alternativeOrder },
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
 * that code is what the public lookup of the later step resolves.
 *
 * A sheet printed without identification is deliberately not tied to anyone.
 * The paper carries no name, so nobody knows which student took which one until
 * the correction says so — recording a guess here would make that screen
 * pointless and quietly attach grades to the wrong people.
 */
export function buildAnswerSheets(
  applicationId: string,
  versions: readonly ExamVersion[],
  students: readonly Student[],
  withStudentIdentification = true,
): AnswerSheet[] {
  if (versions.length === 0) return []

  return students.map((student, index) => ({
    id: createId(),
    applicationId,
    examVersionId: versions[index % versions.length]?.id ?? '',
    ...(withStudentIdentification ? { studentId: student.id } : {}),
    sheetNumber: index + 1,
    code: createAnswerSheetCode(),
  }))
}
