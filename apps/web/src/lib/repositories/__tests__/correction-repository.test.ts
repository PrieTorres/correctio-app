import { beforeEach, describe, expect, it } from 'vitest'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type AnswerSheet, type Exam, type Question } from '@/types/domain'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalCorrectionRepository, sheetImageIdOf, sheetImageKey, type ReviewInput } from '../correction-repository'

const APPLICATION = 'app-1'

const EXAM: Exam = {
  id: 'exam-1',
  teacherId: 'ana',
  title: 'Prova',
  description: '',
  questions: [
    { questionId: 'q-objective', order: 0, score: 6, allowShuffleAlternatives: true },
    { questionId: 'q-open', order: 1, score: 4, allowShuffleAlternatives: true },
  ],
  status: 'ready',
  defaultShuffleQuestions: false,
  defaultShuffleAlternatives: false,
}

const QUESTIONS: Question[] = [
  {
    id: 'q-objective',
    teacherId: 'ana',
    type: 'objetiva',
    statement: 'Quanto é 2 + 2?',
    tags: [],
    alternatives: [
      { id: 'right', text: '4' },
      { id: 'wrong', text: '5' },
    ],
    correctAlternativeId: 'right',
    allowShuffleAlternatives: true,
  },
  { id: 'q-open', teacherId: 'ana', type: 'discursiva', statement: 'Explique.', tags: [], maxScore: 4, allowShuffleAlternatives: true },
]

const sheet = (id: string, examVersionId: string, studentId?: string): AnswerSheet => ({
  id,
  applicationId: APPLICATION,
  examVersionId,
  ...(studentId !== undefined && { studentId }),
  sheetNumber: Number(id.at(-1)),
  code: `CODE${id}`,
  answerCardVersion: 1,
})

/** Ana's sheet, one printed without a name on the same version, and one of a second version. */
const SHEETS = [sheet('sheet-1', 'version-1', 'ana-student'), sheet('sheet-2', 'version-1'), sheet('sheet-3', 'version-2')]

function repository() {
  return createLocalCorrectionRepository({
    teacherId: 'teacher-ana',
    sheetsOf: (applicationId) => Promise.resolve(applicationId === APPLICATION ? SHEETS : []),
    examOf: (applicationId) => Promise.resolve(applicationId === APPLICATION ? { exam: EXAM, questions: QUESTIONS } : null),
  })
}

function review(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    answerSheetId: 'sheet-1',
    answers: [{ questionId: 'q-objective', selectedAlternativeId: 'right' }],
    discursiveScores: [],
    finalize: true,
    ...overrides,
  }
}

