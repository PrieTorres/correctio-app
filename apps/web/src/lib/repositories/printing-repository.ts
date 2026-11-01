import type { AnswerSheet, ExamVersion } from '@/types/domain'
import { answerSheetSchema, examVersionSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'

/**
 * The printed side of an application: its versions and the sheets handed out.
 *
 * Both belong to an application rather than to a teacher, so they do not fit
 * the owned-repository factory, and every method names the application. Only
 * the generation writes them (`ApplicationRepository.generate`); what a
 * teacher changes afterwards is whether students may see each answer key.
 */
export interface PrintingRepository {
  listVersions: (applicationId: string) => Promise<ExamVersion[]>
  listSheets: (applicationId: string) => Promise<AnswerSheet[]>
  /**
   * The sheet behind a printed code, which only the public lookup of this
   * browser asks for. On the API that lookup has a route of its own (#49),
   * which answers what a student may see rather than the sheet.
   */
  findSheetByCode: (code: string) => Promise<AnswerSheet | null>
  publishAnswerKey: (applicationId: string, versionId: string, published: boolean) => Promise<void>
  /** "Publicar todos": every version still unpublished, at once. */
  publishAll: (applicationId: string) => Promise<void>
}

/** The browser version also stores what a generation printed, which the API does on its own. */
export interface LocalPrintingRepository extends PrintingRepository {
  replaceForApplication: (applicationId: string, versions: ExamVersion[], sheets: AnswerSheet[]) => Promise<void>
}

const VERSION_NOT_FOUND = 'Versão não encontrada.'

export function createLocalPrintingRepository(): LocalPrintingRepository {
  const versions = createCollection('exam-versions', examVersionSchema)
  const sheets = createCollection('answer-sheets', answerSheetSchema)

  /** Publishing what is already published keeps the moment it first became public, as on the API. */
  const published = (version: ExamVersion, at: string): ExamVersion =>
    version.answerKeyPublished ? version : { ...version, answerKeyPublished: true, answerKeyPublishedAt: at }

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

    async publishAnswerKey(applicationId, versionId, publish) {
      await simulateLatency()
      const all = versions.readAll()
      const index = all.findIndex((item) => item.id === versionId && item.applicationId === applicationId)
      const version = all[index]
      if (version === undefined) throw new StorageError(VERSION_NOT_FOUND, 'not-found')

      const next = publish
        ? published(version, new Date().toISOString())
        : { ...version, answerKeyPublished: false, answerKeyPublishedAt: undefined }
      versions.writeAll(all.with(index, next))
    },

    async publishAll(applicationId) {
      await simulateLatency()
      const now = new Date().toISOString()
      versions.writeAll(
        versions.readAll().map((item) => (item.applicationId === applicationId ? published(item, now) : item)),
      )
    },
  }
}
