import { CORRECTION_STATUS } from '@/types/domain'
import type { Application, Correction } from '@/types/domain'
import type { TeacherRepositories } from '@/lib/repositories'

/**
 * A correction is pending while the teacher still owes it something: an
 * open-ended score (RF48) or the student it belongs to (RF31). Either one
 * alone is enough, and a correction that owes both counts once, because the
 * panel counts sheets to deal with, not reasons.
 */
export function isPendingCorrection(correction: Pick<Correction, 'status' | 'studentId'>): boolean {
  return correction.status === CORRECTION_STATUS.IN_PROGRESS || correction.studentId === undefined
}

export function countPendingCorrections(corrections: readonly Pick<Correction, 'status' | 'studentId'>[]): number {
  return corrections.filter(isPendingCorrection).length
}

/** Corrections of each application, keyed by the application id. */
export type CorrectionsByApplication = ReadonlyMap<string, readonly Correction[]>

/**
 * Reads the corrections behind each application.
 *
 * Reached through the sheets because a correction does not name its
 * application. Starting from the teacher's own applications is also what keeps
 * another teacher's corrections out of the count.
 */
export async function loadCorrectionsByApplication(
  { printing, corrections }: Pick<TeacherRepositories, 'printing' | 'corrections'>,
  applications: readonly Pick<Application, 'id'>[],
): Promise<CorrectionsByApplication> {
  const entries = await Promise.all(
    applications.map(async ({ id }) => {
      const sheets = await printing.listSheets(id)
      const found = await corrections.listByAnswerSheets(sheets.map((sheet) => sheet.id))
      return [id, found] as const
    }),
  )

  return new Map(entries)
}

/** The applications with at least one correction still waiting for a score. */
export function applicationIdsInProgress(byApplication: CorrectionsByApplication): Set<string> {
  const ids = new Set<string>()
  for (const [id, corrections] of byApplication) {
    if (corrections.some((item) => item.status === CORRECTION_STATUS.IN_PROGRESS)) ids.add(id)
  }
  return ids
}
