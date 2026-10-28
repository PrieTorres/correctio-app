import type { Application, Class, Exam, ExamQuestion, Question, Student } from '@/types/domain'
import {
  answerSheetSchema,
  applicationSchema,
  classSchema,
  examSchema,
  examVersionSchema,
  questionSchema,
  studentSchema,
  type ClassInput,
  type ExamInput,
  type QuestionInput,
  type StudentInput,
} from '@/lib/schemas'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { buildAnswerSheets, buildVersions } from '@/lib/applications'
import { createLocalAuthProvider, DEMO_TEACHER } from '@/lib/auth'

/**
 * Sample dataset of the GitHub Pages demo (`lib/app-mode.ts`), and of the
 * Cypress suite, which writes it for the teacher each test signs up; there the
 * classes and students are created on the API first (`RemoteRoster`).
 *
 * `localStorage` is per browser, so anyone opening the demo link sees only
 * what is seeded here, never what the team demonstrated locally. The Firebase
 * builds never load it: nothing there is made up.
 */
const SEED_MARKER = 'correctio:v1:seeded-at'
const TEACHER_ID = DEMO_TEACHER.id

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

interface MultipleChoiceSample {
  id: string
  statement: string
  tags: string[]
  options: readonly [string, string, string, string]
  correctIndex: number
  /** On by default; off for a question whose alternatives refer to each other ("todas as anteriores"). */
  allowShuffleAlternatives?: boolean
}

