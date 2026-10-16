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
} from './domain'

/**
 * Only the fields the decision reads. A whole entity still fits, which is what
 * the web app hands over from its local data; the API selects these columns
 * and nothing else, so a field this page must never show is not even loaded.
 */
export interface LookupSources {
  sheet: Pick<AnswerSheet, 'sheetNumber'> | null
  version: Pick<ExamVersion, 'versionNumber' | 'withStudentIdentification' | 'answerKeyPublished' | 'layout'> | null
  application: Pick<Application, 'date' | 'gradesReleased'> | null
  exam: Pick<Exam, 'title'> | null
  group: Pick<Class, 'name' | 'subject'> | null
  student: Pick<Student, 'fullName'> | null
  correction: Pick<Correction, 'totalScore' | 'objectiveResults'> | null
  bank: readonly Pick<Question, 'id' | 'correctAlternativeId'>[]
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
 *
 * It lives in the shared package because the web app and the API (#49) answer
 * the same page, and a rule about what a stranger may see must not drift
 * between the two.
 */
export function resolvePublicLookup(sources: LookupSources): PublicLookup {
  const { sheet, version, application, exam, group, student, correction, bank } = sources;

  if (sheet === null || version === null || application === null || exam === null) {
    return { status: 'INVALID_CODE' };
  }

  const header = buildHeader({ sheet, version, application, exam, group, student });

  if (!version.answerKeyPublished) return { status: 'NOTHING_RELEASED', header };

  const answerKey = buildAnswerKey(version.layout.questionOrder, bank);

  if (!application.gradesReleased || correction === null) {
    return { status: 'ANSWER_KEY_ONLY', header, answerKey };
  }

  return {
    status: 'ANSWER_KEY_AND_SCORE',
    header,
    answerKey,
    totalScore: correction.totalScore,
    objectiveResults: correction.objectiveResults,
  };
}

type HeaderSources = { [Key in 'sheet' | 'version' | 'application' | 'exam']: NonNullable<LookupSources[Key]> } &
  Pick<LookupSources, 'group' | 'student'>;

/**
 * The student is named only when the version identifies students and the sheet
 * leads to one; otherwise the page shows the sheet and version numbers, which
 * say nothing about who holds the paper.
 */
function buildHeader({ sheet, version, application, exam, group, student }: HeaderSources): PublicLookupHeader {
  return {
    examTitle: exam.title,
    subject: group?.subject ?? '',
    className: group?.name ?? '',
    date: application.date,
    identity:
      version.withStudentIdentification && student !== null
        ? { type: 'STUDENT', fullName: student.fullName }
        : { type: 'SHEET', sheetNumber: sheet.sheetNumber, versionNumber: version.versionNumber },
  };
}

/**
 * Built from the printed order, so the key lists the questions in the sequence
 * the student is holding. Open-ended questions are left out: there is no
 * correct alternative to publish.
 */
function buildAnswerKey(
  questionOrder: readonly string[],
  bank: readonly Pick<Question, 'id' | 'correctAlternativeId'>[],
): AnswerKeyEntry[] {
  const byId = new Map(bank.map((question) => [question.id, question]));

  return questionOrder.flatMap((questionId) => {
    const correctAlternativeId = byId.get(questionId)?.correctAlternativeId;
    return correctAlternativeId === undefined ? [] : [{ questionId, correctAlternativeId }];
  });
}
