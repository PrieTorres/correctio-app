import { sql, type Kysely } from 'kysely'

/**
 * Every entity of `docs/Modelo_de_Dados.md`, including the ones reserved for
 * future scope (`class_enrollments`, `exam_assignments`, `students.userId`,
 * `classes.inviteCode`), which must exist even though nothing uses them yet.
 *
 * - Column names are the exact field names of the contract, enums carry its
 *   exact values. That is what keeps `teacherId` from ever becoming `ownerId`.
 * - Lists inside an entity become child tables when they are referenced or
 *   reported on (alternatives, tags, exam questions, per-question results:
 *   the per-question results are what answers "which alternative was marked
 *   most", the statistic the client asked for). `ExamVersion.layout` stays JSON:
 *   it is a snapshot written once and always read whole.
 * - No foreign key cascades. Removing is a soft delete everywhere, and a
 *   cascade would erase grades along with whatever was archived.
 * - In the reserved tables, `studentId` points to `users`, as in the
 *   specification, where a student with an account is a `User`.
 */
const TABLES = [
  sql`CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    role ENUM('professor', 'estudante') NOT NULL,
    fullName VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    anonymizedAt DATETIME(3) NULL,
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  )`,
  sql`CREATE TABLE refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    tokenHash CHAR(64) NOT NULL UNIQUE,
    deviceInfo VARCHAR(255) NULL,
    issuedAt DATETIME(3) NOT NULL,
    expiresAt DATETIME(3) NOT NULL,
    revokedAt DATETIME(3) NULL,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (userId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE classes (
    id VARCHAR(36) PRIMARY KEY,
    teacherId VARCHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    subject VARCHAR(120) NOT NULL,
    term VARCHAR(40) NOT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    inviteCode VARCHAR(32) NOT NULL UNIQUE,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_classes_teacher_status (teacherId, status),
    CONSTRAINT fk_classes_teacher FOREIGN KEY (teacherId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE students (
    id VARCHAR(36) PRIMARY KEY,
    classId VARCHAR(36) NOT NULL,
    fullName VARCHAR(160) NOT NULL,
    registration VARCHAR(40) NOT NULL,
    email VARCHAR(512) NULL,
    anonymizedAt DATETIME(3) NULL,
    userId VARCHAR(36) NULL,
    removedAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_students_class_registration (classId, registration),
    CONSTRAINT fk_students_class FOREIGN KEY (classId) REFERENCES classes (id),
    CONSTRAINT fk_students_user FOREIGN KEY (userId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE class_enrollments (
    id VARCHAR(36) PRIMARY KEY,
    classId VARCHAR(36) NOT NULL,
    studentId VARCHAR(36) NOT NULL,
    status ENUM('active', 'removed') NOT NULL,
    enrolledVia ENUM('teacher', 'invite_code') NOT NULL,
    CONSTRAINT fk_class_enrollments_class FOREIGN KEY (classId) REFERENCES classes (id),
    CONSTRAINT fk_class_enrollments_student FOREIGN KEY (studentId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE questions (
    id VARCHAR(36) PRIMARY KEY,
    teacherId VARCHAR(36) NOT NULL,
    type ENUM('objetiva', 'discursiva') NOT NULL,
    statement TEXT NOT NULL,
    correctAlternativeId VARCHAR(36) NULL,
    maxScore DECIMAL(6, 2) NULL,
    deletedAt DATETIME(3) NULL,
    allowShuffleAlternatives BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_questions_teacher_deleted (teacherId, deletedAt),
    CONSTRAINT fk_questions_teacher FOREIGN KEY (teacherId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE question_alternatives (
    questionId VARCHAR(36) NOT NULL,
    id VARCHAR(36) NOT NULL,
    text TEXT NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (questionId, id),
    CONSTRAINT fk_question_alternatives_question FOREIGN KEY (questionId) REFERENCES questions (id)
  )`,
  sql`CREATE TABLE question_tags (
    questionId VARCHAR(36) NOT NULL,
    tag VARCHAR(80) NOT NULL,
    PRIMARY KEY (questionId, tag),
    INDEX idx_question_tags_tag (tag),
    CONSTRAINT fk_question_tags_question FOREIGN KEY (questionId) REFERENCES questions (id)
  )`,
  sql`CREATE TABLE exams (
    id VARCHAR(36) PRIMARY KEY,
    teacherId VARCHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    status ENUM('draft', 'ready', 'closed') NOT NULL DEFAULT 'draft',
    description TEXT NOT NULL,
    defaultShuffleQuestions BOOLEAN NOT NULL DEFAULT TRUE,
    defaultShuffleAlternatives BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_exams_teacher_status (teacherId, status),
    CONSTRAINT fk_exams_teacher FOREIGN KEY (teacherId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE exam_questions (
    examId VARCHAR(36) NOT NULL,
    questionId VARCHAR(36) NOT NULL,
    \`order\` SMALLINT UNSIGNED NOT NULL,
    score DECIMAL(6, 2) NOT NULL,
    allowShuffleAlternatives BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (examId, questionId),
    UNIQUE KEY uq_exam_questions_order (examId, \`order\`),
    CONSTRAINT fk_exam_questions_exam FOREIGN KEY (examId) REFERENCES exams (id),
    CONSTRAINT fk_exam_questions_question FOREIGN KEY (questionId) REFERENCES questions (id)
  )`,
  sql`CREATE TABLE applications (
    id VARCHAR(36) PRIMARY KEY,
    examId VARCHAR(36) NOT NULL,
    classId VARCHAR(36) NOT NULL,
    teacherId VARCHAR(36) NOT NULL,
    status ENUM('draft', 'generated', 'closed') NOT NULL DEFAULT 'draft',
    pdfUrl VARCHAR(2048) NULL,
    date DATETIME(3) NOT NULL,
    gradesReleased BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_applications_teacher_status (teacherId, status),
    CONSTRAINT fk_applications_exam FOREIGN KEY (examId) REFERENCES exams (id),
    CONSTRAINT fk_applications_class FOREIGN KEY (classId) REFERENCES classes (id),
    CONSTRAINT fk_applications_teacher FOREIGN KEY (teacherId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE exam_versions (
    id VARCHAR(36) PRIMARY KEY,
    applicationId VARCHAR(36) NOT NULL,
    versionNumber SMALLINT UNSIGNED NOT NULL,
    shuffleQuestions BOOLEAN NOT NULL,
    shuffleAlternatives BOOLEAN NOT NULL,
    withStudentIdentification BOOLEAN NOT NULL,
    layout JSON NOT NULL,
    answerKeyPublished BOOLEAN NOT NULL DEFAULT FALSE,
    answerKeyPublishedAt DATETIME(3) NULL,
    publicCode VARCHAR(64) NOT NULL UNIQUE,
    qrCodePayload VARCHAR(512) NOT NULL,
    UNIQUE KEY uq_exam_versions_number (applicationId, versionNumber),
    CONSTRAINT fk_exam_versions_application FOREIGN KEY (applicationId) REFERENCES applications (id)
  )`,
  sql`CREATE TABLE exam_assignments (
    id VARCHAR(36) PRIMARY KEY,
    examVersionId VARCHAR(36) NOT NULL,
    studentId VARCHAR(36) NOT NULL,
    qrCodePayload VARCHAR(512) NOT NULL,
    CONSTRAINT fk_exam_assignments_version FOREIGN KEY (examVersionId) REFERENCES exam_versions (id),
    CONSTRAINT fk_exam_assignments_student FOREIGN KEY (studentId) REFERENCES users (id)
  )`,
  sql`CREATE TABLE answer_sheets (
    id VARCHAR(36) PRIMARY KEY,
    applicationId VARCHAR(36) NOT NULL,
    examVersionId VARCHAR(36) NOT NULL,
    studentId VARCHAR(36) NULL,
    sheetNumber INT UNSIGNED NOT NULL,
    code VARCHAR(32) NOT NULL UNIQUE,
    UNIQUE KEY uq_answer_sheets_number (applicationId, sheetNumber),
    CONSTRAINT fk_answer_sheets_application FOREIGN KEY (applicationId) REFERENCES applications (id),
    CONSTRAINT fk_answer_sheets_version FOREIGN KEY (examVersionId) REFERENCES exam_versions (id),
    CONSTRAINT fk_answer_sheets_student FOREIGN KEY (studentId) REFERENCES students (id)
  )`,
  sql`CREATE TABLE corrections (
    id VARCHAR(36) PRIMARY KEY,
    examVersionId VARCHAR(36) NOT NULL,
    studentId VARCHAR(36) NULL,
    reportedStudentName VARCHAR(160) NULL,
    reportedStudentRegistration VARCHAR(40) NULL,
    totalScore DECIMAL(7, 2) NOT NULL,
    notes TEXT NULL,
    confirmedAt DATETIME(3) NOT NULL,
    correctedBy VARCHAR(36) NOT NULL,
    isAutomaticallyAssigned BOOLEAN NOT NULL,
    clientCorrectionId VARCHAR(64) NOT NULL UNIQUE,
    syncStatus ENUM('pending', 'synced', 'error') NOT NULL,
    answerSheetId VARCHAR(36) NOT NULL UNIQUE,
    source ENUM('IMAGE_UPLOAD', 'MANUAL') NOT NULL,
    status ENUM('IN_PROGRESS', 'DONE') NOT NULL,
    imageUrl VARCHAR(2048) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_corrections_version FOREIGN KEY (examVersionId) REFERENCES exam_versions (id),
    CONSTRAINT fk_corrections_student FOREIGN KEY (studentId) REFERENCES students (id),
    CONSTRAINT fk_corrections_teacher FOREIGN KEY (correctedBy) REFERENCES users (id),
    CONSTRAINT fk_corrections_sheet FOREIGN KEY (answerSheetId) REFERENCES answer_sheets (id)
  )`,
  sql`CREATE TABLE correction_objective_results (
    correctionId VARCHAR(36) NOT NULL,
    questionId VARCHAR(36) NOT NULL,
    correct BOOLEAN NOT NULL,
    score DECIMAL(6, 2) NOT NULL,
    selectedAlternativeId VARCHAR(36) NULL,
    PRIMARY KEY (correctionId, questionId),
    INDEX idx_objective_results_question (questionId, selectedAlternativeId),
    CONSTRAINT fk_objective_results_correction FOREIGN KEY (correctionId) REFERENCES corrections (id),
    CONSTRAINT fk_objective_results_question FOREIGN KEY (questionId) REFERENCES questions (id)
  )`,
  sql`CREATE TABLE correction_discursive_scores (
    correctionId VARCHAR(36) NOT NULL,
    questionId VARCHAR(36) NOT NULL,
    score DECIMAL(6, 2) NOT NULL,
    PRIMARY KEY (correctionId, questionId),
    CONSTRAINT fk_discursive_scores_correction FOREIGN KEY (correctionId) REFERENCES corrections (id),
    CONSTRAINT fk_discursive_scores_question FOREIGN KEY (questionId) REFERENCES questions (id)
  )`,
  sql`CREATE TABLE activity_logs (
    id VARCHAR(36) PRIMARY KEY,
    teacherId VARCHAR(36) NULL,
    type VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entityId VARCHAR(36) NULL,
    details JSON NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_activity_logs_teacher_created (teacherId, createdAt),
    CONSTRAINT fk_activity_logs_teacher FOREIGN KEY (teacherId) REFERENCES users (id)
  )`,
]

/** Child tables first, so no foreign key is left pointing at a dropped table. */
const DROP_ORDER = [
  'activity_logs',
  'correction_discursive_scores',
  'correction_objective_results',
  'corrections',
  'answer_sheets',
  'exam_assignments',
  'exam_versions',
  'applications',
  'exam_questions',
  'exams',
  'question_tags',
  'question_alternatives',
  'questions',
  'class_enrollments',
  'students',
  'classes',
  'refresh_tokens',
  'users',
]

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of TABLES) await statement.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of DROP_ORDER) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db)
}
