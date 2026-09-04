import type { Class, Student } from '@/types/domain'
import { classSchema, studentSchema } from '@/lib/schemas'
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

function seed(): void {
  createCollection('classes', classSchema).writeAll(CLASSES)
  createCollection('students', studentSchema).writeAll(STUDENTS)
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

export function resetDemoData(): void {
  clearAllCollections()
  window.localStorage.removeItem(SEED_MARKER)
  seed()
}
