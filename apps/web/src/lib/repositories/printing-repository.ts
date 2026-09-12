import type { AnswerSheet, ExamVersion } from '@/types/domain'
import { answerSheetSchema, examVersionSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'

/**
 * The printed side of an application: its versions and the sheets handed out.
 *
 * Both belong to an application rather than to a teacher, so they do not fit
 * the owned-repository factory. They share a contract because they are always
 * written together — a version with no sheets prints nothing, and a sheet
 * without its version cannot be read back.
 */
export interface PrintingRepository {
  listVersions: (applicationId: string) => Promise<ExamVersion[]>
  listSheets: (applicationId: string) => Promise<AnswerSheet[]>
  findVersionByPublicCode: (publicCode: string) => Promise<ExamVersion | null>
  findSheetByCode: (code: string) => Promise<AnswerSheet | null>
  replaceForApplication: (
    applicationId: string,
    versions: ExamVersion[],
    sheets: AnswerSheet[],
  ) => Promise<void>
  publishAnswerKey: (versionId: string, published: boolean) => Promise<void>
}

export function createLocalPrintingRepository(): PrintingRepository {
  const versions = createCollection('exam-versions', examVersionSchema)
  const sheets = createCollection('answer-sheets', answerSheetSchema)

  return {
    async listVersions(applicationId) {
      await simulateLatency()
      return versions
        .readAll()
        .filter((item) => item.applicationId === applicationId)
        .toSorted((a, b) => a.versionNumber - b.versionNumber)
    },

    async listSheets(applicationId) {
      await simulateLatency()
      return sheets
        .readAll()
        .filter((item) => item.applicationId === applicationId)
        .toSorted((a, b) => a.sheetNumber - b.sheetNumber)
    },

    async findVersionByPublicCode(publicCode) {
      await simulateLatency()
      return versions.readAll().find((item) => item.publicCode === publicCode) ?? null
    },

    async findSheetByCode(code) {
      await simulateLatency()
      return sheets.readAll().find((item) => item.code === code) ?? null
    },

    /**
     * Regenerating replaces everything this application had printed.
     *
     * Keeping the old versions beside the new ones would leave two papers
     * claiming the same version number, and a sheet read afterwards could be
     * matched against the wrong layout. Whether regenerating is allowed at all
     * is decided above this, where the corrections can be seen.
     */
    async replaceForApplication(applicationId, nextVersions, nextSheets) {
      await simulateLatency(800)

      versions.writeAll([
        ...versions.readAll().filter((item) => item.applicationId !== applicationId),
        ...nextVersions,
      ])
      sheets.writeAll([
        ...sheets.readAll().filter((item) => item.applicationId !== applicationId),
        ...nextSheets,
      ])
    },

    async publishAnswerKey(versionId, published) {
      await simulateLatency()
      const all = versions.readAll()
      const index = all.findIndex((item) => item.id === versionId)
      const version = all[index]
      if (version === undefined) throw new StorageError('Versão não encontrada.', 'not-found')

      versions.writeAll(
        all.with(index, {
          ...version,
          answerKeyPublished: published,
          answerKeyPublishedAt: published ? new Date().toISOString() : undefined,
        }),
      )
    },
  }
}
