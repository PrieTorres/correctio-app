import { describe, expect, it } from 'vitest'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type Application, type Correction } from '../domain'
import { canRegenerate } from '../regeneration'

function application(status: Application['status'], gradesReleased = false): Application {
  return {
    id: 'app-1',
    examId: 'exam-1',
    classId: 'class-1',
    teacherId: 'ana',
    status,
    date: '2026-10-05T13:00:00.000Z',
    gradesReleased,
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
    clientCorrectionId: `client-${id}`,
    syncStatus: 'synced',
  }
}

const refusedFor = (reason: string) => ({ allowed: false, reason: expect.stringContaining(reason) as string })

describe('canRegenerate', () => {
  it('allows a draft that nobody has corrected', () => {
    expect(canRegenerate(application('draft'), [])).toEqual({ allowed: true })
  })

  it('allows printing again when it was already generated but not corrected', () => {
    expect(canRegenerate(application('generated'), [])).toEqual({ allowed: true })
  })

  /** The reason a correction points at the version it was read from. */
  it('blocks once a single sheet has been corrected, saying it in the singular', () => {
    expect(canRegenerate(application('generated'), [correction('c1')])).toEqual(refusedFor('Uma folha'))
  })

  it('says how many corrections stand in the way', () => {
    expect(canRegenerate(application('generated'), [correction('c1'), correction('c2')])).toEqual(refusedFor('2 folhas'))
  })

  it('reads only which corrections exist, as the API counts them', () => {
    expect(canRegenerate(application('generated'), [{ id: 'c1' }])).toEqual(refusedFor('Uma folha'))
  })

  it('blocks an archived application, and says to restore it first', () => {
    expect(canRegenerate(application('closed'), [])).toEqual(refusedFor('Restaure'))
  })

  it('names the archive before the corrections when both apply', () => {
    expect(canRegenerate(application('closed'), [correction('c1')])).toEqual(refusedFor('arquivada'))
  })

  /** The new versions are born with their key unpublished, and a grade never shows without it (RF46). */
  it('blocks while the grades are released, and says to take them back first', () => {
    expect(canRegenerate(application('generated', true), [])).toEqual(refusedFor('Recolha as notas'))
  })

  it('names the corrections before the released grades, since taking the grades back would not be enough', () => {
    expect(canRegenerate(application('generated', true), [correction('c1')])).toEqual(refusedFor('Uma folha'))
  })
})
