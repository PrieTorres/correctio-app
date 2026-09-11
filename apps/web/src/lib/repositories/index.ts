import { createLocalClassRepository, type ClassRepository } from './class-repository'
import { createLocalExamRepository, type ExamRepository } from './exam-repository'
import { createLocalQuestionRepository, type QuestionRepository } from './question-repository'
import { createLocalStudentRepository, type StudentRepository } from './student-repository'

export * from './types'
export type { ClassRepository, ExamRepository, QuestionRepository, StudentRepository }

export interface TeacherRepositories {
  classes: ClassRepository
  students: StudentRepository
  questions: QuestionRepository
  exams: ExamRepository
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
 */
export function createTeacherRepositories(teacherId: string): TeacherRepositories {
  return {
    classes: createLocalClassRepository(teacherId),
    students: createLocalStudentRepository(),
    questions: createLocalQuestionRepository(teacherId),
    exams: createLocalExamRepository(teacherId),
  }
}
