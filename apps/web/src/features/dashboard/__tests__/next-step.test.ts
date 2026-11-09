import { describe, expect, it } from 'vitest'
import type { DashboardOpenApplication, DashboardSummary } from '@/lib/reports'
import { applicationStepOf, NEXT_STEP, nextStepOf } from '../next-step'

/** Noon UTC of the day, the stored form `todayAsStored` gives. */
const TODAY = '2026-11-10T12:00:00.000Z'
const day = (offset: number) => new Date(Date.parse(TODAY) + offset * 24 * 60 * 60 * 1000).toISOString()

const READY: DashboardSummary = {
  classes: 1,
  questions: 10,
  exams: 1,
  applications: 0,
  pendingCorrections: 0,
  recent: [],
  gradable: [],
  students: 30,
  open: [],
}

/** A printed application sat `offset` days from today, 30 sheets, two versions, nothing graded unless told. */
function printed(id: string, offset: number, progress: Partial<DashboardOpenApplication['progress']> = {}): DashboardOpenApplication {
  return {
    id,
    title: `Prova ${id}`,
    detail: 'Turma A',
    date: day(offset),
    status: 'generated',
    progress: { versions: 2, publishedAnswerKeys: 0, sheets: 30, correctedSheets: 0, corrections: 0, ...progress },
  }
}

function draft(id: string, offset: number): DashboardOpenApplication {
  return { ...printed(id, offset), status: 'draft', progress: { versions: 0, publishedAnswerKeys: 0, sheets: 0, correctedSheets: 0, corrections: 0 } }
}

const withOpen = (...open: DashboardOpenApplication[]): DashboardSummary => ({ ...READY, applications: open.length, open })

describe('applicationStepOf', () => {
  it('asks to print a draft', () => {
    expect(applicationStepOf(draft('d', 3), TODAY)).toBe(NEXT_STEP.GENERATE_PDF)
  })

  it('asks to print the paper of a sitting still ahead, and to grade it once its day comes', () => {
    expect(applicationStepOf(printed('p', 2), TODAY)).toBe(NEXT_STEP.PRINT_SHEETS)
    expect(applicationStepOf(printed('p', 0), TODAY)).toBe(NEXT_STEP.GRADE_SHEETS)
  })

  /** A sheet already sent says the sitting took place, whatever date was typed. */
  it('takes a sheet already sent over the date', () => {
    expect(applicationStepOf(printed('p', 5, { corrections: 1 }), TODAY)).toBe(NEXT_STEP.GRADE_SHEETS)
  })

  it('follows the correction through the open-ended scores, the answer key and the grades', () => {
    expect(applicationStepOf(printed('p', -1, { corrections: 30, correctedSheets: 28 }), TODAY)).toBe(NEXT_STEP.SCORE_OPEN_ENDED)
    expect(applicationStepOf(printed('p', -1, { corrections: 30, correctedSheets: 30, publishedAnswerKeys: 1 }), TODAY)).toBe(NEXT_STEP.PUBLISH_ANSWER_KEY)
    expect(applicationStepOf(printed('p', -1, { corrections: 30, correctedSheets: 30, publishedAnswerKeys: 2 }), TODAY)).toBe(NEXT_STEP.RELEASE_GRADES)
  })
})

