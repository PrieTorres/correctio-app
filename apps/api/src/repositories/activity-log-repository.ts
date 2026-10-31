import { randomUUID } from 'node:crypto'
import { SHEET_READING, type ReadFailure } from '@correctio/domain'
import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

/** The kinds of event the API writes to the general log. Values the group added. */
export const ACTIVITY_TYPE = Object.freeze({
  /** A photo of a sheet whose QR Code or marks could not be read (#47). */
  SHEET_READ_FAILED: 'SHEET_READ_FAILED',
} as const)

/** How many failures the upload screen lists at most: more than any class has sheets. */
const FAILURES_LISTED = 500

/** What a failed reading writes to the log: the photo and the sheet by id, never a name or a mark. */
export interface ReadFailureEntry {
  teacherId: string
  applicationId: string
  imageId: string
  status: ReadFailure['status']
  answerSheetId?: string
}

export interface ActivityLogRepository {
  recordReadFailure: (entry: ReadFailureEntry) => Promise<void>
  /** The failed readings of an application, the most recent first, as the upload screen lists them (P15). */
  readFailures: (applicationId: string) => Promise<ReadFailure[]>
}

const isFailureStatus = (value: unknown): value is ReadFailure['status'] =>
  value === SHEET_READING.QR_NOT_RECOGNIZED || value === SHEET_READING.READ_FAILED

/** The details of a failure as stored; anything else in the column is not a failure this API wrote. */
function failureOf(details: unknown, createdAt: Date): ReadFailure | undefined {
  if (typeof details !== 'object' || details === null) return undefined
  const { imageId, status, answerSheetId } = details as Record<string, unknown>
  if (typeof imageId !== 'string' || !isFailureStatus(status)) return undefined
  return { imageId, status, ...(typeof answerSheetId === 'string' && { answerSheetId }), createdAt: createdAt.toISOString() }
}

/**
 * The general log (`ActivityLog`, #32): what happened or failed, with
 * references and reasons and never the content of personal data. A failed
 * reading of a photo is kept here (PM decision in #47), since it cannot become
 * a `Correction` before the teacher reviews it.
 */
export function createActivityLogRepository(db: Kysely<Database>): ActivityLogRepository {
  return {
    async recordReadFailure({ teacherId, applicationId, ...details }) {
      await db
        .insertInto('activity_logs')
        .values({
          id: randomUUID(),
          teacherId,
          type: ACTIVITY_TYPE.SHEET_READ_FAILED,
          entity: 'application',
          entityId: applicationId,
          details: JSON.stringify(details),
        })
        .execute()
    },

    async readFailures(applicationId) {
      const rows = await db
        .selectFrom('activity_logs')
        .select(['details', 'createdAt'])
        .where('type', '=', ACTIVITY_TYPE.SHEET_READ_FAILED)
        .where('entity', '=', 'application')
        .where('entityId', '=', applicationId)
        .orderBy('createdAt', 'desc')
        .limit(FAILURES_LISTED)
        .execute()
      return rows.flatMap((row) => failureOf(row.details, row.createdAt) ?? [])
    },
  }
}
