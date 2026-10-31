import { CORRECTION_PROGRESS, type ApplicationProgress, type CorrectionProgress } from './domain';

/**
 * Where the correction of an application stands, read from its progress: the
 * same three stages the API filters the list by (`CORRECTION_PROGRESS`). A
 * correction is either confirmed or still waiting for an open-ended score, so
 * the corrections that are not among the corrected sheets are the ones
 * waiting. The browser version of the list filters with this, and P11 names
 * the stage of each application with it.
 */
export function correctionProgressOf(
  progress: Pick<ApplicationProgress, 'corrections' | 'correctedSheets'>,
): CorrectionProgress {
  if (progress.corrections === 0) return CORRECTION_PROGRESS.NOT_STARTED;
  return progress.corrections > progress.correctedSheets ? CORRECTION_PROGRESS.IN_PROGRESS : CORRECTION_PROGRESS.DONE;
}
