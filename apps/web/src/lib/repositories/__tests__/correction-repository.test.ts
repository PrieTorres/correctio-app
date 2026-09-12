import { beforeEach, describe, expect, it } from 'vitest'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type Correction } from '@/types/domain'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalCorrectionRepository } from '../correction-repository'

function correction(overrides: Partial<Correction> = {}): Correction {
  return {
    id: 'correction-1',
    examVersionId: 'version-1',
    answerSheetId: 'sheet-1',
    status: CORRECTION_STATUS.DONE,
    source: CORRECTION_SOURCE.IMAGE_UPLOAD,
    objectiveResults: [],
    discursiveScores: [],
    totalScore: 10,
    confirmedAt: '2026-10-06T12:00:00.000Z',
    correctedBy: 'ana',
    isAutomaticallyAssigned: true,
    ...overrides,
  }
}

describe('correction repository', () => {
  beforeEach(clearAllCollections)

  it('saves a correction and finds it by the sheet it came from', async () => {
    const repository = createLocalCorrectionRepository()

    await repository.save(correction())

    expect((await repository.findByAnswerSheet('sheet-1'))?.id).toBe('correction-1')
  })

  it('reports nothing for a sheet nobody has read', async () => {
    const repository = createLocalCorrectionRepository()

    expect(await repository.findByAnswerSheet('sheet-9')).toBeNull()
  })

  it('replaces a correction rather than storing it twice', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction())

    await repository.save(correction({ totalScore: 7 }))

    const stored = await repository.listByAnswerSheets(['sheet-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0]?.totalScore).toBe(7)
  })

  it('lists only the corrections of the sheets asked for', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction())
    await repository.save(correction({ id: 'correction-2', answerSheetId: 'sheet-2' }))

    expect(await repository.listByAnswerSheets(['sheet-2'])).toHaveLength(1)
  })

  /**
   * Two sheets read as the same person means one of them belongs to somebody
   * else, and nobody finds out once the grades are out.
   */
  it('refuses a second correction of the same student on the same version', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction({ studentId: 'student-1' }))

    await expect(
      repository.save(
        correction({ id: 'correction-2', answerSheetId: 'sheet-2', studentId: 'student-1' }),
      ),
    ).rejects.toThrow(/mesma pessoa/i)
  })

  it('allows the same student on a different version, which is a second sitting', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction({ studentId: 'student-1' }))

    await expect(
      repository.save(
        correction({
          id: 'correction-2',
          answerSheetId: 'sheet-2',
          examVersionId: 'version-2',
          studentId: 'student-1',
        }),
      ),
    ).resolves.toBeDefined()
  })

  it('allows several corrections with nobody assigned yet', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction())

    await expect(
      repository.save(correction({ id: 'correction-2', answerSheetId: 'sheet-2' })),
    ).resolves.toBeDefined()
  })

  it('assigns a student, recording that a person chose', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction())

    const assigned = await repository.assignStudent('correction-1', 'student-7')

    expect(assigned.studentId).toBe('student-7')
    expect(assigned.isAutomaticallyAssigned).toBe(false)
  })

  it('refuses to assign a student who already has a correction on that version', async () => {
    const repository = createLocalCorrectionRepository()
    await repository.save(correction({ studentId: 'student-1' }))
    await repository.save(correction({ id: 'correction-2', answerSheetId: 'sheet-2' }))

    await expect(repository.assignStudent('correction-2', 'student-1')).rejects.toThrow(
      /mesma pessoa/i,
    )
  })

  it('says so when asked to assign a correction that is not there', async () => {
    const repository = createLocalCorrectionRepository()

    await expect(repository.assignStudent('nope', 'student-1')).rejects.toThrow(/não encontrada/i)
  })
})
