import { describe, expect, it } from 'vitest'
import { CORRECTION_STATUS } from '@/types/domain'
import { resolveCorrectionStatus } from '../correction-status'

describe('resolveCorrectionStatus', () => {
  it('completes an exam that has no open-ended questions', () => {
    expect(resolveCorrectionStatus([], [])).toBe(CORRECTION_STATUS.DONE)
  })

  it('stays open while an open-ended question has no score', () => {
    expect(resolveCorrectionStatus(['q1'], [])).toBe(CORRECTION_STATUS.IN_PROGRESS)
  })

  it('stays open while only some open-ended questions are scored', () => {
    expect(resolveCorrectionStatus(['q1', 'q2'], [{ questionId: 'q1', score: 2 }])).toBe(
      CORRECTION_STATUS.IN_PROGRESS,
    )
  })

  it('completes once every open-ended question carries a score', () => {
    expect(
      resolveCorrectionStatus(
        ['q1', 'q2'],
        [
          { questionId: 'q1', score: 2 },
          { questionId: 'q2', score: 1.5 },
        ],
      ),
    ).toBe(CORRECTION_STATUS.DONE)
  })

  it('treats a zero as a real grade, not as a missing one', () => {
    expect(resolveCorrectionStatus(['q1'], [{ questionId: 'q1', score: 0 }])).toBe(CORRECTION_STATUS.DONE)
  })

  it('ignores scores for questions the exam does not contain', () => {
    expect(resolveCorrectionStatus(['q1'], [{ questionId: 'ghost', score: 3 }])).toBe(
      CORRECTION_STATUS.IN_PROGRESS,
    )
  })
})
