import type { Class, Exam, ExamQuestion, Question, RecentActivity, Student } from '@/types/domain'
import {
  classSchema,
  examSchema,
  questionSchema,
  recentActivitySchema,
  studentSchema,
} from '@/lib/schemas'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'

/**
 * Demo dataset for the mock-data phase.
 *
 * `localStorage` is per browser, so anyone opening the published link sees
 * only what is seeded here — never what the team demonstrated locally.
 * Without it the deliverable is a set of empty screens.
 */
const SEED_MARKER = 'correctio:v1:seeded-at'
const TEACHER_ID = 'teacher-demo'

const CLASSES: Class[] = [
  { id: 'class-calculus-1', teacherId: TEACHER_ID, name: 'Cálculo I — Noturno', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'CALC2NOT' },
  { id: 'class-linear-algebra', teacherId: TEACHER_ID, name: 'Álgebra Linear', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'ALGLIN26' },
  { id: 'class-physics-2', teacherId: TEACHER_ID, name: 'Física II', subject: 'Física', term: '2026/2', status: 'active', inviteCode: 'FIS2A262' },
  { id: 'class-calculus-1-2025', teacherId: TEACHER_ID, name: 'Cálculo I — Matutino', subject: 'Matemática', term: '2025/2', status: 'archived', inviteCode: 'CALC1MAT' },
]

const STUDENT_NAMES = [
  'Ana Beatriz Moreira', 'Bruno Carvalho Lima', 'Camila Duarte Rocha',
  'Diego Fernandes Alves', 'Eduarda Nunes Prado', 'Felipe Andrade Souza',
  'Gabriela Martins Reis', 'Henrique Oliveira Dias', 'Isabela Ramos Teixeira',
  'João Pedro Barbosa', 'Karina Lopes Ferreira', 'Lucas Mendes Cardoso',
]

function buildStudents(classId: string, count: number, firstRegistration: number): Student[] {
  return STUDENT_NAMES.slice(0, count).map((fullName, index) => ({
    id: `student-${classId}-${index}`,
    classId,
    fullName,
    registration: String(firstRegistration + index),
  }))
}

const STUDENTS: Student[] = [
  ...buildStudents('class-calculus-1', 12, 202601),
  ...buildStudents('class-linear-algebra', 8, 202701),
  ...buildStudents('class-physics-2', 10, 202801),
]

function multipleChoice(
  id: string,
  statement: string,
  tags: string[],
  options: readonly [string, string, string, string],
  correctIndex: number,
  allowShuffleAlternatives = true,
): Question {
  const alternatives = options.map((text, index) => ({ id: `${id}-alt-${index}`, text }))
  return {
    id,
    teacherId: TEACHER_ID,
    type: 'objetiva',
    statement,
    tags,
    alternatives,
    correctAlternativeId: `${id}-alt-${correctIndex}`,
    allowShuffleAlternatives,
  }
}

const QUESTIONS: Question[] = [
  multipleChoice(
    'question-limits',
    'Qual é o valor de lim(x→0) sen(x)/x?',
    ['Limites', 'Cálculo I'],
    ['0', '1', 'Não existe', 'Infinito'],
    1,
  ),
  multipleChoice(
    'question-derivative',
    'A derivada de f(x) = x³ é:',
    ['Derivadas', 'Cálculo I'],
    ['3x²', 'x²', '3x', 'x⁴/4'],
    0,
  ),
  multipleChoice(
    'question-matrix',
    'Uma matriz quadrada é invertível quando:',
    ['Matrizes', 'Álgebra Linear'],
    [
      'Seu determinante é diferente de zero',
      'Seu determinante é igual a zero',
      'Ela é simétrica',
      'Todas as anteriores',
    ],
    0,
    false,
  ),
  multipleChoice(
    'question-newton',
    'A segunda lei de Newton relaciona força, massa e:',
    ['Mecânica', 'Física II'],
    ['Aceleração', 'Velocidade', 'Deslocamento', 'Energia'],
    0,
  ),
  {
    id: 'question-essay-limits',
    teacherId: TEACHER_ID,
    type: 'discursiva',
    statement:
      'Explique com suas palavras o que significa dizer que uma função é contínua em um ponto, e dê um exemplo de função que não seja.',
    tags: ['Limites', 'Cálculo I'],
    maxScore: 2.5,
    allowShuffleAlternatives: true,
  },
  {
    id: 'question-essay-vectors',
    teacherId: TEACHER_ID,
    type: 'discursiva',
    statement:
      'Descreva a interpretação geométrica do produto escalar entre dois vetores e o que acontece quando ele vale zero.',
    tags: ['Vetores', 'Álgebra Linear'],
    maxScore: 3,
    allowShuffleAlternatives: true,
  },
]

