import type { Application } from './domain'

export type RegenerationVerdict =
  | { allowed: true }
  | { allowed: false; reason: string }

const ARCHIVED = 'Esta aplicação está arquivada. Restaure antes de gerar.'

const GRADES_RELEASED = 'As notas desta aplicação estão liberadas. Recolha as notas antes de gerar de novo.'

const PAPER_WOULD_NOT_MATCH =
  'Gerar de novo trocaria as versões e as correções deixariam de bater com a prova impressa.'

function correctedReason(count: number): string {
  return count === 1
    ? `Uma folha desta aplicação já foi corrigida. ${PAPER_WOULD_NOT_MATCH}`
    : `${count} folhas desta aplicação já foram corrigidas. ${PAPER_WOULD_NOT_MATCH}`
}

/**
 * Decides whether an application may be printed again: the screen asks before
 * offering the button, and the API asks again under lock before replacing
 * anything, so both refuse for the same reason.
 *
 * Regenerating replaces every version and every sheet, and a correction points
 * at the version it was read from. Once any sheet has been corrected, replacing
 * the paper would leave those corrections describing a layout that no longer
 * exists — the marks would be matched against the wrong questions, silently.
 *
 * Released grades block it too: the new versions are born with their answer
 * key unpublished, and a grade never shows without its key (RF46). Taking the
 * grades back is the teacher's call, so it is asked for rather than done here.
 *
 * Nothing else blocks it. Reprinting before anyone has been corrected is a
 * normal thing to want: a version got lost, the class grew, the date moved.
 *
 * It takes how many corrections exist, confirmed or not, which is what the
 * API counts under lock and what `ApplicationProgress.corrections` tells the
 * screens, so P13 and P14 explain the refusal before anyone asks the server.
 */
export function canRegenerate(
  application: Pick<Application, 'status' | 'gradesReleased'>,
  correctionCount: number,
): RegenerationVerdict {
  if (application.status === 'closed') return { allowed: false, reason: ARCHIVED }
  if (correctionCount > 0) return { allowed: false, reason: correctedReason(correctionCount) }
  if (application.gradesReleased) return { allowed: false, reason: GRADES_RELEASED }
  return { allowed: true }
}
