import { describe, expect, it } from 'vitest'
import { CORRECTION_STATUS } from '@/types/domain'
import { applicationIdsInProgress, countPendingCorrections, isPendingCorrection } from '../pending'

const IN_PROGRESS = CORRECTION_STATUS.IN_PROGRESS
const DONE = CORRECTION_STATUS.DONE

describe('isPendingCorrection', () => {
  it('is pending while an open-ended score is missing, even with a student', () => {
    expect(isPendingCorrection({ status: IN_PROGRESS, studentId: 's1' })).toBe(true)
  })

  it('is pending while no student is attached, even when fully scored', () => {
    expect(isPendingCorrection({ status: DONE, studentId: undefined })).toBe(true)
  })

  it('is not pending once scored and attached to a student', () => {
    expect(isPendingCorrection({ status: DONE, studentId: 's1' })).toBe(false)
  })
})

describe('countPendingCorrections', () => {
  /** A sheet that owes both counts once: the panel counts sheets to deal with. */
  it('counts a correction that is both in progress and unassigned once', () => {
    expect(
      countPendingCorrections([
        { status: IN_PROGRESS, studentId: undefined },
        { status: IN_PROGRESS, studentId: 's1' },
        { status: DONE, studentId: undefined },
        { status: DONE, studentId: 's2' },
      ]),
    ).toBe(3)
  })

  it('counts nothing for an empty list', () => {
    expect(countPendingCorrections([])).toBe(0)
  })
})

describe('applicationIdsInProgress', () => {
  it('keeps only the applications with a correction in progress', () => {
    const correction = (status: typeof IN_PROGRESS | typeof DONE) => ({ status, studentId: 's1' }) as never
    const byApplication = new Map([
      ['waiting', [correction(DONE), correction(IN_PROGRESS)]],
      ['finished', [correction(DONE)]],
      ['untouched', []],
    ])

    expect([...applicationIdsInProgress(byApplication)]).toEqual(['waiting'])
  })
})
