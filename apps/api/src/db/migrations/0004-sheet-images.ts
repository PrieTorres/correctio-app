import { sql, type Kysely } from 'kysely'

/**
 * `sheet_images`, a group addition to the data model: one row per photo of a
 * sheet sent for correction (#47). The file itself stays in Cloud Storage
 * (ADR-004); the row keeps where it is, what kind of file it is, how big, and
 * how its reading ended. It is what lets the photo be served back only to its
 * teacher, a correction point at the photo it was confirmed from, and the
 * daily limit of uploads be counted across restarts of the API.
 *
 * `answerSheetId` is empty when the QR Code was not recognized: the photo is
 * of no known sheet until the teacher picks one in the review (RF30).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TABLE sheet_images (
    id VARCHAR(36) PRIMARY KEY,
    applicationId VARCHAR(36) NOT NULL,
    teacherId VARCHAR(36) NOT NULL,
    storageKey VARCHAR(255) NOT NULL,
    contentType VARCHAR(32) NOT NULL,
    byteSize INT UNSIGNED NOT NULL,
    status VARCHAR(24) NOT NULL,
    answerSheetId VARCHAR(36) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_sheet_images_teacher_created (teacherId, createdAt),
    INDEX idx_sheet_images_application (applicationId, createdAt),
    CONSTRAINT fk_sheet_images_application FOREIGN KEY (applicationId) REFERENCES applications (id),
    CONSTRAINT fk_sheet_images_teacher FOREIGN KEY (teacherId) REFERENCES users (id)
  )`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE sheet_images`.execute(db)
}
