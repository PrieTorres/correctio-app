import { describe, expect, it } from 'vitest'
import { isAnswerSheetCode } from '../answer-sheet-code'
import { buildAnswerSheets, buildVersions, type VersionCriteria } from '../build-versions'
import type { Exam, Question, Student } from '../domain'
import type { VersionShuffle } from '../schemas'

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

const FIRST = question('q1', ['a', 'b', 'c'])
const THIRD = question('q3', ['a', 'b', 'c'])
const BANK = [FIRST, question('q2', ['a', 'b', 'c']), THIRD]

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

const KEEP_ORDER: VersionShuffle = { shuffleQuestions: false, shuffleAlternatives: false }

/** `count` versions that shuffle alike, as P13 sends them when the teacher changes no version. */
function alike(count: number, shuffle: Partial<VersionShuffle> = {}): VersionShuffle[] {
  return Array.from({ length: count }, () => ({ ...KEEP_ORDER, ...shuffle }))
}

function criteria(overrides: Partial<VersionCriteria> = {}): VersionCriteria {
  return {
    applicationId: 'app-1',
    exam: exam(),
    questions: BANK,
    versions: alike(2),
    withStudentIdentification: true,
    ...overrides,
  }
}

/** Picks the first place every time, so a shuffle is visible rather than sampled. */
const alwaysFirst = () => 0

const EXAM_ORDER = ['q1', 'q2', 'q3']

