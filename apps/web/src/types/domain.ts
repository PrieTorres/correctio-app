/**
 * Domain model.
 *
 * Every entity here is bound by the contract in `docs/Modelo_de_Dados.md`,
 * which mirrors section 8 of the SGP Católica specification. Fields may be
 * added; the keys and shapes defined by the specification may never be
 * removed, renamed or restructured.
 *
 * `Date` in the specification is carried as an ISO 8601 string, since that is
 * how it crosses JSON. That is a serialization detail, not a shape change.
 */

export type Id = string;

/** ISO 8601 instant. Maps to `Date` in the specification. */
export type Timestamp = string;

/**
 * Both roles the specification defines.
 *
 * Only `professor` authenticates in the current scope; `estudante` is kept so
 * a student area can be added without migrating the data model. Do not narrow
 * this union because one value is unused today.
 */
export type UserRole = 'professor' | 'estudante';

export interface User {
  id: Id;
  role: UserRole;
  fullName: string;
  email: string;
  /** Server-side only; never leaves the API. See {@link AuthenticatedUser}. */
  passwordHash: string;
  createdAt: Timestamp;
  anonymizedAt?: Timestamp;
}

/** What the client is allowed to hold: the entity minus the server secret. */
export type AuthenticatedUser = Omit<User, 'passwordHash'>;

export interface RefreshToken {
  id: Id;
  userId: Id;
  tokenHash: string;
  deviceInfo?: string;
  issuedAt: Timestamp;
  expiresAt: Timestamp;
  revokedAt?: Timestamp;
}

export type ClassStatus = 'active' | 'archived';

export interface Class {
  id: Id;
  teacherId: Id;
  name: string;
  subject: string;
  term: string;
  status: ClassStatus;
  inviteCode: string;
}

export type EnrollmentStatus = 'active' | 'removed';

/**
 * Links a student account to a class.
 *
 * Not used in the current scope, where students have no account and are held
 * as {@link Student} records. Kept because it is the join a student area needs
 * and because the specification defines it.
 */
export interface ClassEnrollment {
  id: Id;
  classId: Id;
  studentId: Id;
  status: EnrollmentStatus;
  enrolledVia: 'teacher' | 'invite_code';
}

/**
 * A student as a record inside a class, with no account of their own.
 *
 * Group addition covering the current scope, where students never sign in.
 * `userId` is the seam towards a student area: filling it links this record to
 * a {@link User} with role `estudante`, and {@link ClassEnrollment} then
 * carries how that link came about.
 */
export interface Student {
  id: Id;
  classId: Id;
  fullName: string;
  registration: string;
  email?: string;
  anonymizedAt?: Timestamp;
  /** Set only once a student area exists. */
  userId?: Id;
}

export type QuestionType = 'objetiva' | 'discursiva';

export interface Alternative {
  id: Id;
  text: string;
}

/**
 * The variant fields are optional rather than a discriminated union because
 * that is the shape the specification defines. Use {@link isMultipleChoice}
 * and {@link isOpenEnded} to narrow safely.
 */
export interface Question {
  id: Id;
  teacherId: Id;
  type: QuestionType;
  /** Supports basic Markdown. */
  statement: string;
  tags: string[];
  /** Present when `type` is `"objetiva"`: 2 to 5 entries. */
  alternatives?: Alternative[];
  correctAlternativeId?: Id;
  /** Present when `type` is `"discursiva"`. */
  maxScore?: number;
  /** Soft delete. */
  deletedAt?: Timestamp;
  /** Group addition: per-question default for alternative shuffling. */
  allowShuffleAlternatives: boolean;
}

export type MultipleChoiceQuestion = Question & {
  type: 'objetiva';
  alternatives: Alternative[];
  correctAlternativeId: Id;
};

export type OpenEndedQuestion = Question & {
  type: 'discursiva';
  maxScore: number;
};

export function isMultipleChoice(question: Question): question is MultipleChoiceQuestion {
  return question.type === 'objetiva' && question.alternatives !== undefined;
}

export function isOpenEnded(question: Question): question is OpenEndedQuestion {
  return question.type === 'discursiva' && question.maxScore !== undefined;
}

export interface ExamQuestion {
  questionId: Id;
  order: number;
  score: number;
  /** Group addition: overrides the question default for this exam. */
  allowShuffleAlternatives: boolean;
}

/** `draft` → `ready` on first application; any → `closed` when archived. */
export type ExamStatus = 'draft' | 'ready' | 'closed';

