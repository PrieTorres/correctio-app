import type { Correction } from '@/types/domain'
import { correctionSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'

/**
 * Corrections, read here only to answer whether an application may be printed
 * again. Writing them is the grading step's business, and this contract grows
 * there rather than guessing now what it will need.
 */
export interface CorrectionRepository {
  listByAnswerSheets: (answerSheetIds: readonly string[]) => Promise<Correction[]>
}

export function createLocalCorrectionRepository(): CorrectionRepository {
  const collection = createCollection('corrections', correctionSchema)

  return {
    async listByAnswerSheets(answerSheetIds) {
      await simulateLatency()
      const wanted = new Set(answerSheetIds)
      return collection.readAll().filter((item) => wanted.has(item.answerSheetId))
    },
  }
}
