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
const OWNER_ID = 'teacher-demo'

const CLASSES: Class[] = [
  { id: 'class-calculus-1', ownerId: OWNER_ID, name: 'Cálculo I — Noturno', subject: 'Matemática', term: '2026/2', archivedAt: null },
  { id: 'class-linear-algebra', ownerId: OWNER_ID, name: 'Álgebra Linear', subject: 'Matemática', term: '2026/2', archivedAt: null },
  { id: 'class-physics-2', ownerId: OWNER_ID, name: 'Física II', subject: 'Física', term: '2026/2', archivedAt: null },
  { id: 'class-calculus-1-2025', ownerId: OWNER_ID, name: 'Cálculo I — Matutino', subject: 'Matemática', term: '2025/2', archivedAt: '2026-02-10T12:00:00.000Z' },
]

const STUDENT_NAMES = [
  'Ana Beatriz Moreira', 'Bruno Carvalho Lima', 'Camila Duarte Rocha',
  'Diego Fernandes Alves', 'Eduarda Nunes Prado', 'Felipe Andrade Souza',
  'Gabriela Martins Reis', 'Henrique Oliveira Dias', 'Isabela Ramos Teixeira',
  'João Pedro Barbosa', 'Karina Lopes Ferreira', 'Lucas Mendes Cardoso',
]

function buildStudents(classId: string, count: number, firstRegistration: number): Student[] {
  return STUDENT_NAMES.slice(0, count).map((name, index) => ({
    id: `student-${classId}-${index}`,
    classId,
    name,
    registration: String(firstRegistration + index),
    email: null,
    anonymizedAt: null,
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
