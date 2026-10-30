import type {
  ApplicationStatus,
  ClassStatus,
  Correction,
  CorrectionSource,
  CorrectionStatus,
  EnrollmentStatus,
  ExamStatus,
  ExamVersionLayout,
  QuestionType,
  SheetReadingStatus,
  UserRole,
} from '@correctio/domain'
import type { ColumnType } from 'kysely'
import type { AuthCodePurpose } from './auth-code-purpose'

/**
 * The tables as Kysely sees them. Column names are exactly the field names of
 * `docs/Modelo_de_Dados.md`, and enum values come from `@correctio/domain`, so
 * a renamed field or a new status breaks the type check here instead of
 * reaching the database. `createdAt` and `updatedAt` are technical columns the
 * database fills in.
 */

type Timestamp = ColumnType<Date, Date | string, Date | string>
type DatabaseTimestamp = ColumnType<Date, Date | string | undefined, Date | string>
type OptionalTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
type Json<T> = ColumnType<T, string, string>

interface Audited {
  createdAt: DatabaseTimestamp
  updatedAt: DatabaseTimestamp
}

export interface UsersTable {
  id: string
  role: UserRole
  fullName: string
  email: string
  passwordHash: string
  createdAt: DatabaseTimestamp
  anonymizedAt: OptionalTimestamp
  /** `+` When someone proved they read the inbox (`0002-authentication`). */
  emailVerifiedAt: OptionalTimestamp
  updatedAt: DatabaseTimestamp
}

export interface RefreshTokensTable {
  id: string
  userId: string
  tokenHash: string
  deviceInfo: string | null
  issuedAt: Timestamp
  expiresAt: Timestamp
  revokedAt: OptionalTimestamp
}

export interface AuthCodesTable {
  id: string
  userId: string
  purpose: AuthCodePurpose
  codeHash: string
  expiresAt: Timestamp
  usedAt: OptionalTimestamp
  createdAt: DatabaseTimestamp
}

export interface ClassesTable extends Audited {
  id: string
  teacherId: string
  name: string
  subject: string
  term: string
  status: ClassStatus
  inviteCode: string
}

export interface StudentsTable extends Audited {
  id: string
  classId: string
  fullName: string
  registration: string
  /** Ciphertext (AES-256-GCM), never the address itself: see `docs/Seguranca_e_LGPD.md`, section 7. */
  email: string | null
  anonymizedAt: OptionalTimestamp
  userId: string | null
  removedAt: OptionalTimestamp
}

export interface ClassEnrollmentsTable {
  id: string
  classId: string
  studentId: string
  status: EnrollmentStatus
  enrolledVia: 'teacher' | 'invite_code'
}

export interface QuestionsTable extends Audited {
  id: string
  teacherId: string
  type: QuestionType
  statement: string
  correctAlternativeId: string | null
  maxScore: number | null
  deletedAt: OptionalTimestamp
  allowShuffleAlternatives: boolean
}

export interface QuestionAlternativesTable {
  questionId: string
  id: string
  text: string
  position: number
}

export interface QuestionTagsTable {
  questionId: string
  tag: string
}

export interface ExamsTable extends Audited {
  id: string
  teacherId: string
  title: string
  status: ExamStatus
  description: string
  defaultShuffleQuestions: boolean
  defaultShuffleAlternatives: boolean
}

export interface ExamQuestionsTable {
  examId: string
  questionId: string
  order: number
  score: number
  allowShuffleAlternatives: boolean
}

export interface ApplicationsTable extends Audited {
  id: string
  examId: string
  classId: string
  teacherId: string
  status: ApplicationStatus
  pdfUrl: string | null
  date: Timestamp
  gradesReleased: boolean
}

export interface ExamVersionsTable {
  id: string
  applicationId: string
  versionNumber: number
  shuffleQuestions: boolean
  shuffleAlternatives: boolean
  withStudentIdentification: boolean
  layout: Json<ExamVersionLayout>
  answerKeyPublished: boolean
  answerKeyPublishedAt: OptionalTimestamp
  publicCode: string
  qrCodePayload: string
}

export interface ExamAssignmentsTable {
  id: string
  examVersionId: string
  studentId: string
  qrCodePayload: string
}

export interface AnswerSheetsTable {
  id: string
  applicationId: string
  examVersionId: string
  studentId: string | null
  sheetNumber: number
  code: string
  /** `+` The geometry of the card the sheet was printed with (`0003-answer-card-version`); the first one by default. */
  answerCardVersion: ColumnType<number, number | undefined, number>
}

export interface CorrectionsTable extends Audited {
  id: string
  examVersionId: string
  studentId: string | null
  reportedStudentName: string | null
  reportedStudentRegistration: string | null
  totalScore: number
  notes: string | null
  confirmedAt: Timestamp
  correctedBy: string
  isAutomaticallyAssigned: boolean
  clientCorrectionId: string
  syncStatus: NonNullable<Correction['syncStatus']>
  answerSheetId: string
  source: CorrectionSource
  status: CorrectionStatus
  imageUrl: string | null
}

export interface CorrectionObjectiveResultsTable {
  correctionId: string
  questionId: string
  correct: boolean
  score: number
  selectedAlternativeId: string | null
}

export interface CorrectionDiscursiveScoresTable {
  correctionId: string
  questionId: string
  score: number
}

/** A photo of a sheet sent for correction, kept in Cloud Storage under `storageKey` (migration `0004`). */
export interface SheetImagesTable {
  id: string
  applicationId: string
  teacherId: string
  storageKey: string
  contentType: string
  byteSize: number
  status: SheetReadingStatus
  answerSheetId: string | null
  createdAt: DatabaseTimestamp
}

/** The general log: what failed or happened, never the content of personal data. */
export interface ActivityLogsTable {
  id: string
  teacherId: string | null
  type: string
  entity: string
  entityId: string | null
  details: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>
  createdAt: DatabaseTimestamp
}

export interface Database {
  users: UsersTable
  refresh_tokens: RefreshTokensTable
  auth_codes: AuthCodesTable
  classes: ClassesTable
  students: StudentsTable
  class_enrollments: ClassEnrollmentsTable
  questions: QuestionsTable
  question_alternatives: QuestionAlternativesTable
  question_tags: QuestionTagsTable
  exams: ExamsTable
  exam_questions: ExamQuestionsTable
  applications: ApplicationsTable
  exam_versions: ExamVersionsTable
  exam_assignments: ExamAssignmentsTable
  answer_sheets: AnswerSheetsTable
  corrections: CorrectionsTable
  correction_objective_results: CorrectionObjectiveResultsTable
  correction_discursive_scores: CorrectionDiscursiveScoresTable
  activity_logs: ActivityLogsTable
  sheet_images: SheetImagesTable
}
