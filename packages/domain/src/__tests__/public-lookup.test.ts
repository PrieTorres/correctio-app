import { describe, expect, it } from 'vitest'
import {
  CORRECTION_SOURCE,
  CORRECTION_STATUS,
  type AnswerSheet,
  type Application,
  type Class,
  type Correction,
  type Exam,
  type ExamVersion,
  type Question,
  type Student,
} from '../domain'
import { resolvePublicLookup, type LookupSources } from '../public-lookup'

const BANK: Question[] = [
  {
    id: 'q1',
    teacherId: 'ana',
    type: 'objetiva',
    statement: 'Objetiva',
    tags: [],
    alternatives: [
      { id: 'q1-a', text: 'certa' },
      { id: 'q1-b', text: 'errada' },
    ],
    correctAlternativeId: 'q1-a',
    allowShuffleAlternatives: true,
  },
  {
    id: 'q2',
    teacherId: 'ana',
    type: 'discursiva',
    statement: 'Discursiva',
    tags: [],
    maxScore: 4,
    allowShuffleAlternatives: true,
  },
]

const EXAM: Exam = {
  id: 'exam-1',
  teacherId: 'ana',
  title: 'Prova 1',
  description: '',
  status: 'ready',
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: true,
  questions: BANK.map((question, index) => ({
    questionId: question.id,
    order: index,
    score: 5,
    allowShuffleAlternatives: true,
  })),
}

const GROUP: Class = {
  id: 'class-1',
  teacherId: 'ana',
  name: 'Cálculo I',
  subject: 'Matemática',
  term: '2026/2',
  status: 'active',
  inviteCode: 'ABC12345',
}

const STUDENT: Student = {
  id: 'student-1',
  classId: 'class-1',
  fullName: 'Ana Ribeiro',
  registration: '202601',
}

const SHEET: AnswerSheet = {
  id: 'sheet-1',
  applicationId: 'app-1',
  examVersionId: 'version-1',
  studentId: 'student-1',
  sheetNumber: 3,
  code: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  answerCardVersion: 1,
}

function version(overrides: Partial<ExamVersion> = {}): ExamVersion {
  return {
    id: 'version-1',
    applicationId: 'app-1',
    versionNumber: 2,
    shuffleQuestions: true,
    shuffleAlternatives: true,
    withStudentIdentification: true,
    layout: { questionOrder: ['q1', 'q2'], alternativeOrder: [{ questionId: 'q1', printedOrder: ['q1-a', 'q1-b'] }] },
    answerKeyPublished: false,
    publicCode: 'PUBCODE',
    qrCodePayload: 'PUBCODE',
    ...overrides,
  }
}

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    examId: 'exam-1',
    classId: 'class-1',
    teacherId: 'ana',
    status: 'generated',
    date: '2026-10-05T12:00:00.000Z',
    gradesReleased: false,
    ...overrides,
  }
}

const CORRECTION: Correction = {
  id: 'correction-1',
  examVersionId: 'version-1',
  answerSheetId: 'sheet-1',
  status: CORRECTION_STATUS.DONE,
  source: CORRECTION_SOURCE.IMAGE_UPLOAD,
  objectiveResults: [{ questionId: 'q1', correct: true, score: 5, selectedAlternativeId: 'q1-a' }],
  discursiveScores: [{ questionId: 'q2', score: 3 }],
  totalScore: 8,
  confirmedAt: '2026-10-06T12:00:00.000Z',
  correctedBy: 'ana',
  isAutomaticallyAssigned: true,
  clientCorrectionId: 'client-correction-1',
  syncStatus: 'synced',
}

/** A version that printed the alternatives of `q1` the other way round, so its correct answer sits under B. */
const SHUFFLED_LAYOUT = { questionOrder: ['q1', 'q2'], alternativeOrder: [{ questionId: 'q1', printedOrder: ['q1-b', 'q1-a'] }] }

/** A second objective question, printed after the open-ended one. */
const THIRD: Question = {
  id: 'q3',
  teacherId: 'ana',
  type: 'objetiva',
  statement: 'Outra objetiva',
  tags: [],
  alternatives: [
    { id: 'q3-a', text: 'errada' },
    { id: 'q3-b', text: 'certa' },
  ],
  correctAlternativeId: 'q3-b',
  allowShuffleAlternatives: true,
}

function sources(overrides: Partial<LookupSources> = {}): LookupSources {
  return {
    sheet: SHEET,
    version: version(),
    application: application(),
    exam: EXAM,
    group: GROUP,
    student: STUDENT,
    correction: CORRECTION,
    bank: BANK,
    ...overrides,
  }
}

