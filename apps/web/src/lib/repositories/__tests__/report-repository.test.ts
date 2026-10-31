import { beforeEach, describe, expect, it } from 'vitest'
import { CORRECTION_STATUS, type Correction, type CorrectionStatus } from '@/types/domain'
import { clearAllCollections } from '@/lib/storage/collection'
import { seedApplicationChain, type SeededApplication } from '@/test-fixtures'
import { TEST_TEACHER_ID } from '@/test-utils'
import { createTeacherRepositories } from '..'
import { createLocalReportRepository, type CorrectionsByApplication } from '../report-repository'

const PRINT_ONE_VERSION = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification: true }

/** The corrections the test hands over, by application, standing in for wherever they are kept. */
function correctionsOf(byApplication: Record<string, Correction[]>): CorrectionsByApplication {
  return { listByApplication: (applicationId) => Promise.resolve(byApplication[applicationId] ?? []) }
}

interface Graded {
  sheetId: string
  versionId: string
  studentId?: string
  status?: CorrectionStatus
  /** Right or wrong on the multiple-choice question worth 6 of the seeded exam. */
  right: boolean
  essay?: number
}

function correction(seeded: SeededApplication, { sheetId, versionId, studentId, status = CORRECTION_STATUS.DONE, right, essay = 0 }: Graded): Correction {
  return {
    id: `correction-${sheetId}`,
    examVersionId: versionId,
    answerSheetId: sheetId,
    ...(studentId !== undefined && { studentId }),
    objectiveResults: [
      {
        questionId: seeded.objectiveQuestionId,
        correct: right,
        score: right ? 6 : 0,
        selectedAlternativeId: right ? seeded.correctAlternativeId : 'alt-wrong',
      },
    ],
    discursiveScores: status === CORRECTION_STATUS.DONE ? [{ questionId: seeded.discursiveQuestionId, score: essay }] : [],
    totalScore: (right ? 6 : 0) + essay,
    confirmedAt: '2026-10-06T12:00:00.000Z',
    correctedBy: TEST_TEACHER_ID,
    isAutomaticallyAssigned: studentId !== undefined,
    clientCorrectionId: `client-${sheetId}`,
    syncStatus: 'synced',
    status,
    source: 'MANUAL',
  }
}

/** The seeded application printed with one version, and the ids its corrections hang from. */
async function printed() {
  const seeded = await seedApplicationChain()
  const repositories = createTeacherRepositories(TEST_TEACHER_ID)
  const { versions, sheets } = await repositories.applications.generate(seeded.applicationId, PRINT_ONE_VERSION)
  const versionId = versions[0]?.id ?? ''
  const [first, second] = sheets
  return { seeded, repositories, versionId, first: first!, second: second! }
}

function reportsWith(repositories: ReturnType<typeof createTeacherRepositories>, corrections: CorrectionsByApplication) {
  return createLocalReportRepository({ ...repositories, corrections })
}

