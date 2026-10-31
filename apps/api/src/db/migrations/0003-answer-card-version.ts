import { sql, type Kysely } from 'kysely'

/**
 * `answer_sheets.answerCardVersion`, a group addition to the data model: the
 * geometry of the answer card each sheet was printed with (`ANSWER_CARD.version`
 * in `@correctio/domain`). The reading of a photo (#78) looks for the marks
 * where that paper has them, so the card can change without making the sheets
 * already handed out unreadable.
 *
 * The default is the first geometry, the only one any existing sheet can have
 * been printed with; the generation always writes the current one.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE answer_sheets ADD COLUMN answerCardVersion SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER code`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE answer_sheets DROP COLUMN answerCardVersion`.execute(db)
}
