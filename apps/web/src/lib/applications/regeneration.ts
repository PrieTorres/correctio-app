import type { Application, Correction } from '@/types/domain'

export type RegenerationVerdict =
  | { allowed: true }
  | { allowed: false; reason: string }

/**
 * Decides whether an application may be printed again.
 *
 * Regenerating replaces every version and every sheet, and a correction points
 * at the version it was read from. Once any sheet has been corrected, replacing
 * the paper would leave those corrections describing a layout that no longer
 * exists — the marks would be matched against the wrong questions, silently.
 *
 * Nothing else blocks it. Reprinting before anyone has been corrected is a
 * normal thing to want: a version got lost, the class grew, the date moved.
 */
export function canRegenerate(
  application: Application,
  corrections: readonly Correction[],
): RegenerationVerdict {
  if (application.status === 'closed') {
    return { allowed: false, reason: 'Esta aplicação está arquivada. Restaure antes de gerar.' }
  }

  if (corrections.length > 0) {
    return {
      allowed: false,
      reason:
        corrections.length === 1
          ? 'Uma folha desta aplicação já foi corrigida. Gerar de novo trocaria as versões e as correções deixariam de bater com a prova impressa.'
          : `${corrections.length} folhas desta aplicação já foram corrigidas. Gerar de novo trocaria as versões e as correções deixariam de bater com a prova impressa.`,
    }
  }

  return { allowed: true }
}
