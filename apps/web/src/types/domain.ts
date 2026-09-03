/**
 * Domain model. Entity names follow section 9 of the requirements document.
 *
 * Variants are modelled as discriminated unions rather than optional fields,
 * so impossible states are unrepresentable.
 */

export type Id = string;

/** ISO 8601 timestamp. `null` means "has not happened". */
export type Timestamp = string;

/** Anything that can be archived and restored instead of deleted. */
export interface Archivable {
  archivedAt: Timestamp | null;
}

export interface OwnedByTeacher {
  ownerId: Id;
}

export interface Teacher {
  id: Id;
  name: string;
  email: string;
}

export interface Class extends Archivable, OwnedByTeacher {
  id: Id;
  name: string;
  subject: string;
  term: string;
}

export interface Student {
  id: Id;
  classId: Id;
  name: string;
  registration: string;
  email: string | null;
  /** Set once personal data has been erased on request. */
  anonymizedAt: Timestamp | null;
}

export interface Alternative {
  id: Id;
  text: string;
  correct: boolean;
}

interface QuestionBase extends Archivable, OwnedByTeacher {
  id: Id;
  statement: string;
  tags: string[];
}

export interface MultipleChoiceQuestion extends QuestionBase {
  kind: 'multiple-choice';
  alternatives: Alternative[];
  /** Question-level default; an exam may override it per question. */
  shuffleAlternatives: boolean;
}

export interface OpenEndedQuestion extends QuestionBase {
  kind: 'open-ended';
  maxScore: number;
}

export type Question = MultipleChoiceQuestion | OpenEndedQuestion;

export type ExamStatus = 'draft' | 'ready' | 'archived';

export interface ExamQuestion {
  questionId: Id;
  score: number;
  shuffleAlternatives: boolean;
}

export interface Exam extends Archivable, OwnedByTeacher {
  id: Id;
  title: string;
  description: string;
  status: ExamStatus;
  questions: ExamQuestion[];
  defaultShuffleQuestions: boolean;
  defaultShuffleAlternatives: boolean;
}

export interface Application extends Archivable, OwnedByTeacher {
  id: Id;
  examId: Id;
  classId: Id;
  date: Timestamp;
  /** Applies to the whole application, not per version. */
  identified: boolean;
  gradesReleased: boolean;
  pdfGeneratedAt: Timestamp | null;
}

export interface ExamVersion {
  id: Id;
  applicationId: Id;
  number: number;
  shuffleQuestions: boolean;
  shuffleAlternatives: boolean;
  answerKeyPublishedAt: Timestamp | null;
}

/**
 * One per printed answer sheet.
 *
 * `sheetNumber` and `code` must never be conflated: the former is short and
 * human-readable for sorting paper, the latter is the opaque 128-bit token
 * behind the QR code and the only key to the public lookup. Using a guessable
 * value as the lookup key would make every grade enumerable.
 */
export interface AnswerSheet {
  id: Id;
  applicationId: Id;
  versionId: Id;
  studentId: Id | null;
  sheetNumber: number;
  code: string;
}

export type CorrectionSource = 'image-upload' | 'manual';

export interface MultipleChoiceAnswer {
  questionId: Id;
  /** Which alternative the student marked, not just whether they got it right. */
  markedAlternativeId: Id | null;
  correctAlternativeId: Id;
  correct: boolean;
}

export interface OpenEndedScore {
  questionId: Id;
  score: number;
}

export interface Correction {
  id: Id;
  answerSheetId: Id;
  source: CorrectionSource;
  multipleChoiceAnswers: MultipleChoiceAnswer[];
  openEndedScores: OpenEndedScore[];
  totalScore: number;
  notes: string;
  /** No reading becomes a grade until the teacher confirms it. */
  confirmedAt: Timestamp | null;
  imageUrl: string | null;
}

export interface PublicLookupHeader {
  examTitle: string;
  subject: string;
  className: string;
  date: Timestamp;
  identity:
    | { kind: 'student'; name: string }
    | { kind: 'sheet'; sheetNumber: number; versionNumber: number };
}

/** Mutually exclusive states of the public lookup page. */
export type PublicLookup =
  | { status: 'invalid-code' }
  | { status: 'awaiting-release'; header: PublicLookupHeader }
  | {
      status: 'released';
      header: PublicLookupHeader;
      totalScore: number;
      answers: MultipleChoiceAnswer[];
      answerKey: { questionId: Id; correctAlternativeId: Id }[] | null;
    };

export type BackgroundJobKind = 'generate-pdf' | 'read-sheets' | 'import' | 'export';

export type BackgroundJob =
  | { id: Id; kind: BackgroundJobKind; status: 'running'; label: string; startedAt: Timestamp }
  | {
      id: Id;
      kind: BackgroundJobKind;
      status: 'done';
      label: string;
      startedAt: Timestamp;
      resultUrl: string | null;
    }
  | {
      id: Id;
      kind: BackgroundJobKind;
      status: 'failed';
      label: string;
      startedAt: Timestamp;
      error: string;
    };
