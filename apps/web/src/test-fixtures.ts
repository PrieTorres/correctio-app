import { createLocalAuthProvider } from '@/lib/auth'
import { createTeacherRepositories } from '@/lib/repositories'
import { TEST_TEACHER_ID } from '@/test-utils'

/**
 * Signs a teacher in, which recording a correction requires: the stored schema
 * demands an author, so a correction saved without a session is dropped on the
 * next read.
 */
export async function signInForTests(): Promise<void> {
  await createLocalAuthProvider().signIn('professora@exemplo.edu.br', 'senha123')
}

export interface SeededApplication {
  applicationId: string
  examId: string
  classId: string
  objectiveQuestionId: string
  discursiveQuestionId: string
  correctAlternativeId: string
}

/**
 * Builds one application with everything behind it, for the tests that need a
 * whole chain rather than a single record.
 *
 * Written through the repositories rather than into storage, so a fixture can
 * never describe a shape the application itself would refuse.
 */
export async function seedApplicationChain(): Promise<SeededApplication> {
  await signInForTests()

  const { questions, exams, classes, students, applications } = createTeacherRepositories(
    TEST_TEACHER_ID,
  )

  const objective = await questions.create({
    type: 'objetiva',
    statement: 'Quanto é 2 + 2?',
    tags: ['Aritmética'],
    alternatives: [
      { id: 'alt-right', text: '4' },
      { id: 'alt-wrong', text: '5' },
    ],
    correctAlternativeId: 'alt-right',
    allowShuffleAlternatives: true,
  })
  const discursive = await questions.create({
    type: 'discursiva',
    statement: 'Explique a soma.',
    tags: ['Aritmética'],
    maxScore: 4,
    allowShuffleAlternatives: true,
  })

  const exam = await exams.create({
    title: 'Prova de teste',
    description: '',
    questions: [
      { questionId: objective.id, order: 0, score: 6, allowShuffleAlternatives: true },
      { questionId: discursive.id, order: 1, score: 4, allowShuffleAlternatives: true },
    ],
    defaultShuffleQuestions: false,
    defaultShuffleAlternatives: false,
  })

  const group = await classes.create({ name: 'Turma', subject: 'Matemática', term: '2026/2' })
  await students.add(group.id, { fullName: 'Ana Ribeiro', registration: '1' })
  await students.add(group.id, { fullName: 'Bruno Lima', registration: '2' })

  const application = await applications.create({
    examId: exam.id,
    classId: group.id,
    date: '2026-10-05T12:00:00.000Z',
  })

  return {
    applicationId: application.id,
    examId: exam.id,
    classId: group.id,
    objectiveQuestionId: objective.id,
    discursiveQuestionId: discursive.id,
    correctAlternativeId: 'alt-right',
  }
}