export interface Exam {
  id: Id;
  teacherId: Id;
  title: string;
  questions: ExamQuestion[];
  status: ExamStatus;
  /** Group additions. */
  description: string;
  defaultShuffleQuestions: boolean;
  defaultShuffleAlternatives: boolean;
}

export type ApplicationStatus = 'draft' | 'generated' | 'closed';

export interface Application {
  id: Id;
  examId: Id;
  classId: Id;
  teacherId: Id;
  status: ApplicationStatus;
  /** Single consolidated PDF, overwritten on every regeneration. */
  pdfUrl?: string;
  /** Group additions. */
  date: Timestamp;
  gradesReleased: boolean;
}

export interface AlternativeOrder {
  questionId: Id;
  /** Alternative ids in the order and letters actually printed. */
  printedOrder: Id[];
}

/**
 * The order materialised at generation time.
 *
 * This is what makes correction possible at all: without it the system cannot
 * tell which printed letter corresponds to which stored alternative.
 */
export interface ExamVersionLayout {
  questionOrder: Id[];
  alternativeOrder: AlternativeOrder[];
}

export interface ExamVersion {
  id: Id;
  applicationId: Id;
  versionNumber: number;
  shuffleQuestions: boolean;
  shuffleAlternatives: boolean;
  withStudentIdentification: boolean;
  layout: ExamVersionLayout;
  answerKeyPublished: boolean;
  answerKeyPublishedAt?: Timestamp;
  /** Public access to the answer key, distinct from `qrCodePayload`. */
  publicCode: string;
  qrCodePayload: string;
}

/**
 * Group addition, replacing `ExamAssignment`: one per printed answer sheet,
 * whether or not the exam identifies students.
 *
 * `sheetNumber` and `code` must never be conflated. The former is short and
 * human-readable for sorting paper; the latter is the opaque 128-bit token
 * behind the QR code and the only key to the public lookup.
 */
export interface AnswerSheet {
  id: Id;
  applicationId: Id;
  examVersionId: Id;
  studentId?: Id;
  sheetNumber: number;
  code: string;
}

export interface ObjectiveResult {
  questionId: Id;
  correct: boolean;
  score: number;
  /** Group addition: which alternative the student actually marked. */
  selectedAlternativeId?: Id;
}

export interface DiscursiveScore {
  questionId: Id;
  score: number;
}

export type CorrectionSource = 'upload_imagem' | 'manual';

export interface Correction {
  id: Id;
  examVersionId: Id;
  /** Filled automatically when the exam identifies students, or assigned later. */
  studentId?: Id;
  /** Read off the physical sheet when the exam has no identification. */
  reportedStudentName?: string;
  reportedStudentRegistration?: string;
  objectiveResults: ObjectiveResult[];
  discursiveScores: DiscursiveScore[];
  totalScore: number;
  notes?: string;
  confirmedAt: Timestamp;
  /** Teacher id. */
  correctedBy: Id;
  isAutomaticallyAssigned: boolean;
  /** Group additions. `clientCorrectionId` and `syncStatus` are dropped: no mobile app. */
  answerSheetId: Id;
  source: CorrectionSource;
  imageUrl?: string;
}

export interface PublicLookupHeader {
  examTitle: string;
  subject: string;
  className: string;
  date: Timestamp;
  identity:
    | { type: 'student'; fullName: string }
    | { type: 'sheet'; sheetNumber: number; versionNumber: number };
}

/** Mutually exclusive states of the public lookup page. */
export type PublicLookup =
  | { status: 'invalid-code' }
  | { status: 'awaiting-release'; header: PublicLookupHeader }
  | {
      status: 'released';
      header: PublicLookupHeader;
      totalScore: number;
      objectiveResults: ObjectiveResult[];
      answerKey: { questionId: Id; correctAlternativeId: Id }[] | null;
    };

export type BackgroundJobType = 'generate-pdf' | 'read-sheets' | 'import' | 'export';

export type BackgroundJob =
  | { id: Id; type: BackgroundJobType; status: 'running'; label: string; startedAt: Timestamp }
  | {
      id: Id;
      type: BackgroundJobType;
      status: 'done';
      label: string;
      startedAt: Timestamp;
      resultUrl?: string;
    }
  | {
      id: Id;
      type: BackgroundJobType;
      status: 'failed';
      label: string;
      startedAt: Timestamp;
      error: string;
    };
