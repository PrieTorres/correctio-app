import type {
  AnswerKeyEntry,
  AnswerSheet,
  Application,
  Class,
  Correction,
  Exam,
  ExamVersion,
  PublicLookup,
  PublicLookupHeader,
  Question,
  Student,
} from '@/types/domain'

export interface LookupSources {
  sheet: AnswerSheet | null
  version: ExamVersion | null
  application: Application | null
  exam: Exam | null
  group: Class | null
  student: Student | null
  correction: Correction | null
  bank: readonly Question[]
}

/**
 * Decides what a student may see from the code printed on their sheet.
 *
 * This is the only page without authentication, and it shows a name and a
 * grade, so it answers with the least the rule allows rather than the most it
 * could reach. The result is a discriminated union because the two levels the
 * teacher controls nest: publishing the answer key lets a student see the
 * correct alternatives, and releasing grades adds their own score on top. A
 * score without an answer key is not a state this page can be in, and the type
 * makes it impossible to write.
 *
 * Anything missing — an unknown code, an application since archived — comes
 * back as an invalid code. Telling a stranger which part of the chain is broken
 * tells them something about data they have no claim to.
 */
export function resolvePublicLookup(sources: LookupSources): PublicLookup {
  const { sheet, version, application, exam, group, student, correction, bank } = sources

  if (sheet === null || version === null || application === null || exam === null) {
    return { status: 'INVALID_CODE' }
  }

  const header: PublicLookupHeader = {
    examTitle: exam.title,
    subject: group?.subject ?? '',
    className: group?.name ?? '',
    date: application.date,
    identity:
      version.withStudentIdentification && student !== null
        ? { type: 'STUDENT', fullName: student.fullName }
        : { type: 'SHEET', sheetNumber: sheet.sheetNumber, versionNumber: version.versionNumber },
  }

  if (!version.answerKeyPublished) return { status: 'NOTHING_RELEASED', header }

  const answerKey = buildAnswerKey(version, bank)

  if (!application.gradesReleased || correction === null) {
    return { status: 'ANSWER_KEY_ONLY', header, answerKey }
  }

  return {
    status: 'ANSWER_KEY_AND_SCORE',
    header,
    answerKey,
    totalScore: correction.totalScore,
    objectiveResults: correction.objectiveResults,
  }
}

/**
 * Built from the printed order, so the key lists the questions in the sequence
 * the student is holding. Open-ended questions are left out: there is no
 * correct alternative to publish.
 */
function buildAnswerKey(version: ExamVersion, bank: readonly Question[]): AnswerKeyEntry[] {
  const byId = new Map(bank.map((question) => [question.id, question]))

  return version.layout.questionOrder.flatMap((questionId) => {
    const correctAlternativeId = byId.get(questionId)?.correctAlternativeId
    return correctAlternativeId === undefined ? [] : [{ questionId, correctAlternativeId }]
  })
}
