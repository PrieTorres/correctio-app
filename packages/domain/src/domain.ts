/**
 * Domain model.
 *
 * Every entity here is bound by the contract in `docs/Modelo_de_Dados.md`,
 * which mirrors section 8 of the SGP Catolica specification. Fields may be
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
/**
 * Literal values follow the source that defines them.
 *
 * Values the specification dictates keep its spelling exactly, including the
 * Portuguese ones such as `"objetiva"` — renaming them would break the
 * contract. Values this project introduces use `SCREAMING_SNAKE_CASE`, so the
 * casing itself says which is which, and are exposed through a frozen object
 * rather than bare literals so call sites reference a name instead of retyping
 * a string.
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
  /**
   * Group addition: when it entered the bank.
   *
   * A bank sorted by statement buries a new question among the old ones, and
   * the only way to find it again was to remember its wording. Optional
   * because questions created before this existed do not have it.
   */
  createdAt?: Timestamp;
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

export const CORRECTION_SOURCE = {
  IMAGE_UPLOAD: 'IMAGE_UPLOAD',
  MANUAL: 'MANUAL',
} as const;

export type CorrectionSource = (typeof CORRECTION_SOURCE)[keyof typeof CORRECTION_SOURCE];

/**
 * Reading a sheet grades the multiple-choice questions on its own, but an
 * open-ended question has no single right answer, so a mixed exam is only
 * partly gradable by machine.
 *
 * Open-ended questions must never block the automatic part: the correction
 * lands as `IN_PROGRESS` and becomes `DONE` once the teacher has scored every
 * one of them.
 */
export const CORRECTION_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type CorrectionStatus = (typeof CORRECTION_STATUS)[keyof typeof CORRECTION_STATUS];

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
  /**
   * Deduplication key and sync state for the mobile app's offline queue.
   *
   * This client has no requirement touching either, and never writes them.
   * They stay in the contract because a system migrating onto this API would
   * send them, and dropping a field on the way through is how data is lost.
   */
  clientCorrectionId?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  /** Group additions. */
  status: CorrectionStatus;
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
    | { type: 'STUDENT'; fullName: string }
    | { type: 'SHEET'; sheetNumber: number; versionNumber: number };
}

export interface AnswerKeyEntry {
  questionId: Id;
  correctAlternativeId: Id;
}

/**
 * Mutually exclusive states of the public lookup page.
 *
 * The teacher controls two levels, and they nest: publishing the answer key
 * lets a student see the correct alternatives, and releasing grades adds their
 * own score on top. A score without an answer key is not a state this page can
 * reach, so it is not a state this type can express.
 */
export type PublicLookup =
  | { status: 'INVALID_CODE' }
  | { status: 'NOTHING_RELEASED'; header: PublicLookupHeader }
  | { status: 'ANSWER_KEY_ONLY'; header: PublicLookupHeader; answerKey: AnswerKeyEntry[] }
  | {
      status: 'ANSWER_KEY_AND_SCORE';
      header: PublicLookupHeader;
      answerKey: AnswerKeyEntry[];
      totalScore: number;
      objectiveResults: ObjectiveResult[];
    };

export const BACKGROUND_JOB_TYPE = {
  GENERATE_PDF: 'GENERATE_PDF',
  READ_SHEETS: 'READ_SHEETS',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
} as const;

export type BackgroundJobType = (typeof BACKGROUND_JOB_TYPE)[keyof typeof BACKGROUND_JOB_TYPE];

export type BackgroundJob =
  | { id: Id; type: BackgroundJobType; status: 'RUNNING'; label: string; startedAt: Timestamp }
  | {
      id: Id;
      type: BackgroundJobType;
      status: 'DONE';
      label: string;
      startedAt: Timestamp;
      resultUrl?: string;
    }
  | {
      id: Id;
      type: BackgroundJobType;
      status: 'FAILED';
      label: string;
      startedAt: Timestamp;
      error: string;
    };
