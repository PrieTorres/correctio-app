import type { Application, ApplicationStatus } from '@correctio/domain'
import type { Kysely, Selectable } from 'kysely'
import { dayContains } from '../db/text-search'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { ApplicationsTable, Database } from '../models/tables'

/** The fields of `Application` in the contract; `createdAt` and `updatedAt` are technical and stay in the database. */
const APPLICATION_COLUMNS = ['id', 'examId', 'classId', 'teacherId', 'status', 'pdfUrl', 'date', 'gradesReleased'] as const

type ApplicationRow = Pick<Selectable<ApplicationsTable>, (typeof APPLICATION_COLUMNS)[number]>

/** The status of an archived application (RF42); `draft` and `generated` are the active ones. */
const ARCHIVED: ApplicationStatus = 'closed'

/**
 * An application as stored. The `pdfUrl` column keeps the key of the PDF in
 * the file storage, not an address (`docs/adr/ADR-004`), so it travels here as
 * `pdfKey`; the service turns it into the address the API serves the file at,
 * and the key itself never reaches a client.
 */
export type StoredApplication = Omit<Application, 'pdfUrl'> & { pdfKey?: string }

/** The filters of P11, all optional, on top of the shared list parameters. */
export interface ApplicationFilters extends PageRequest {
  classId?: string
  examId?: string
  status?: ApplicationStatus
}

export interface ApplicationRepository {
  /** Active or archived applications, searched by the day they happen, the oldest first. */
  list: (teacherId: string, filters: ApplicationFilters) => Promise<Page<StoredApplication>>
  findById: (teacherId: string, id: string) => Promise<StoredApplication | undefined>
  setStatus: (teacherId: string, id: string, status: ApplicationStatus) => Promise<void>
  setGradesReleased: (teacherId: string, id: string, released: boolean) => Promise<void>
}

function toStoredApplication(row: ApplicationRow): StoredApplication {
  return {
    id: row.id,
    examId: row.examId,
    classId: row.classId,
    teacherId: row.teacherId,
    status: row.status,
    date: row.date.toISOString(),
    gradesReleased: row.gradesReleased,
    ...(row.pdfUrl !== null && { pdfKey: row.pdfUrl }),
  }
}

/**
 * Every query is scoped by `teacherId` here, so no service can forget it: an
 * application of another teacher is simply not found (`docs/Seguranca_e_LGPD.md`,
 * section 2). The list is ordered by date because an application is an event,
 * and the one a teacher looks for is the one of a given day.
 */
export function createApplicationRepository(db: Kysely<Database>): ApplicationRepository {
  const owned = (teacherId: string) => db.selectFrom('applications').where('teacherId', '=', teacherId)
  const ownedUpdate = (teacherId: string, id: string) =>
    db.updateTable('applications').where('teacherId', '=', teacherId).where('id', '=', id)

  /** Every filter applies before paging, so `total` counts what the filters let through. */
  function filtered(teacherId: string, { search, archived, classId, examId, status }: ApplicationFilters) {
    let query = owned(teacherId).where('status', archived ? '=' : '<>', ARCHIVED)
    if (classId !== undefined) query = query.where('classId', '=', classId)
    if (examId !== undefined) query = query.where('examId', '=', examId)
    if (status !== undefined) query = query.where('status', '=', status)
    if (search !== '') query = query.where(dayContains('date', search))
    return query
  }

  return {
    async list(teacherId, filters) {
      const query = filtered(teacherId, filters)
      const { total } = await query.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow(filters)
      const rows = await query.select(APPLICATION_COLUMNS).orderBy('date').orderBy('id').limit(limit).offset(offset).execute()
      return { items: rows.map(toStoredApplication), total: Number(total) }
    },

    async findById(teacherId, id) {
      const row = await owned(teacherId).select(APPLICATION_COLUMNS).where('id', '=', id).executeTakeFirst()
      return row === undefined ? undefined : toStoredApplication(row)
    },

    async setStatus(teacherId, id, status) {
      await ownedUpdate(teacherId, id).set({ status }).execute()
    },

    async setGradesReleased(teacherId, id, released) {
      await ownedUpdate(teacherId, id).set({ gradesReleased: released }).execute()
    },
  }
}
