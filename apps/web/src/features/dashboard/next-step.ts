import type { DashboardActivity, DashboardClass, DashboardOpenApplication, DashboardSummary } from '@/lib/reports'

/**
 * The one thing the panel asks the teacher to do next (#202), from where their
 * work stands. A teacher with sheets to grade is sent to grade them; one who
 * is still setting up is sent to the step that is missing, in the order the
 * work goes: class, students, questions, exam, application.
 */
export const NEXT_STEP = Object.freeze({
  GENERATE_PDF: 'GENERATE_PDF',
  GRADE_SHEETS: 'GRADE_SHEETS',
  SCORE_OPEN_ENDED: 'SCORE_OPEN_ENDED',
  PUBLISH_ANSWER_KEY: 'PUBLISH_ANSWER_KEY',
  RELEASE_GRADES: 'RELEASE_GRADES',
  PRINT_SHEETS: 'PRINT_SHEETS',
  CREATE_CLASS: 'CREATE_CLASS',
  ADD_STUDENTS: 'ADD_STUDENTS',
  WRITE_QUESTIONS: 'WRITE_QUESTIONS',
  BUILD_EXAM: 'BUILD_EXAM',
  APPLY_EXAM: 'APPLY_EXAM',
  VIEW_REPORT: 'VIEW_REPORT',
} as const)

type Kind<Key extends keyof typeof NEXT_STEP> = (typeof NEXT_STEP)[Key]

/** The steps that belong to one open application. */
export type ApplicationStepKind = Kind<
  'GENERATE_PDF' | 'GRADE_SHEETS' | 'SCORE_OPEN_ENDED' | 'PUBLISH_ANSWER_KEY' | 'RELEASE_GRADES' | 'PRINT_SHEETS'
>

/** One open application and what it is waiting for. */
export interface ApplicationStep {
  kind: ApplicationStepKind
  application: DashboardOpenApplication
}

export type NextStep =
  | { kind: Kind<'CREATE_CLASS' | 'WRITE_QUESTIONS' | 'BUILD_EXAM' | 'APPLY_EXAM'> }
  | { kind: Kind<'ADD_STUDENTS'>; schoolClass: DashboardClass }
  | { kind: Kind<'VIEW_REPORT'>; application: DashboardActivity }
  | (ApplicationStep & { others: readonly ApplicationStep[] })

const DAY_MS = 24 * 60 * 60 * 1000

/** The calendar day of a stored timestamp (noon UTC of the day the teacher picked). */
const dayOf = (timestamp: string) => timestamp.slice(0, 10)

/** Whole days from `today` to the day of `timestamp`, negative for a day gone by. */
function daysFrom(today: string, timestamp: string): number {
  return Math.round((Date.parse(`${dayOf(timestamp)}T12:00:00Z`) - Date.parse(`${dayOf(today)}T12:00:00Z`)) / DAY_MS)
}

/**
 * Whether the sitting already took place: its day has come, or a sheet of it
 * was already sent, which a wrong date in the system cannot argue with.
 */
function happened(application: DashboardOpenApplication, today: string): boolean {
  return daysFrom(today, application.date) <= 0 || application.progress.corrections > 0
}

/**
 * What one open application waits for. Printed and not yet sat, it waits to be
 * printed; sat, it goes through the correction, the answer key and the grades,
 * in that order, since each needs the one before.
 */
export function applicationStepOf(application: DashboardOpenApplication, today: string): ApplicationStepKind {
  const { progress } = application
  if (application.status === 'draft') return NEXT_STEP.GENERATE_PDF
  if (!happened(application, today)) return NEXT_STEP.PRINT_SHEETS
  if (progress.corrections < progress.sheets) return NEXT_STEP.GRADE_SHEETS
  if (progress.corrections > progress.correctedSheets) return NEXT_STEP.SCORE_OPEN_ENDED
  if (progress.publishedAnswerKeys < progress.versions) return NEXT_STEP.PUBLISH_ANSWER_KEY
  return NEXT_STEP.RELEASE_GRADES
}

/**
 * How urgent a step is, the lowest first. A paper to print for today or
 * tomorrow comes before everything, since the class will not wait; then the
 * sheets already in hand, through to the grades the students wait for; a
 * draft further away and a printed exam not yet sat come last.
 */
function urgencyOf({ kind, application }: ApplicationStep, today: string): number {
  if (kind === NEXT_STEP.GENERATE_PDF) return [0, 1].includes(daysFrom(today, application.date)) ? 0 : 5
  const order: readonly ApplicationStepKind[] = [
    NEXT_STEP.GRADE_SHEETS,
    NEXT_STEP.SCORE_OPEN_ENDED,
    NEXT_STEP.PUBLISH_ANSWER_KEY,
    NEXT_STEP.RELEASE_GRADES,
  ]
  return order.includes(kind) ? 1 + order.indexOf(kind) : 6
}

/**
 * Among steps equally urgent, the one to do first: of the sittings that took
 * place, the latest, which is the pile on the desk; of those still ahead, the
 * nearest. The list arrives the most recent day first, and the sort keeps
 * that order for the first case.
 */
function byUrgency(today: string) {
  return (a: ApplicationStep, b: ApplicationStep): number => {
    const urgency = urgencyOf(a, today) - urgencyOf(b, today)
    if (urgency !== 0) return urgency
    if (happened(a.application, today) && happened(b.application, today)) return 0
    return Math.abs(daysFrom(today, a.application.date)) - Math.abs(daysFrom(today, b.application.date))
  }
}

/** The step when no open application asks for anything: what is missing to get one. */
function setupStepOf(summary: DashboardSummary): NextStep {
  if (summary.classes === 0) return { kind: NEXT_STEP.CREATE_CLASS }
  if (summary.students === 0 && summary.classWithoutStudents !== undefined) {
    return { kind: NEXT_STEP.ADD_STUDENTS, schoolClass: summary.classWithoutStudents }
  }
  if (summary.questions === 0 && summary.exams === 0) return { kind: NEXT_STEP.WRITE_QUESTIONS }
  if (summary.exams === 0) return { kind: NEXT_STEP.BUILD_EXAM }
  const [latest] = summary.recent
  if (summary.applications === 0 || latest === undefined) return { kind: NEXT_STEP.APPLY_EXAM }
  return { kind: NEXT_STEP.VIEW_REPORT, application: latest }
}

/**
 * The next step of the panel. `today` is the stored form of the teacher's day
 * (`todayAsStored`), passed in so the rule never reads the clock.
 *
 * A draft cannot be printed for a class with no student to get a paper, so
 * without any such student the step is to register them first.
 */
export function nextStepOf(summary: DashboardSummary, today: string): NextStep {
  const steps = summary.open
    .map((application): ApplicationStep => ({ kind: applicationStepOf(application, today), application }))
    .toSorted(byUrgency(today))
  const [first, ...others] = steps
  if (first === undefined) return setupStepOf(summary)
  if (first.kind === NEXT_STEP.GENERATE_PDF && summary.students === 0 && summary.classWithoutStudents !== undefined) {
    return { kind: NEXT_STEP.ADD_STUDENTS, schoolClass: summary.classWithoutStudents }
  }
  return { ...first, others }
}