describe('resolvePublicLookup', () => {
  it('reports an invalid code when the sheet is unknown', () => {
    expect(resolvePublicLookup(sources({ sheet: null })).status).toBe('INVALID_CODE')
  })

  /** Naming the broken link would tell a stranger about data they cannot claim. */
  it('reports the same invalid code when the application is gone', () => {
    expect(resolvePublicLookup(sources({ application: null })).status).toBe('INVALID_CODE')
  })

  it('reports an invalid code when the exam is gone', () => {
    expect(resolvePublicLookup(sources({ exam: null })).status).toBe('INVALID_CODE')
  })

  it('shows nothing released while the answer key is unpublished', () => {
    const result = resolvePublicLookup(sources())

    expect(result.status).toBe('NOTHING_RELEASED')
  })

  it('withholds the grade while only the answer key is published', () => {
    const result = resolvePublicLookup(
      sources({ version: version({ answerKeyPublished: true }) }),
    )

    expect(result.status).toBe('ANSWER_KEY_ONLY')
  })

  it('withholds the grade even when grades are released, if the key is not', () => {
    const result = resolvePublicLookup(
      sources({ application: application({ gradesReleased: true }) }),
    )

    expect(result.status).toBe('NOTHING_RELEASED')
  })

  it('shows the grade once both levels are released', () => {
    const result = resolvePublicLookup(
      sources({
        version: version({ answerKeyPublished: true }),
        application: application({ gradesReleased: true }),
      }),
    )

    expect(result.status).toBe('ANSWER_KEY_AND_SCORE')
    if (result.status === 'ANSWER_KEY_AND_SCORE') expect(result.totalScore).toBe(8)
  })

  it('holds the grade back when the sheet has not been corrected', () => {
    const result = resolvePublicLookup(
      sources({
        version: version({ answerKeyPublished: true }),
        application: application({ gradesReleased: true }),
        correction: null,
      }),
    )

    expect(result.status).toBe('ANSWER_KEY_ONLY')
  })

  /** An in-progress correction still waits for the open-ended scores, so its total is not final. */
  it('holds the grade back while the correction is still in progress', () => {
    const result = resolvePublicLookup(
      sources({
        version: version({ answerKeyPublished: true }),
        application: application({ gradesReleased: true }),
        correction: { ...CORRECTION, status: CORRECTION_STATUS.IN_PROGRESS },
      }),
    )

    expect(result.status).toBe('ANSWER_KEY_ONLY')
    expect(JSON.stringify(result)).not.toContain('totalScore')
  })

  /** Same answer as an unknown code, so a stranger cannot tell the two apart. */
  it('reports an invalid code for an archived application, even with everything released', () => {
    const result = resolvePublicLookup(
      sources({
        version: version({ answerKeyPublished: true }),
        application: application({ gradesReleased: true, status: 'closed' }),
      }),
    )

    expect(result).toEqual({ status: 'INVALID_CODE' })
    expect(result).toEqual(resolvePublicLookup(sources({ sheet: null })))
  })

  it('names the student when the paper was printed with identification', () => {
    const result = resolvePublicLookup(sources())

    if (result.status !== 'INVALID_CODE') {
      expect(result.header.identity).toEqual({ type: 'STUDENT', fullName: 'Ana Ribeiro' })
    }
  })

  /** Without identification the page must not name anyone, even if it could. */
  it('identifies by sheet and version when the paper carried no name', () => {
    const result = resolvePublicLookup(
      sources({ version: version({ withStudentIdentification: false }) }),
    )

    if (result.status !== 'INVALID_CODE') {
      expect(result.header.identity).toEqual({ type: 'SHEET', sheetNumber: 3, versionNumber: 2 })
    }
  })

  it('identifies by sheet when nobody has been assigned yet', () => {
    const result = resolvePublicLookup(sources({ student: null }))

    if (result.status !== 'INVALID_CODE') {
      expect(result.header.identity.type).toBe('SHEET')
    }
  })

  it('leaves the open-ended questions out of the answer key', () => {
    const result = resolvePublicLookup(
      sources({ version: version({ answerKeyPublished: true }) }),
    )

    if (result.status === 'ANSWER_KEY_ONLY') {
      expect(result.answerKey.map((entry) => entry.questionId)).toEqual(['q1'])
    }
  })

  it('lists the answer key in the order the paper was printed in', () => {
    const reversed = version({
      answerKeyPublished: true,
      layout: { questionOrder: ['q2', 'q1'], alternativeOrder: [{ questionId: 'q1', printedOrder: ['q1-a', 'q1-b'] }] },
    })

    const result = resolvePublicLookup(sources({ version: reversed }))

    if (result.status === 'ANSWER_KEY_ONLY') {
      expect(result.answerKey.map((entry) => entry.questionId)).toEqual(['q1'])
    }
  })

  /** #203: the student holds paper, not ids, and a shuffled version prints the right answer under another letter. */
  it('gives the letter the correct alternative was printed under on this version', () => {
    const result = resolvePublicLookup(sources({ version: version({ answerKeyPublished: true, layout: SHUFFLED_LAYOUT }) }))

    expect(result).toMatchObject({
      status: 'ANSWER_KEY_ONLY',
      answerKey: [{ questionId: 'q1', correctAlternativeId: 'q1-a', number: 1, correctLetter: 'B' }],
    })
  })

  /** The open-ended question is skipped, but it keeps its place, so the numbers match the paper. */
  it('numbers each question as the paper does, counting the open-ended ones it skips', () => {
    const printed = version({
      answerKeyPublished: true,
      layout: {
        questionOrder: ['q1', 'q2', 'q3'],
        alternativeOrder: [
          { questionId: 'q1', printedOrder: ['q1-a', 'q1-b'] },
          { questionId: 'q3', printedOrder: ['q3-a', 'q3-b'] },
        ],
      },
    })

    const result = resolvePublicLookup(sources({ version: printed, bank: [...BANK, THIRD] }))

    expect(result).toMatchObject({
      status: 'ANSWER_KEY_ONLY',
      answerKey: [
        { questionId: 'q1', number: 1, correctLetter: 'A' },
        { questionId: 'q3', number: 3, correctLetter: 'B' },
      ],
    })
  })

  /** A question this version printed without alternatives had nowhere to be marked, so no letter is guessed for it. */
  it('leaves out a question this version printed no alternatives for', () => {
    const unprinted = version({ answerKeyPublished: true, layout: { questionOrder: ['q1', 'q2'], alternativeOrder: [] } })

    expect(resolvePublicLookup(sources({ version: unprinted }))).toMatchObject({ status: 'ANSWER_KEY_ONLY', answerKey: [] })
  })

  it('shows the letter the student marked once the grades are out', () => {
    const result = resolvePublicLookup(
      sources({
        version: version({ answerKeyPublished: true, layout: SHUFFLED_LAYOUT }),
        application: application({ gradesReleased: true }),
        correction: { ...CORRECTION, objectiveResults: [{ questionId: 'q1', correct: false, score: 0, selectedAlternativeId: 'q1-b' }] },
      }),
    )

    expect(result).toMatchObject({
      status: 'ANSWER_KEY_AND_SCORE',
      answerKey: [{ questionId: 'q1', number: 1, correctLetter: 'B', markedLetter: 'A' }],
    })
  })

  it('gives no marked letter for a question left blank', () => {
    const result = resolvePublicLookup(
      sources({
        version: version({ answerKeyPublished: true }),
        application: application({ gradesReleased: true }),
        correction: { ...CORRECTION, objectiveResults: [{ questionId: 'q1', correct: false, score: 0 }] },
      }),
    )

    expect(result).toMatchObject({ status: 'ANSWER_KEY_AND_SCORE', answerKey: [{ questionId: 'q1', correctLetter: 'A' }] })
    expect(JSON.stringify(result)).not.toContain('markedLetter')
  })

  /** What the student marked is part of the grade, so it waits for the grades like the score does. */
  it('keeps what the student marked hidden while only the answer key is published', () => {
    const result = resolvePublicLookup(sources({ version: version({ answerKeyPublished: true }) }))

    expect(result.status).toBe('ANSWER_KEY_ONLY')
    expect(JSON.stringify(result)).not.toContain('markedLetter')
  })

  it('carries the exam, the class and the date for the header', () => {
    const result = resolvePublicLookup(sources())

    if (result.status !== 'INVALID_CODE') {
      expect(result.header.examTitle).toBe('Prova 1')
      expect(result.header.className).toBe('Cálculo I')
      expect(result.header.subject).toBe('Matemática')
    }
  })

  it('survives a class that no longer exists, without naming it', () => {
    const result = resolvePublicLookup(sources({ group: null }))

    if (result.status !== 'INVALID_CODE') expect(result.header.className).toBe('')
  })
})
