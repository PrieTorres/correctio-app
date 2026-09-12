import { describe, expect, it } from 'vitest'
import {
  CORRECTION_SOURCE,
  CORRECTION_STATUS,
  type Application,
  type Correction,
} from '@/types/domain'
import { canRegenerate } from '../regeneration'

function application(status: Application['status']): Application {
  return {
    id: 'app-1',
    examId: 'exam-1',
    classId: 'class-1',
    teacherId: 'ana',
    status,
    date: '2026-10-05T13:00:00.000Z',
    gradesReleased: false,
  }
}

function correction(id: string): Correction {
  return {
    id,
    examVersionId: 'version-1',
    answerSheetId: `sheet-${id}`,
    status: CORRECTION_STATUS.DONE,
    source: CORRECTION_SOURCE.MANUAL,
    objectiveResults: [],
    discursiveScores: [],
    totalScore: 10,
    confirmedAt: '2026-10-06T13:00:00.000Z',
    correctedBy: 'ana',
    isAutomaticallyAssigned: true,
  }
}

describe('canRegenerate', () => {
  it('allows a draft that nobody has corrected', () => {
    expect(canRegenerate(application('draft'), [])).toEqual({ allowed: true })
  })

  it('allows printing again when it was already generated but not corrected', () => {
    expect(canRegenerate(application('generated'), [])).toEqual({ allowed: true })
  })

  /** The reason a correction points at the version it was read from. */
  it('blocks once a single sheet has been corrected', () => {
    const verdict = canRegenerate(application('generated'), [correction('c1')])

    expect(verdict.allowed).toBe(false)
  })

  it('says how many corrections stand in the way', () => {
    const verdict = canRegenerate(application('generated'), [correction('c1'), correction('c2')])

    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('2 folhas')
  })

  it('says it in the singular for one correction', () => {
    const verdict = canRegenerate(application('generated'), [correction('c1')])

    if (!verdict.allowed) expect(verdict.reason).toContain('Uma folha')
  })

  it('blocks an archived application, and says to restore it first', () => {
    const verdict = canRegenerate(application('closed'), [])

    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('Restaure')
  })

  it('names the archive before the corrections when both apply', () => {
    const verdict = canRegenerate(application('closed'), [correction('c1')])

    if (!verdict.allowed) expect(verdict.reason).toContain('arquivada')
  })
})
