import type { Application, Correction } from './domain'

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
 */
export function canRegenerate(
  application: Pick<Application, 'status' | 'gradesReleased'>,
  corrections: readonly Pick<Correction, 'id'>[],
): RegenerationVerdict {
  if (application.status === 'closed') return { allowed: false, reason: ARCHIVED }
  if (corrections.length > 0) return { allowed: false, reason: correctedReason(corrections.length) }
  if (application.gradesReleased) return { allowed: false, reason: GRADES_RELEASED }
  return { allowed: true }
}
