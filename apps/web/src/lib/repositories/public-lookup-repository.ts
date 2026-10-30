import { publicLookupSchema } from '@/lib/schemas'
import { resolvePublicLookup } from '@/lib/public-lookup'
import { StorageError } from '@/lib/storage/errors'
import type { PublicLookup } from '@/types/domain'
import type { ApiClient } from './http/api-client'
import type { TeacherRepositories } from './index'

/**
 * What the page behind a printed QR code reads. One method, because the reader
 * has no account and the code is the whole credential: a reader that could list
 * or filter would be a way to enumerate other people's sheets.
 *
 * It is not part of `TeacherRepositories`, whose entries are all scoped to a
 * signed-in teacher and need a login that a student does not have.
 */
export interface PublicLookupRepository {
  findByCode: (code: string) => Promise<PublicLookup>
  /**
   * Whether the lookup reads this browser's data, which belongs to whoever is
   * signed in here, as the demo does: the page then waits for the session
   * first. The API needs none, since the code is the whole credential.
   */
  readsThisBrowser?: boolean
}

const UNEXPECTED_RESPONSE = 'O servidor respondeu num formato inesperado. Tente de novo em instantes.'

/**
 * The browser-only version, for the demo and the unit tests: every sheet lives
 * in this browser's storage, so it walks from the sheet outwards through the
 * teacher repositories and hands what it found to the same rule the API uses.
 */
export function createLocalPublicLookupRepository(repositories: TeacherRepositories): PublicLookupRepository {
  return {
    readsThisBrowser: true,

    async findByCode(code) {
      const sheet = await repositories.printing.findSheetByCode(code)
      if (sheet === null) return { status: 'INVALID_CODE' }

      const [versions, correction] = await Promise.all([
        repositories.printing.listVersions(sheet.applicationId),
        repositories.corrections.findByAnswerSheet(sheet.id),
      ])
      const version = versions.find((item) => item.id === sheet.examVersionId) ?? null

      const application = await repositories.applications.getById(sheet.applicationId)
      if (application === null) return { status: 'INVALID_CODE' }

      const [exam, group, students, bank] = await Promise.all([
        repositories.exams.getById(application.examId),
        repositories.classes.getById(application.classId),
        repositories.students.listByClass(application.classId),
        repositories.questions.list({ pageSize: 1000 }),
      ])

      const studentId = sheet.studentId ?? correction?.studentId
      const student = students.find((item) => item.id === studentId) ?? null

      return resolvePublicLookup({ sheet, version, application, exam, group, student, correction, bank: bank.items })
    },
  }
}

/**
 * The server does the walk: `GET /public/sheets/:code` answers the finished
 * `PublicLookup`, so nothing of the class or the question bank travels to the
 * browser. The code is encoded because it comes from the address bar.
 */
export function createHttpPublicLookupRepository(api: ApiClient): PublicLookupRepository {
  return {
    async findByCode(code) {
      const raw = await api.request('GET', `/public/sheets/${encodeURIComponent(code)}`)
      const parsed = publicLookupSchema.safeParse(raw)
      if (!parsed.success) throw new StorageError(UNEXPECTED_RESPONSE, 'failure', { cause: parsed.error })
      return parsed.data
    },
  }
}

/**
 * With an API client the lookup reads the server, which generates the sheets
 * since #46; without one, which is the demo and the unit tests, it reads the
 * sheets printed in this browser.
 */
export function createPublicLookupRepository(repositories: TeacherRepositories, api?: ApiClient): PublicLookupRepository {
  return api === undefined ? createLocalPublicLookupRepository(repositories) : createHttpPublicLookupRepository(api)
}