describe('nextStepOf', () => {
  describe('a teacher still setting up', () => {
    it('starts with a class', () => {
      expect(nextStepOf({ ...READY, classes: 0, students: 0 }, TODAY)).toEqual({ kind: NEXT_STEP.CREATE_CLASS })
    })

    it('then its students, in the class that has none', () => {
      const summary = { ...READY, students: 0, classWithoutStudents: { id: 'c1', name: 'Turma A' } }
      expect(nextStepOf(summary, TODAY)).toEqual({ kind: NEXT_STEP.ADD_STUDENTS, schoolClass: { id: 'c1', name: 'Turma A' } })
    })

    it('then the questions, the exam and the application', () => {
      expect(nextStepOf({ ...READY, questions: 0, exams: 0 }, TODAY)).toEqual({ kind: NEXT_STEP.WRITE_QUESTIONS })
      expect(nextStepOf({ ...READY, exams: 0 }, TODAY)).toEqual({ kind: NEXT_STEP.BUILD_EXAM })
      expect(nextStepOf(READY, TODAY)).toEqual({ kind: NEXT_STEP.APPLY_EXAM })
    })

    /** Nobody would get a paper, so printing the draft would be refused. */
    it('asks for the students before printing a draft for nobody', () => {
      const summary = { ...withOpen(draft('d', 0)), students: 0, classWithoutStudents: { id: 'c1', name: 'Turma A' } }
      expect(nextStepOf(summary, TODAY)).toMatchObject({ kind: NEXT_STEP.ADD_STUDENTS })
    })
  })

  describe('a teacher at work', () => {
    it('sends them to grade the sheets of a sitting that took place', () => {
      expect(nextStepOf(withOpen(printed('p', -1)), TODAY)).toMatchObject({ kind: NEXT_STEP.GRADE_SHEETS, application: { id: 'p' } })
    })

    it('puts the paper for today or tomorrow before the sheets already in hand', () => {
      const summary = withOpen(printed('graded', -2), draft('tomorrow', 1))
      expect(nextStepOf(summary, TODAY)).toMatchObject({ kind: NEXT_STEP.GENERATE_PDF, application: { id: 'tomorrow' } })
    })

    it('puts the sheets in hand before a draft further away', () => {
      const summary = withOpen(draft('later', 9), printed('graded', -2))
      expect(nextStepOf(summary, TODAY)).toMatchObject({ kind: NEXT_STEP.GRADE_SHEETS, application: { id: 'graded' } })
    })

    it('puts grading before the answer key, and the answer key before the grades', () => {
      const publish = printed('publish', -5, { corrections: 30, correctedSheets: 30 })
      const release = printed('release', -6, { corrections: 30, correctedSheets: 30, publishedAnswerKeys: 2 })
      expect(nextStepOf(withOpen(release, publish, printed('grade', -9)), TODAY)).toMatchObject({ kind: NEXT_STEP.GRADE_SHEETS })
      expect(nextStepOf(withOpen(release, publish), TODAY)).toMatchObject({ kind: NEXT_STEP.PUBLISH_ANSWER_KEY })
      expect(nextStepOf(withOpen(release), TODAY)).toMatchObject({ kind: NEXT_STEP.RELEASE_GRADES })
    })

    /** The list arrives the most recent day first: that pile is the one on the desk. */
    it('of two sittings to grade, takes the latest', () => {
      expect(nextStepOf(withOpen(printed('yesterday', -1), printed('last-week', -7)), TODAY)).toMatchObject({ application: { id: 'yesterday' } })
    })

    it('of two sittings ahead, takes the nearest', () => {
      expect(nextStepOf(withOpen(printed('next-month', 30), printed('next-week', 7)), TODAY)).toMatchObject({
        kind: NEXT_STEP.PRINT_SHEETS,
        application: { id: 'next-week' },
      })
    })

    it('lists the other open applications with their own step, the most urgent first', () => {
      const step = nextStepOf(withOpen(printed('ahead', 5), printed('graded', -1), draft('far', 20)), TODAY)
      expect(step).toMatchObject({ kind: NEXT_STEP.GRADE_SHEETS })
      expect('others' in step ? step.others.map((other) => [other.kind, other.application.id]) : []).toEqual([
        [NEXT_STEP.GENERATE_PDF, 'far'],
        [NEXT_STEP.PRINT_SHEETS, 'ahead'],
      ])
    })
  })

  it('sends a teacher whose grades are all released to the report of the latest application', () => {
    const latest = { id: 'a1', title: 'Prova', detail: 'Turma A', date: day(-3) }
    expect(nextStepOf({ ...READY, applications: 1, recent: [latest] }, TODAY)).toEqual({ kind: NEXT_STEP.VIEW_REPORT, application: latest })
  })

  /** After 21h in Brazil it is already tomorrow in UTC; the stored day is what counts, not the instant. */
  it('counts days by the stored day, not by the instant', () => {
    const lateEvening = '2026-11-10T23:30:00.000Z'
    expect(nextStepOf(withOpen(draft('tomorrow', 1)), lateEvening)).toMatchObject({ kind: NEXT_STEP.GENERATE_PDF })
    expect(applicationStepOf(printed('today', 0), lateEvening)).toBe(NEXT_STEP.GRADE_SHEETS)
  })
})