function examQuestions(entries: readonly (readonly [string, number])[]): ExamQuestion[] {
  return entries.map(([questionId, score], order) => ({
    questionId,
    order,
    score,
    allowShuffleAlternatives:
      QUESTIONS.find((question) => question.id === questionId)?.allowShuffleAlternatives ?? true,
  }))
}

const EXAMS: Exam[] = [
  {
    id: 'exam-calculus-midterm',
    teacherId: TEACHER_ID,
    title: 'Cálculo I — Prova 1',
    description: 'Limites e derivadas, conteúdo até a aula 8.',
    questions: examQuestions([
      ['question-limits', 2.5],
      ['question-derivative', 2.5],
      ['question-essay-limits', 2.5],
    ]),
    status: 'ready',
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
  },
  {
    id: 'exam-linear-algebra-midterm',
    teacherId: TEACHER_ID,
    title: 'Álgebra Linear — Prova 1',
    description: 'Matrizes e vetores.',
    questions: examQuestions([
      ['question-matrix', 4],
      ['question-essay-vectors', 6],
    ]),
    status: 'draft',
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: false,
  },
  {
    id: 'exam-physics-quiz',
    teacherId: TEACHER_ID,
    title: 'Física II — Teste rápido',
    description: 'Mecânica, sem consulta.',
    questions: examQuestions([['question-newton', 10]]),
    status: 'draft',
    defaultShuffleQuestions: false,
    defaultShuffleAlternatives: true,
  },
  {
    id: 'exam-calculus-2025',
    teacherId: TEACHER_ID,
    title: 'Cálculo I — Prova 1 (2025/2)',
    description: 'Prova do semestre encerrado, mantida para consulta.',
    questions: examQuestions([['question-limits', 10]]),
    status: 'closed',
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
  },
]

const ACTIVITY: RecentActivity[] = [
  {
    id: 'activity-question-vectors',
    teacherId: TEACHER_ID,
    description: 'Você criou a questão sobre produto escalar no banco de questões',
    occurredAt: '2026-09-10T18:40:00.000Z',
  },
  {
    id: 'activity-class-physics-archived',
    teacherId: TEACHER_ID,
    description: 'Você arquivou a turma Cálculo I — Matutino',
    occurredAt: '2026-09-09T13:15:00.000Z',
  },
  {
    id: 'activity-class-physics-created',
    teacherId: TEACHER_ID,
    description: 'Você criou a turma Física II',
    occurredAt: '2026-09-08T09:05:00.000Z',
  },
  {
    id: 'activity-student-added',
    teacherId: TEACHER_ID,
    description: 'Você adicionou Ana Beatriz Moreira à turma Cálculo I — Noturno',
    occurredAt: '2026-09-07T16:22:00.000Z',
  },
  {
    id: 'activity-question-limits',
    teacherId: TEACHER_ID,
    description: 'Você criou a questão sobre limites no banco de questões',
    occurredAt: '2026-09-05T11:50:00.000Z',
  },
]

function seed(): void {
  createCollection('classes', classSchema).writeAll(CLASSES)
  createCollection('students', studentSchema).writeAll(STUDENTS)
  createCollection('questions', questionSchema).writeAll(QUESTIONS)
  createCollection('exams', examSchema).writeAll(EXAMS)
  createCollection('activity', recentActivitySchema).writeAll(ACTIVITY)
  window.localStorage.setItem(SEED_MARKER, new Date().toISOString())
}

/** Runs once per browser, at application boot. */
export function seedIfEmpty(): void {
  try {
    if (window.localStorage.getItem(SEED_MARKER) === null) seed()
  } catch {
    /* Storage unavailable (private window, blocked cookies): render without demo data. */
  }
}

/** Wipes everything and seeds again, for a clean demonstration. */
export function resetDemoData(): void {
  clearAllCollections()
  seed()
}

/**
 * Empties every collection and leaves it empty.
 *
 * The marker stays behind so the next reload does not silently seed again:
 * an empty system is a deliberate choice here, not a first visit.
 */
export function clearDemoData(): void {
  clearAllCollections()
  window.localStorage.setItem(SEED_MARKER, new Date().toISOString())
}

/** Whether any demo record is currently loaded. */
export function hasDemoData(): boolean {
  try {
    return createCollection('classes', classSchema).readAll().length > 0
  } catch {
    return false
  }
}
