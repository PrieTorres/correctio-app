import { describe, expect, it } from 'vitest'
import type { Exam, Question, Student } from '@/types/domain'
import { buildAnswerSheets, buildVersions } from '../build-versions'

function question(id: string, alternatives: string[]): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'objetiva',
    statement: `Enunciado ${id}`,
    tags: [],
    alternatives: alternatives.map((text, index) => ({ id: `${id}-${index}`, text })),
    correctAlternativeId: `${id}-0`,
    allowShuffleAlternatives: true,
  }
}

const BANK = [
  question('q1', ['a', 'b', 'c']),
  question('q2', ['a', 'b', 'c']),
  question('q3', ['a', 'b', 'c']),
]

function exam(allowShuffle: Record<string, boolean> = {}): Exam {
  return {
    id: 'exam-1',
    teacherId: 'ana',
    title: 'Prova',
    description: '',
    status: 'draft',
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
    questions: BANK.map((item, index) => ({
      questionId: item.id,
      order: index,
      score: 1,
      allowShuffleAlternatives: allowShuffle[item.id] ?? true,
    })),
  }
}

function criteria(overrides: Partial<Parameters<typeof buildVersions>[0]> = {}) {
  return {
    applicationId: 'app-1',
    exam: exam(),
    bank: BANK,
    versionCount: 2,
    shuffleQuestions: false,
    shuffleAlternatives: false,
    withStudentIdentification: true,
    ...overrides,
  }
}

/** Reverses every pick, so a shuffle is visible rather than sampled. */
const reverseEverything = () => 0

describe('buildVersions', () => {
  it('builds the number of versions asked for, numbered from one', () => {
    const versions = buildVersions(criteria({ versionCount: 3 }))

    expect(versions.map((item) => item.versionNumber)).toEqual([1, 2, 3])
  })

  it('keeps the exam order when shuffling is off', () => {
    const [version] = buildVersions(criteria())

    expect(version?.layout.questionOrder).toEqual(['q1', 'q2', 'q3'])
  })

  it('records a layout for every question, so a sheet can be read back', () => {
    const [version] = buildVersions(criteria({ shuffleQuestions: true }))

    expect(version?.layout.questionOrder).toHaveLength(3)
    expect(version?.layout.alternativeOrder).toHaveLength(3)
  })

  it('shuffles the alternatives when the application asks for it', () => {
    const [version] = buildVersions(
      criteria({ shuffleAlternatives: true }),
      reverseEverything,
    )

    expect(version?.layout.alternativeOrder[0]?.printedOrder).not.toEqual([
      'q1-0',
      'q1-1',
      'q1-2',
    ])
  })

  it('leaves a question that refuses shuffling in its own order', () => {
    const [version] = buildVersions(
      criteria({ exam: exam({ q2: false }), shuffleAlternatives: true }),
      reverseEverything,
    )

    const fixed = version?.layout.alternativeOrder.find((item) => item.questionId === 'q2')
    expect(fixed?.printedOrder).toEqual(['q2-0', 'q2-1', 'q2-2'])
  })

  it('never loses or repeats an alternative while shuffling', () => {
    const [version] = buildVersions(criteria({ shuffleAlternatives: true }))

    const printed = version?.layout.alternativeOrder[0]?.printedOrder ?? []
    expect([...printed].sort()).toEqual(['q1-0', 'q1-1', 'q1-2'])
  })

  it('gives every version its own public code', () => {
    const versions = buildVersions(criteria({ versionCount: 4 }))

    const codes = versions.map((item) => item.publicCode)
    expect(new Set(codes).size).toBe(4)
  })

  it('starts with the answer key unpublished', () => {
    const versions = buildVersions(criteria())

    expect(versions.every((item) => !item.answerKeyPublished)).toBe(true)
  })

  it('carries the identification choice onto every version', () => {
    const versions = buildVersions(criteria({ withStudentIdentification: false }))

    expect(versions.every((item) => !item.withStudentIdentification)).toBe(true)
  })

  it('leaves the exam untouched while sorting and shuffling', () => {
    const original = exam()
    const before = original.questions.map((item) => item.questionId)

    buildVersions(criteria({ exam: original, shuffleQuestions: true }))

    expect(original.questions.map((item) => item.questionId)).toEqual(before)
  })
})

describe('buildAnswerSheets', () => {
  const students: Student[] = Array.from({ length: 5 }, (_, index) => ({
    id: `student-${index}`,
    classId: 'class-1',
    fullName: `Aluno ${index}`,
    registration: String(index),
  }))

  it('builds one sheet per student', () => {
    const versions = buildVersions(criteria())

    expect(buildAnswerSheets('app-1', versions, students)).toHaveLength(5)
  })

  it('gives every sheet a code of its own', () => {
    const versions = buildVersions(criteria())

    const codes = buildAnswerSheets('app-1', versions, students).map((item) => item.code)
    expect(new Set(codes).size).toBe(5)
  })

  it('spreads the versions so neighbours do not share a paper', () => {
    const versions = buildVersions(criteria({ versionCount: 2 }))

    const sheets = buildAnswerSheets('app-1', versions, students)
    expect(sheets[0]?.examVersionId).not.toBe(sheets[1]?.examVersionId)
    expect(sheets[0]?.examVersionId).toBe(sheets[2]?.examVersionId)
  })

  it('numbers the sheets from one', () => {
    const versions = buildVersions(criteria())

    expect(buildAnswerSheets('app-1', versions, students).map((s) => s.sheetNumber)).toEqual([
      1, 2, 3, 4, 5,
    ])
  })

  it('builds nothing when there is no version to print', () => {
    expect(buildAnswerSheets('app-1', [], students)).toEqual([])
  })

  it('builds nothing for a class with no students', () => {
    expect(buildAnswerSheets('app-1', buildVersions(criteria()), [])).toEqual([])
  })
})
