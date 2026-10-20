import type { Application } from '@/types/domain'

/**
 * Where "Corrigir folhas" on the panel leads. The upload screen (P15) belongs
 * to one application, so the shortcut cannot be a fixed link: it depends on how
 * many applications have their sheets printed.
 */
export const GRADING_SHORTCUT = Object.freeze({
  /** Nothing printed yet, so there is nothing to grade: the panel says how to get there. */
  NONE: 'NONE',
  /** One application to grade: straight to its upload screen. */
  ONE: 'ONE',
  /** Several: the teacher picks which one the photos belong to. */
  CHOOSE: 'CHOOSE',
} as const)

export type GradingShortcut<Item> =
  | { kind: typeof GRADING_SHORTCUT.NONE }
  | { kind: typeof GRADING_SHORTCUT.ONE; application: Item }
  | { kind: typeof GRADING_SHORTCUT.CHOOSE; applications: readonly Item[] }

/**
 * The applications whose sheets can be graded, the most recent first. Only a
 * `generated` one has sheets: a draft has not been printed, and a closed one
 * has left the list.
 */
export function gradableApplications<Item extends Pick<Application, 'status' | 'date'>>(applications: readonly Item[]): Item[] {
  return applications.filter((application) => application.status === 'generated').toSorted((a, b) => b.date.localeCompare(a.date))
}

/** The destination of the shortcut, from the applications that can be graded. */
export function gradingShortcut<Item>(gradable: readonly Item[]): GradingShortcut<Item> {
  const [first] = gradable
  if (first === undefined) return { kind: GRADING_SHORTCUT.NONE }
  return gradable.length === 1 ? { kind: GRADING_SHORTCUT.ONE, application: first } : { kind: GRADING_SHORTCUT.CHOOSE, applications: gradable }
}
