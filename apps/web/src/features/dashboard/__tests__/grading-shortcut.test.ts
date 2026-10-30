import { describe, expect, it } from 'vitest'
import { GRADING_SHORTCUT, gradingShortcut } from '../grading-shortcut'

describe('gradingShortcut', () => {
  it('has nowhere to go without an application to grade', () => {
    expect(gradingShortcut([])).toEqual({ kind: GRADING_SHORTCUT.NONE })
  })

  it('goes straight to the only application to grade', () => {
    expect(gradingShortcut([{ id: 'only' }])).toEqual({ kind: GRADING_SHORTCUT.ONE, application: { id: 'only' } })
  })

  it('offers every application to grade when there are several', () => {
    const several = [{ id: 'a' }, { id: 'b' }]
    expect(gradingShortcut(several)).toEqual({ kind: GRADING_SHORTCUT.CHOOSE, applications: several })
  })
})