describe('local correction repository', () => {
  beforeEach(clearAllCollections)

  describe('grading a review with the rules the API applies', () => {
    /** RF48: the open-ended question has no score yet, so the correction is not done, whatever the teacher pressed. */
    it('grades the multiple choice and waits for the open-ended score', async () => {
      const stored = await repository().create(APPLICATION, review())

      expect(stored.totalScore).toBe(6)
      expect(stored.status).toBe(CORRECTION_STATUS.IN_PROGRESS)
      expect(stored.objectiveResults).toEqual([expect.objectContaining({ questionId: 'q-objective', correct: true, selectedAlternativeId: 'right' })])
    })

    it('is done once finalized with every open-ended question scored, zero included', async () => {
      const stored = await repository().create(APPLICATION, review({ discursiveScores: [{ questionId: 'q-open', score: 0 }] }))

      expect(stored.status).toBe(CORRECTION_STATUS.DONE)
      expect(stored.totalScore).toBe(6)
    })

    /** RF47: a teacher who stops in the middle keeps the correction open on purpose. */
    it('stays open when the teacher saves without finishing', async () => {
      const stored = await repository().create(APPLICATION, review({ discursiveScores: [{ questionId: 'q-open', score: 4 }], finalize: false }))

      expect(stored.status).toBe(CORRECTION_STATUS.IN_PROGRESS)
      expect(stored.totalScore).toBe(10)
    })

    it('holds an open-ended score to the maximum of its question', async () => {
      const stored = await repository().create(APPLICATION, review({ discursiveScores: [{ questionId: 'q-open', score: 9 }] }))

      expect(stored.discursiveScores).toEqual([{ questionId: 'q-open', score: 4 }])
      expect(stored.totalScore).toBe(10)
    })
  })

  describe('who and where a correction comes from', () => {
    it('belongs to the student printed on the sheet, assigned automatically', async () => {
      const stored = await repository().create(APPLICATION, review())

      expect(stored.studentId).toBe('ana-student')
      expect(stored.isAutomaticallyAssigned).toBe(true)
      expect(stored.correctedBy).toBe('teacher-ana')
      expect(stored.syncStatus).toBe('synced')
    })

    it('waits for its student when the sheet was printed without a name', async () => {
      const stored = await repository().create(APPLICATION, review({ answerSheetId: 'sheet-2' }))

      expect(stored.studentId).toBeUndefined()
      expect(stored.isAutomaticallyAssigned).toBe(false)
    })

    it('is typed by hand without a photo, and keeps the key of the photo it was read from', async () => {
      const typed = await repository().create(APPLICATION, review())
      const read = await repository().create(APPLICATION, review({ answerSheetId: 'sheet-3', imageId: 'photo-1' }))

      expect(typed.source).toBe(CORRECTION_SOURCE.MANUAL)
      expect(typed.imageUrl).toBeUndefined()
      expect(read.source).toBe(CORRECTION_SOURCE.IMAGE_UPLOAD)
      expect(read.imageUrl).toBe(sheetImageKey(APPLICATION, 'photo-1'))
    })
  })

  describe('what it refuses, as the API does', () => {
    it('refuses a sheet that is not in the application', async () => {
      await expect(repository().create(APPLICATION, review({ answerSheetId: 'sheet-9' }))).rejects.toMatchObject({ code: 'not-found' })
    })

    it('refuses a second correction of the same sheet', async () => {
      await repository().create(APPLICATION, review())

      await expect(repository().create(APPLICATION, review())).rejects.toMatchObject({ code: 'conflict' })
    })

    /** Two sheets read as the same person on one version: one of the two readings is wrong. */
    it('refuses the same student twice on one version', async () => {
      await repository().create(APPLICATION, review())

      await expect(repository().create(APPLICATION, review({ answerSheetId: 'sheet-2', studentId: 'ana-student' }))).rejects.toMatchObject({
        code: 'conflict',
      })
    })

    it('allows the same student on another version, which is a second sitting', async () => {
      await repository().create(APPLICATION, review())

      await expect(repository().create(APPLICATION, review({ answerSheetId: 'sheet-3', studentId: 'ana-student' }))).resolves.toMatchObject({
        studentId: 'ana-student',
      })
    })

    it('says so when the application is gone', async () => {
      await expect(repository().create('app-9', review())).rejects.toMatchObject({ code: 'not-found' })
    })
  })

  describe('listing and editing', () => {
    it('lists the corrections of the application, and only those still waiting for their student when asked', async () => {
      await repository().create(APPLICATION, review())
      await repository().create(APPLICATION, review({ answerSheetId: 'sheet-2' }))

      expect(await repository().listByApplication(APPLICATION)).toHaveLength(2)
      expect((await repository().listByApplication(APPLICATION, { assigned: false })).map((item) => item.answerSheetId)).toEqual(['sheet-2'])
      expect((await repository().listByApplication(APPLICATION, { assigned: true })).map((item) => item.answerSheetId)).toEqual(['sheet-1'])
      expect(await repository().listByApplication('app-9')).toEqual([])
    })

    /** Only the score changes: the marks stored before grade again, and the correction finishes. */
    it('regrades from the stored marks when only the open-ended score changes', async () => {
      const created = await repository().create(APPLICATION, review({ finalize: false }))

      const updated = await repository().update(APPLICATION, created.id, { discursiveScores: [{ questionId: 'q-open', score: 3 }], finalize: true })

      expect(updated.totalScore).toBe(9)
      expect(updated.status).toBe(CORRECTION_STATUS.DONE)
      expect(updated.objectiveResults[0]?.selectedAlternativeId).toBe('right')
    })

    it('keeps a finished correction finished when it is reopened for a new mark', async () => {
      const created = await repository().create(APPLICATION, review({ discursiveScores: [{ questionId: 'q-open', score: 2 }] }))

      const updated = await repository().update(APPLICATION, created.id, { answers: [{ questionId: 'q-objective', selectedAlternativeId: 'wrong' }] })

      expect(updated.status).toBe(CORRECTION_STATUS.DONE)
      expect(updated.totalScore).toBe(2)
    })

    /** RF31: a person chose the student, so the correction no longer says it was automatic. */
    it('assigns a student, recording that a person chose', async () => {
      const created = await repository().create(APPLICATION, review({ answerSheetId: 'sheet-2' }))

      const updated = await repository().update(APPLICATION, created.id, { studentId: 'bruno-student' })

      expect(updated.studentId).toBe('bruno-student')
      expect(updated.isAutomaticallyAssigned).toBe(false)
    })

    it('refuses to assign a student who already has a correction on that version', async () => {
      await repository().create(APPLICATION, review())
      const unnamed = await repository().create(APPLICATION, review({ answerSheetId: 'sheet-2' }))

      await expect(repository().update(APPLICATION, unnamed.id, { studentId: 'ana-student' })).rejects.toMatchObject({ code: 'conflict' })
    })

    it('says so when asked to edit a correction that is not there', async () => {
      await expect(repository().update(APPLICATION, 'missing', { finalize: true })).rejects.toMatchObject({ code: 'not-found' })
    })
  })
})

describe('the key of a sheet photo', () => {
  it('is the same on the API and in the demo, and gives the photo back', () => {
    expect(sheetImageKey('app-1', 'photo-1')).toBe('answer-sheets/app-1/photo-1')
    expect(sheetImageIdOf('answer-sheets/app-1/photo-1.jpg')).toBe('photo-1')
    expect(sheetImageIdOf(sheetImageKey('app-1', 'photo-1'))).toBe('photo-1')
  })

  it('has no photo for a correction typed by hand', () => {
    expect(sheetImageIdOf(undefined)).toBeUndefined()
    expect(sheetImageIdOf('answer-sheets/app-1/')).toBeUndefined()
  })
})
