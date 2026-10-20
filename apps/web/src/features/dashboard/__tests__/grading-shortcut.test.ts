import { describe, expect, it } from 'vitest'
import type { ApplicationStatus } from '@/types/domain'
import { GRADING_SHORTCUT, gradableApplications, gradingShortcut } from '../grading-shortcut'

const application = (id: string, status: ApplicationStatus, date: string) => ({ id, status, date })

describe('gradableApplications', () => {
  /** A draft has no sheets yet, and a closed application has left the list. */
  it('keeps only the applications with printed sheets, the most recent first', () => {
    const applications = [
      application('old', 'generated', '2026-09-20T12:00:00.000Z'),
      application('draft', 'draft', '2026-10-15T12:00:00.000Z'),
      application('new', 'generated', '2026-10-10T12:00:00.000Z'),
      application('closed', 'closed', '2026-10-12T12:00:00.000Z'),
    ]

    expect(gradableApplications(applications).map((item) => item.id)).toEqual(['new', 'old'])
  })
})

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
