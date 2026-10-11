import { randomUUID } from 'node:crypto'
import {
  alternativeSchema,
  answerSheetSchema,
  applicationSchema,
  authenticatedUserSchema,
  classEnrollmentSchema,
  classSchema,
  correctionSchema,
  examQuestionSchema,
  examSchema,
  examVersionSchema,
  objectiveResultSchema,
  questionSchema,
  studentSchema,
} from '@correctio/domain'
import { sql, type Kysely } from 'kysely'
import type { AnyZodObject, ZodEffects, ZodTypeAny } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../models/tables'
import { createDatabase } from '../connection'
import { MIGRATION_COMMAND, migrate } from '../migrator'

/**
 * Runs against a real MySQL: `docker compose up -d mysql` locally, the MySQL
 * service in CI. In CI a missing database is a failure, never a skipped test,
 * because a skipped contract check is how a renamed column would get through.
 */
const serverUrl = process.env.DATABASE_TEST_URL
if (serverUrl === undefined && process.env.CI !== undefined) {
  throw new Error('DATABASE_TEST_URL is required in CI')
}

function fieldsOf(schema: ZodTypeAny): string[] {
  const object = 'innerType' in schema ? (schema as ZodEffects<AnyZodObject>).innerType() : (schema as AnyZodObject)
  return Object.keys(object.shape as Record<string, unknown>)
}

function without(fields: string[], ...childTables: string[]): string[] {
  return fields.filter((field) => !childTables.includes(field))
}

/**
 * Every field of the contract, read from the same schemas the web app and the
 * API validate with. A list stored as a child table is checked in that table.
 */
const CONTRACT: Readonly<Record<string, string[]>> = {
  users: [...fieldsOf(authenticatedUserSchema), 'passwordHash'],
  refresh_tokens: ['id', 'userId', 'tokenHash', 'deviceInfo', 'issuedAt', 'expiresAt', 'revokedAt'],
  classes: fieldsOf(classSchema),
  students: fieldsOf(studentSchema),
  class_enrollments: fieldsOf(classEnrollmentSchema),
  questions: without(fieldsOf(questionSchema), 'alternatives', 'tags'),
  question_alternatives: ['questionId', ...fieldsOf(alternativeSchema)],
  question_tags: ['questionId', 'tag'],
  exams: without(fieldsOf(examSchema), 'questions'),
  exam_questions: ['examId', ...fieldsOf(examQuestionSchema)],
  applications: fieldsOf(applicationSchema),
  exam_versions: fieldsOf(examVersionSchema),
  exam_assignments: ['id', 'examVersionId', 'studentId', 'qrCodePayload'],
  answer_sheets: fieldsOf(answerSheetSchema),
  corrections: without(fieldsOf(correctionSchema), 'objectiveResults', 'discursiveScores'),
  correction_objective_results: ['correctionId', ...fieldsOf(objectiveResultSchema)],
  correction_discursive_scores: ['correctionId', 'questionId', 'score'],
  activity_logs: ['id', 'teacherId', 'type', 'entity', 'entityId', 'details', 'createdAt'],
}

describe.runIf(serverUrl !== undefined)('database schema', () => {
  const name = `correctio_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  let server: Kysely<Database>
  let db: Kysely<Database>

  async function columnsByTable(): Promise<Map<string, string[]>> {
    const { rows } = await sql<{ table: string; column: string }>`
      SELECT TABLE_NAME AS \`table\`, COLUMN_NAME AS \`column\`
      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${name}`.execute(db)
    const map = new Map<string, string[]>()
    for (const { table, column } of rows) map.set(table, [...(map.get(table) ?? []), column])
    return map
  }

  beforeAll(async () => {
    server = createDatabase({ url: serverUrl ?? '', tls: 'local' })
    await sql`CREATE DATABASE ${sql.id(name)}`.execute(server)
    const url = new URL(serverUrl ?? '')
    url.pathname = `/${name}`
    db = createDatabase({ url: url.toString(), tls: 'local' })
    await migrate(db, MIGRATION_COMMAND.LATEST)
  })

  afterAll(async () => {
    await db.destroy()
    await sql`DROP DATABASE IF EXISTS ${sql.id(name)}`.execute(server)
    await server.destroy()
  })

  it('talks to the database over TLS', async () => {
    const { rows } = await sql<{ Value: string }>`SHOW SESSION STATUS LIKE 'Ssl_version'`.execute(db)

    expect(rows[0]?.Value).toMatch(/^TLS/)
  })

  it('has a table for every entity, with every field of the contract under its exact name', async () => {
    const columns = await columnsByTable()

    for (const [table, fields] of Object.entries(CONTRACT)) {
      expect(columns.get(table), table).toEqual(expect.arrayContaining(fields))
    }
  })

  it('never cascades a delete', async () => {
    const { rows } = await sql<{ rule: string }>`
      SELECT DELETE_RULE AS \`rule\` FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ${name}`.execute(db)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(({ rule }) => rule === 'RESTRICT' || rule === 'NO ACTION')).toBe(true)
  })

  it('requires the sync fields of a correction, as the specification does', async () => {
    const { rows } = await sql<{ column: string; nullable: string }>`
      SELECT COLUMN_NAME AS \`column\`, IS_NULLABLE AS nullable FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ${name} AND TABLE_NAME = 'corrections'
        AND COLUMN_NAME IN ('clientCorrectionId', 'syncStatus')`.execute(db)

    expect(rows).toHaveLength(2)
    expect(rows.every(({ nullable }) => nullable === 'NO')).toBe(true)
  })

  it('returns booleans, decimals, dates and JSON in the shape of the contract', async () => {
    const teacherId = randomUUID()
    await db
      .insertInto('users')
      .values({ id: teacherId, role: 'professor', fullName: 'Ana', email: `${teacherId}@exemplo.edu.br`, passwordHash: 'x' })
      .execute()
    await db
      .insertInto('questions')
      .values({ id: randomUUID(), teacherId, type: 'discursiva', statement: 'Explique.', correctAlternativeId: null, maxScore: 2.5, deletedAt: null, allowShuffleAlternatives: true })
      .execute()
    await db
      .insertInto('activity_logs')
      .values({ id: randomUUID(), teacherId, type: 'READ_FAILED', entity: 'answer_sheet', entityId: null, details: JSON.stringify({ reason: 'qr' }) })
      .execute()

    const question = await db.selectFrom('questions').selectAll().where('teacherId', '=', teacherId).executeTakeFirstOrThrow()
    const log = await db.selectFrom('activity_logs').selectAll().where('teacherId', '=', teacherId).executeTakeFirstOrThrow()

    expect(question.allowShuffleAlternatives).toBe(true)
    expect(question.maxScore).toBe(2.5)
    expect(question.createdAt).toBeInstanceOf(Date)
    expect(log.details).toEqual({ reason: 'qr' })
  })

  it('undoes every table and builds them again from scratch', async () => {
    await migrate(db, MIGRATION_COMMAND.RESET)
    const afterReset = await columnsByTable()
    for (const table of Object.keys(CONTRACT)) expect(afterReset.has(table), table).toBe(false)

    await migrate(db, MIGRATION_COMMAND.LATEST)
    const rebuilt = await columnsByTable()
    for (const table of Object.keys(CONTRACT)) expect(rebuilt.has(table), table).toBe(true)
  })
})
