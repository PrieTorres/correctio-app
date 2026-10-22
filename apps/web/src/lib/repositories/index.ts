import { createLocalApplicationRepository, type ApplicationRepository } from './application-repository'
import { createHttpClassRepository, createLocalClassRepository, type ClassRepository } from './class-repository'
import { createLocalExamRepository, type ExamRepository } from './exam-repository'
import { createLocalCorrectionRepository, type CorrectionRepository } from './correction-repository'
import { createLocalPrintingRepository, type PrintingRepository } from './printing-repository'
import { createLocalQuestionRepository, type QuestionRepository } from './question-repository'
import { createHttpStudentRepository, createLocalStudentRepository, type StudentRepository } from './student-repository'
import { createHttpQuestionRepository } from './http/create-http-question-repository'
import type { ApiClient } from './http/api-client'

export * from './types'
export type {
  ApplicationRepository,
  ClassRepository,
  CorrectionRepository,
  ExamRepository,
  PrintingRepository,
  QuestionRepository,
  StudentRepository,
}

export interface TeacherRepositories {
  classes: ClassRepository
  students: StudentRepository
  questions: QuestionRepository
  exams: ExamRepository
  applications: ApplicationRepository
  printing: PrintingRepository
  corrections: CorrectionRepository
}

/**
 * The single place that knows where data comes from.
 *
 * Swapping `localStorage` for the HTTP adapter happens here and nowhere else;
 * no screen, hook or schema changes.
 *
 * Named for the teacher because everything it exposes is scoped to one
 * teacher's data. A student area would add a sibling factory scoped to a
 * student, rather than widening this one.
 *
 * With an API client, the areas already on the API read and write there:
 * classes and students since #42, questions since #44. Each other entry
 * switches in the issue that wires its screens to the API (#45, #46, #48, #49
 * and #50). Without a client, which is the GitHub Pages demo and the unit
 * tests, every entry stays in this browser.
 */
export function createTeacherRepositories(teacherId: string, api?: ApiClient): TeacherRepositories {
  return {
    classes: api === undefined ? createLocalClassRepository(teacherId) : createHttpClassRepository(api),
    students: api === undefined ? createLocalStudentRepository() : createHttpStudentRepository(api),
    questions: api === undefined ? createLocalQuestionRepository(teacherId) : createHttpQuestionRepository(api),
    exams: createLocalExamRepository(teacherId),
    applications: createLocalApplicationRepository(teacherId),
    printing: createLocalPrintingRepository(),
    corrections: createLocalCorrectionRepository(),
  }
}