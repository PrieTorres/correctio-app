import type { Correction } from '@/types/domain'
import { correctionSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'

export interface CorrectionRepository {
  listByAnswerSheets: (answerSheetIds: readonly string[]) => Promise<Correction[]>
  findByAnswerSheet: (answerSheetId: string) => Promise<Correction | null>
  save: (correction: Correction) => Promise<Correction>
  assignStudent: (correctionId: string, studentId: string) => Promise<Correction>
}

export function createLocalCorrectionRepository(): CorrectionRepository {
  const collection = createCollection('corrections', correctionSchema)

  /**
   * Two corrections for the same student on the same version is a conflict, not
   * an update: it means two sheets were read as the same person, and one of
   * them belongs to somebody else. Refusing loudly is the only way that gets
   * noticed before the grades go out.
   */
  const assertNoDuplicate = (correction: Correction, all: readonly Correction[]): void => {
    if (correction.studentId === undefined) return

    const clash = all.find(
      (item) =>
        item.id !== correction.id &&
        item.examVersionId === correction.examVersionId &&
        item.studentId === correction.studentId,
    )

    if (clash !== undefined) {
      throw new StorageError(
        'Já existe uma correção deste aluno nesta versão. Verifique se duas folhas foram lidas como a mesma pessoa.',
        'conflict',
      )
    }
  }

  return {
    async listByAnswerSheets(answerSheetIds) {
      await simulateLatency()
      const wanted = new Set(answerSheetIds)
      return collection.readAll().filter((item) => wanted.has(item.answerSheetId))
    },

    async findByAnswerSheet(answerSheetId) {
      await simulateLatency()
      return collection.readAll().find((item) => item.answerSheetId === answerSheetId) ?? null
    },

    async save(correction) {
      await simulateLatency()
      const all = collection.readAll()
      assertNoDuplicate(correction, all)

      const index = all.findIndex((item) => item.id === correction.id)
      collection.writeAll(index === -1 ? [...all, correction] : all.with(index, correction))
      return correction
    },

    async assignStudent(correctionId, studentId) {
      await simulateLatency()
      const all = collection.readAll()
      const index = all.findIndex((item) => item.id === correctionId)
      const correction = all[index]
      if (correction === undefined) throw new StorageError('Correção não encontrada.', 'not-found')

      const assigned: Correction = { ...correction, studentId, isAutomaticallyAssigned: false }
      assertNoDuplicate(assigned, all)

      collection.writeAll(all.with(index, assigned))
      return assigned
    },
  }
}