function multipleChoice({
  id,
  statement,
  tags,
  options,
  correctIndex,
  allowShuffleAlternatives = true,
}: MultipleChoiceSample): Question {
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
  multipleChoice({
    id: 'question-limits',
    statement: 'Qual é o valor de lim(x→0) sen(x)/x?',
    tags: ['Limites', 'Cálculo I'],
    options: ['0', '1', 'Não existe', 'Infinito'],
    correctIndex: 1,
  }),
  multipleChoice({
    id: 'question-derivative',
    statement: 'A derivada de f(x) = x³ é:',
    tags: ['Derivadas', 'Cálculo I'],
    options: ['3x²', 'x²', '3x', 'x⁴/4'],
    correctIndex: 0,
  }),
  multipleChoice({
    id: 'question-matrix',
    statement: 'Uma matriz quadrada é invertível quando:',
    tags: ['Matrizes', 'Álgebra Linear'],
    options: [
      'Seu determinante é diferente de zero',
      'Seu determinante é igual a zero',
      'Ela é simétrica',
      'Todas as anteriores',
    ],
    correctIndex: 0,
    allowShuffleAlternatives: false,
  }),
  multipleChoice({
    id: 'question-newton',
    statement: 'A segunda lei de Newton relaciona força, massa e:',
    tags: ['Mecânica', 'Física II'],
    options: ['Aceleração', 'Velocidade', 'Deslocamento', 'Energia'],
    correctIndex: 0,
  }),
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

/**
 * One application already generated and one still to generate, so both states
 * of the screens have something to show without anyone having to click first.
 */
const APPLICATIONS: Application[] = [
  {
    id: 'application-calculus-midterm',
    examId: 'exam-calculus-midterm',
    classId: 'class-calculus-1',
    teacherId: TEACHER_ID,
    status: 'generated',
    date: '2026-10-05T12:00:00.000Z',
    gradesReleased: false,
  },
  {
    id: 'application-physics-quiz',
    examId: 'exam-physics-quiz',
    classId: 'class-physics-2',
    teacherId: TEACHER_ID,
    status: 'draft',
    date: '2026-11-12T12:00:00.000Z',
    gradesReleased: false,
  },
]

/**
 * The generated application arrives with paper, built by the same functions the
 * screen uses. Writing the versions out by hand would let the demo drift from
 * what generating actually produces, and a sheet whose layout does not match
 * its version is unreadable.
 */
/** What the sample printing is built from: the sample data, or the copy of it that points at the ids the API gave. */
interface PrintingSources {
  applications: readonly Application[]
  students: readonly Student[]
  exams: readonly Exam[]
  questions: readonly Question[]
}

function printingForDemo({ applications, students, exams, questions }: PrintingSources) {
  const application = applications.find((item) => item.status === 'generated')
  const exam = exams.find((item) => item.id === application?.examId)
  if (exam === undefined || application === undefined) return { versions: [], sheets: [] }

  const versions = buildVersions({
    applicationId: application.id,
    exam,
    bank: questions,
    versionCount: 2,
    shuffleQuestions: exam.defaultShuffleQuestions,
    shuffleAlternatives: exam.defaultShuffleAlternatives,
    withStudentIdentification: true,
  })
  const sheets = buildAnswerSheets(
    application.id,
    versions,
    students.filter((student) => student.classId === application.classId),
    true,
  )

  return { versions, sheets }
}

/**
 * The sample classes, students, questions and exams after the API created
 * them, keyed back to the sample ids they stand for.
 *
 * The Cypress suite runs the Firebase build, whose class, student, question and
 * exam screens read the API, so it creates them there first (`signInAsNewTeacher`).
 * The rest of the sample still lives in `localStorage`, pointing at the ids the
 * API gave, so every spec starts from the same populated screens as before.
 */
export interface RemoteRoster {
  /** Sample class id, such as `class-calculus-1`, to the id the API gave that class. */
  classIds: Readonly<Record<string, string>>
  /** Every student as the API returned it, with its own id and the API class id. */
  students: readonly Student[]
  /**
   * Sample question id, such as `question-limits`, to the id the API gave it.
   * The alternatives keep their sample ids, which the API stores as sent.
   */
  questionIds: Readonly<Record<string, string>>
  /** Sample exam id, such as `exam-calculus-midterm`, to the id the API gave it. */
  examIds: Readonly<Record<string, string>>
}

/** One sample question in the shape the API takes it. */
export interface SampleQuestion {
  sampleId: string
  input: QuestionInput
}

/** The sample questions, for the suite to create on the API before `writeDemoData`. */
export function sampleQuestions(): SampleQuestion[] {
  return QUESTIONS.map((question) => ({
    sampleId: question.id,
    input: {
      type: question.type,
      statement: question.statement,
      tags: question.tags,
      allowShuffleAlternatives: question.allowShuffleAlternatives,
      ...(question.alternatives !== undefined && { alternatives: question.alternatives }),
      ...(question.correctAlternativeId !== undefined && { correctAlternativeId: question.correctAlternativeId }),
      ...(question.maxScore !== undefined && { maxScore: question.maxScore }),
    },
  }))
}

/** One sample exam in the shape the API takes it, with the status it has to reach there. */
export interface SampleExam {
  sampleId: string
  input: ExamInput
  /** The API creates every exam as a draft; `ready` and `closed` are reached afterwards, through their routes. */
  status: Exam['status']
}

/**
 * The sample exams, for the suite to create on the API once the sample
 * questions exist there, pointing at the ids the API gave those questions.
 */
export function sampleExams(questionIds: Readonly<Record<string, string>>): SampleExam[] {
  return EXAMS.map((exam) => ({
    sampleId: exam.id,
    status: exam.status,
    input: {
      title: exam.title,
      description: exam.description,
      questions: exam.questions.map((entry) => ({ ...entry, questionId: remoteId(questionIds, entry.questionId) })),
      defaultShuffleQuestions: exam.defaultShuffleQuestions,
      defaultShuffleAlternatives: exam.defaultShuffleAlternatives,
    },
  }))
}

/** One sample class in the shape the API takes it. */
export interface SampleClass {
  sampleId: string
  input: ClassInput
  /** Created and then archived, as the API has no way to create an archived class. */
  archived: boolean
  students: StudentInput[]
}

/** The sample classes and their students, for the suite to create on the API before `writeDemoData`. */
export function sampleClasses(): SampleClass[] {
  return CLASSES.map((item) => ({
    sampleId: item.id,
    input: { name: item.name, subject: item.subject, term: item.term },
    archived: item.status === 'archived',
    students: STUDENTS.filter((student) => student.classId === item.id).map(({ fullName, registration }) => ({
      fullName,
      registration,
    })),
  }))
}

/** A sample record missing from the roster would leave the rest pointing at nothing, so it stops the seeding instead. */
function remoteId(ids: Readonly<Record<string, string>>, sampleId: string): string {
  const id = ids[sampleId]
  if (id === undefined) throw new Error(`The sample record ${sampleId} was not created on the API.`)
  return id
}

/** The sample, owned by `teacherId` and pointing at the ids the API gave when there is a `remote` roster. */
function sampleFor(teacherId: string, remote: RemoteRoster | undefined) {
  const owned = <T extends { teacherId: string }>(items: readonly T[]): T[] => items.map((item) => ({ ...item, teacherId }))
  const classIdOf = (sampleId: string) => (remote === undefined ? sampleId : remoteId(remote.classIds, sampleId))
  const questionIdOf = (sampleId: string) => (remote === undefined ? sampleId : remoteId(remote.questionIds, sampleId))
  const examIdOf = (sampleId: string) => (remote === undefined ? sampleId : remoteId(remote.examIds, sampleId))

  return {
    classes: owned(CLASSES),
    questions: owned(QUESTIONS).map((question) => ({ ...question, id: questionIdOf(question.id) })),
    exams: owned(EXAMS).map((exam) => ({
      ...exam,
      id: examIdOf(exam.id),
      questions: exam.questions.map((entry) => ({ ...entry, questionId: questionIdOf(entry.questionId) })),
    })),
    applications: owned(APPLICATIONS).map((item) => ({
      ...item,
      classId: classIdOf(item.classId),
      examId: examIdOf(item.examId),
    })),
  }
}

/**
 * Signs the demo teacher in, if nobody is.
 *
 * The demo is browsable without a login, and everything it holds belongs to
 * `teacher-demo`. Recording a correction has to say who made it, so without a
 * session the grading screens would refuse — correctly, and uselessly, in a
 * demonstration that has no sign-in step.
 */
function signInDemoTeacher(): void {
  const auth = createLocalAuthProvider()
  if (auth.getCurrentUser() !== null) return

  void auth.signIn('ana.ribeiro@exemplo.edu.br', 'demonstracao')
}

/**
 * Writes the sample data as owned by `teacherId`. Classes, questions, exams and
 * applications carry their owner, and the screens list only the signed-in
 * teacher's; students, versions and sheets hang from those.
 *
 * With a `remote` roster the classes, students, questions and exams already
 * live on the API, so they are not written here, and the applications and
 * sheets point at the ids the API gave them.
 */
export function writeDemoData(teacherId: string, remote?: RemoteRoster): void {
  const { classes, questions, exams, applications } = sampleFor(teacherId, remote)

  if (remote === undefined) {
    createCollection('classes', classSchema).writeAll(classes)
    createCollection('students', studentSchema).writeAll(STUDENTS)
    createCollection('questions', questionSchema).writeAll(questions)
    createCollection('exams', examSchema).writeAll(exams)
  }
  createCollection('applications', applicationSchema).writeAll(applications)

  const printing = printingForDemo({ applications, students: remote?.students ?? STUDENTS, exams, questions })
  createCollection('exam-versions', examVersionSchema).writeAll(printing.versions)
  createCollection('answer-sheets', answerSheetSchema).writeAll(printing.sheets)
}

function seed(): void {
  signInDemoTeacher()
  writeDemoData(TEACHER_ID)
  window.localStorage.setItem(SEED_MARKER, new Date().toISOString())
}

/**
 * Runs once per browser, at application boot. With storage unavailable (private
 * window, blocked cookies) the app renders without demo data.
 */
export function seedIfEmpty(): void {
  try {
    if (window.localStorage.getItem(SEED_MARKER) === null) seed()
  } catch {}
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