describe('createLocalReportRepository', () => {
  beforeEach(clearAllCollections)

  describe('dashboard', () => {
    it('counts nothing in a system with nothing in it', async () => {
      const reports = reportsWith(createTeacherRepositories(TEST_TEACHER_ID), correctionsOf({}))

      expect(await reports.dashboard()).toEqual({ classes: 0, questions: 0, exams: 0, applications: 0, pendingCorrections: 0, recent: [], gradable: [] })
    })

    it('counts what the teacher created and names the exam and class of each recent application', async () => {
      const seeded = await seedApplicationChain()
      const reports = reportsWith(createTeacherRepositories(TEST_TEACHER_ID), correctionsOf({}))

      const summary = await reports.dashboard()

      expect(summary).toMatchObject({ classes: 1, questions: 2, exams: 1, applications: 1 })
      expect(summary.recent).toEqual([{ id: seeded.applicationId, title: 'Prova de teste', detail: 'Turma', date: '2026-10-05T12:00:00.000Z' }])
    })

    /** What "Corrigir folhas" offers: the seeded draft has no sheets, so only the two generated ones count. */
    it('lists the applications to grade, generated only and the most recent first', async () => {
      const { examId, classId } = await seedApplicationChain()
      const repositories = createTeacherRepositories(TEST_TEACHER_ID)
      const earlier = await repositories.applications.create({ examId, classId, date: '2026-10-01T12:00:00.000Z' })
      const later = await repositories.applications.create({ examId, classId, date: '2026-10-12T12:00:00.000Z' })
      await repositories.applications.generate(earlier.id, PRINT_ONE_VERSION)
      await repositories.applications.generate(later.id, PRINT_ONE_VERSION)

      const { gradable, recent } = await reportsWith(repositories, correctionsOf({})).dashboard()

      expect(gradable.map((item) => item.id)).toEqual([later.id, earlier.id])
      expect(recent.map((item) => item.date)).toEqual(['2026-10-12T12:00:00.000Z', '2026-10-05T12:00:00.000Z', '2026-10-01T12:00:00.000Z'])
    })

    /** In progress (RF48) or without a student (RF31), each correction once (#93). */
    it('counts the pending corrections once each', async () => {
      const { seeded, repositories, versionId, first, second } = await printed()
      const corrections = correctionsOf({
        [seeded.applicationId]: [
          correction(seeded, { sheetId: first.id, versionId, studentId: first.studentId, status: CORRECTION_STATUS.IN_PROGRESS, right: true }),
          correction(seeded, { sheetId: second.id, versionId, status: CORRECTION_STATUS.IN_PROGRESS, right: false }),
          correction(seeded, { sheetId: 'sheet-done', versionId, studentId: 'someone', right: true }),
        ],
      })

      expect((await reportsWith(repositories, corrections).dashboard()).pendingCorrections).toBe(2)
    })
  })

  describe('application', () => {
    it('reports the finished corrections only, with the ones in progress apart', async () => {
      const { seeded, repositories, versionId, first, second } = await printed()
      const corrections = correctionsOf({
        [seeded.applicationId]: [
          correction(seeded, { sheetId: first.id, versionId, studentId: first.studentId, right: true, essay: 3 }),
          correction(seeded, { sheetId: second.id, versionId, studentId: second.studentId, status: CORRECTION_STATUS.IN_PROGRESS, right: false }),
        ],
      })

      const report = await reportsWith(repositories, corrections).application(seeded.applicationId)

      expect(report).toMatchObject({ examTitle: 'Prova de teste', className: 'Turma', maximumScore: 10, sheets: 2, inProgress: 1 })
      expect(report.summary).toMatchObject({ count: 1, mean: 9 })
      expect(report.students).toEqual([
        { correctionId: `correction-${first.id}`, name: 'Ana Ribeiro', registration: '1', versionNumber: 1, totalScore: 9, questionScores: [6, 3] },
      ])
      expect(report.tags).toEqual([{ tag: 'Aritmética', answered: 1, correct: 1, percentage: 100 }])
    })

    /** A question deleted from the bank after printing is still on the paper, and in the report. */
    it('keeps a question deleted from the bank after printing', async () => {
      const { seeded, repositories } = await printed()
      await repositories.questions.archive(seeded.objectiveQuestionId)

      const report = await reportsWith(repositories, correctionsOf({})).application(seeded.applicationId)

      expect(report.questions.map((question) => question.statement)).toEqual(['Quanto é 2 + 2?', 'Explique a soma.'])
    })

    it('refuses an application that does not exist', async () => {
      const reports = reportsWith(createTeacherRepositories(TEST_TEACHER_ID), correctionsOf({}))

      await expect(reports.application('nowhere')).rejects.toMatchObject({ code: 'not-found' })
    })
  })

  describe('consolidated', () => {
    it('lists an application once it has a finished correction, with what the filters read', async () => {
      const { seeded, repositories, versionId, first, second } = await printed()
      await repositories.classes.archive(seeded.classId)
      const unfinished = correctionsOf({
        [seeded.applicationId]: [correction(seeded, { sheetId: first.id, versionId, studentId: first.studentId, status: CORRECTION_STATUS.IN_PROGRESS, right: true })],
      })
      const finished = correctionsOf({
        [seeded.applicationId]: [
          correction(seeded, { sheetId: first.id, versionId, studentId: first.studentId, right: true, essay: 4 }),
          correction(seeded, { sheetId: second.id, versionId, studentId: second.studentId, status: CORRECTION_STATUS.IN_PROGRESS, right: false }),
        ],
      })

      expect(await reportsWith(repositories, unfinished).consolidated()).toEqual([])
      expect(await reportsWith(repositories, finished).consolidated()).toEqual([
        {
          applicationId: seeded.applicationId,
          examTitle: 'Prova de teste',
          classId: seeded.classId,
          className: 'Turma',
          subject: 'Matemática',
          term: '2026/2',
          date: '2026-10-05T12:00:00.000Z',
          summary: { count: 1, mean: 10, median: 10, standardDeviation: 0, lowest: 10, highest: 10 },
        },
      ])
    })
  })
})
