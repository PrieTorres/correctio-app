import { describe, expect, it } from 'vitest'
import { pendingDiscursiveQuestionIds, resolveCorrectionStatus } from '../correction-status'

describe('resolveCorrectionStatus', () => {
  it('completes an exam that has no open-ended questions', () => {
    expect(resolveCorrectionStatus([], [])).toBe('concluida')
  })

  it('stays open while an open-ended question has no score', () => {
    expect(resolveCorrectionStatus(['q1'], [])).toBe('em_andamento')
  })

  it('stays open while only some open-ended questions are scored', () => {
    expect(resolveCorrectionStatus(['q1', 'q2'], [{ questionId: 'q1', score: 2 }])).toBe(
      'em_andamento',
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
    ).toBe('concluida')
  })

  it('treats a zero as a real grade, not as a missing one', () => {
    expect(resolveCorrectionStatus(['q1'], [{ questionId: 'q1', score: 0 }])).toBe('concluida')
  })

  it('ignores scores for questions the exam does not contain', () => {
    expect(resolveCorrectionStatus(['q1'], [{ questionId: 'ghost', score: 3 }])).toBe(
      'em_andamento',
    )
  })
})

describe('pendingDiscursiveQuestionIds', () => {
  it('returns nothing when everything is scored', () => {
    expect(pendingDiscursiveQuestionIds(['q1'], [{ questionId: 'q1', score: 1 }])).toEqual([])
  })

  it('lists what is missing, keeping the exam order', () => {
    expect(
      pendingDiscursiveQuestionIds(['q1', 'q2', 'q3'], [{ questionId: 'q2', score: 1 }]),
    ).toEqual(['q1', 'q3'])
  })

  it('lists every question when nothing was scored', () => {
    expect(pendingDiscursiveQuestionIds(['q1', 'q2'], [])).toEqual(['q1', 'q2'])
  })
})