describe('buildVersions', () => {
  it('builds one version per entry asked for, numbered from one', () => {
    const versions = buildVersions(criteria({ versions: alike(3) }))

    expect(versions.map((item) => item.versionNumber)).toEqual([1, 2, 3])
  })

  it('keeps the exam order when shuffling is off', () => {
    const [version] = buildVersions(criteria())

    expect(version?.layout.questionOrder).toEqual(EXAM_ORDER)
  })

  it('records a layout for every question, so a sheet can be read back', () => {
    const [version] = buildVersions(criteria({ versions: alike(1, { shuffleQuestions: true }) }))

    expect(version?.layout.questionOrder).toHaveLength(3)
    expect(version?.layout.alternativeOrder).toHaveLength(3)
  })

  it('shuffles the alternatives when the version asks for it', () => {
    const [version] = buildVersions(criteria({ versions: alike(1, { shuffleAlternatives: true }) }), alwaysFirst)

    expect(version?.layout.alternativeOrder[0]?.printedOrder).not.toEqual(['q1-0', 'q1-1', 'q1-2'])
  })

  it('leaves a question that refuses shuffling in its own order', () => {
    const [version] = buildVersions(
      criteria({ exam: exam({ q2: false }), versions: alike(1, { shuffleAlternatives: true }) }),
      alwaysFirst,
    )

    const fixed = version?.layout.alternativeOrder.find((item) => item.questionId === 'q2')
    expect(fixed?.printedOrder).toEqual(['q2-0', 'q2-1', 'q2-2'])
  })

  it('never loses or repeats an alternative while shuffling', () => {
    const [version] = buildVersions(criteria({ versions: alike(1, { shuffleAlternatives: true }) }))

    const printed = version?.layout.alternativeOrder[0]?.printedOrder ?? []
    expect([...printed].sort()).toEqual(['q1-0', 'q1-1', 'q1-2'])
  })

  /** RF22: the preferences of the exam only pre-fill P13, and each version keeps what the teacher chose for it. */
  it('shuffles each version as its own entry says, and records what it did', () => {
    const [shuffledQuestions, shuffledAlternatives] = buildVersions(
      criteria({
        versions: [
          { shuffleQuestions: true, shuffleAlternatives: false },
          { shuffleQuestions: false, shuffleAlternatives: true },
        ],
      }),
      alwaysFirst,
    )

    expect(shuffledQuestions?.layout.questionOrder).not.toEqual(EXAM_ORDER)
    expect(shuffledQuestions?.layout.alternativeOrder.map((item) => item.printedOrder[0])).toEqual(['q2-0', 'q3-0', 'q1-0'])
    expect(shuffledQuestions).toMatchObject({ shuffleQuestions: true, shuffleAlternatives: false })

    expect(shuffledAlternatives?.layout.questionOrder).toEqual(EXAM_ORDER)
    expect(shuffledAlternatives?.layout.alternativeOrder[0]?.printedOrder).not.toEqual(['q1-0', 'q1-1', 'q1-2'])
    expect(shuffledAlternatives).toMatchObject({ shuffleQuestions: false, shuffleAlternatives: true })
  })

  it('lays out a question deleted from the bank after it joined the exam', () => {
    const deleted = { ...question('q2', ['a', 'b', 'c']), deletedAt: '2026-10-01T12:00:00.000Z' }
    const [version] = buildVersions(criteria({ questions: [FIRST, deleted, THIRD] }))

    expect(version?.layout.alternativeOrder.find((item) => item.questionId === 'q2')?.printedOrder).toEqual(['q2-0', 'q2-1', 'q2-2'])
  })

  it('gives an open-ended question its place in the order and no letters', () => {
    const essay: Question = { id: 'q2', teacherId: 'ana', type: 'discursiva', statement: 'Explique', tags: [], maxScore: 2, allowShuffleAlternatives: true }
    const [version] = buildVersions(criteria({ questions: [FIRST, essay, THIRD] }))

    expect(version?.layout.questionOrder).toEqual(EXAM_ORDER)
    expect(version?.layout.alternativeOrder.map((item) => item.questionId)).toEqual(['q1', 'q3'])
  })

  it('gives every version its own id and its own public code', () => {
    const versions = buildVersions(criteria({ versions: alike(4) }))

    expect(new Set(versions.map((item) => item.id)).size).toBe(4)
    expect(new Set(versions.map((item) => item.publicCode)).size).toBe(4)
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

    buildVersions(criteria({ exam: original, versions: alike(2, { shuffleQuestions: true }) }))

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

  it('gives every sheet a code of its own, which the public lookup accepts', () => {
    const versions = buildVersions(criteria())

    const codes = buildAnswerSheets('app-1', versions, students).map((item) => item.code)
    expect(new Set(codes).size).toBe(5)
    expect(codes.every(isAnswerSheetCode)).toBe(true)
  })

  it('spreads the versions so neighbours do not share a paper', () => {
    const versions = buildVersions(criteria({ versions: alike(2) }))

    const sheets = buildAnswerSheets('app-1', versions, students)
    expect(sheets[0]?.examVersionId).not.toBe(sheets[1]?.examVersionId)
    expect(sheets[0]?.examVersionId).toBe(sheets[2]?.examVersionId)
  })

  it('numbers the sheets from one', () => {
    const versions = buildVersions(criteria())

    expect(buildAnswerSheets('app-1', versions, students).map((s) => s.sheetNumber)).toEqual([1, 2, 3, 4, 5])
  })

  it('builds nothing when there is no version to print', () => {
    expect(buildAnswerSheets('app-1', [], students)).toEqual([])
  })

  it('builds nothing for a class with no students', () => {
    expect(buildAnswerSheets('app-1', buildVersions(criteria()), [])).toEqual([])
  })
})

describe('buildAnswerSheets, without identification', () => {
  const students: Student[] = Array.from({ length: 3 }, (_, index) => ({
    id: `student-${index}`,
    classId: 'class-1',
    fullName: `Aluno ${index}`,
    registration: String(index),
  }))

  /**
   * The paper carries no name, so nobody knows who took which one until the
   * correction says so. Recording a guess would attach grades to the wrong
   * people without anything saying it had happened.
   */
  it('ties a sheet to nobody when the paper carries no name', () => {
    const sheets = buildAnswerSheets('app-1', buildVersions(criteria()), students, false)

    expect(sheets.every((sheet) => sheet.studentId === undefined)).toBe(true)
  })

  it('still prints one sheet per student, so the class has enough paper', () => {
    expect(buildAnswerSheets('app-1', buildVersions(criteria()), students, false)).toHaveLength(3)
  })

  it('ties each sheet to its student when the paper does carry a name', () => {
    const sheets = buildAnswerSheets('app-1', buildVersions(criteria()), students, true)

    expect(sheets.map((sheet) => sheet.studentId)).toEqual(['student-0', 'student-1', 'student-2'])
  })
})
