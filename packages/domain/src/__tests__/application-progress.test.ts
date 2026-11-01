import { describe, expect, it } from 'vitest'
import { correctionProgressOf } from '../application-progress'

describe('correctionProgressOf', () => {
  it('has not started while no sheet was read', () => {
    expect(correctionProgressOf({ corrections: 0, correctedSheets: 0 })).toBe('NOT_STARTED')
  })

  it('is in progress while any correction still waits for an open-ended score', () => {
    expect(correctionProgressOf({ corrections: 3, correctedSheets: 2 })).toBe('IN_PROGRESS')
  })

  /** A sheet of an absent student is never read, so the stage looks at the corrections that exist. */
  it('is done once every correction is confirmed, even with sheets nobody read', () => {
    expect(correctionProgressOf({ corrections: 2, correctedSheets: 2 })).toBe('DONE')
  })
})
