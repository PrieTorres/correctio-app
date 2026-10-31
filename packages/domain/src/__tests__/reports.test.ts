import { describe, expect, it } from 'vitest'
import { CORRECTION_STATUS, type CorrectionStatus } from '../domain'
import {
  buildApplicationReport,
  consolidatedRowOf,
  consolidatedRows,
  isPendingCorrection,
  questionScoresOf,
  type ApplicationReportSource,
  type ReportedCorrection,
} from '../reports'

/**
 * An exam of three questions, kept out of order on purpose: `q-essay` is
 * stored first but is the last question of the exam. `q-old` stands for a
 * question deleted from the bank after printing, which the caller still
 * passes, with its tags.
 */
const SOURCE: Omit<ApplicationReportSource, 'corrections'> = {
  application: { id: 'app-1', date: '2026-10-05T12:00:00.000Z' },
  examTitle: 'Cálculo I — Prova 1',
  className: 'Turma A',
  examQuestions: [
    { questionId: 'q-essay', order: 2, score: 4 },
    { questionId: 'q-limits', order: 0, score: 3 },
    { questionId: 'q-old', order: 1, score: 3 },
  ],
  questions: [
    { id: 'q-limits', type: 'objetiva', statement: 'Limite', tags: ['Limites'], alternatives: [{ id: 'lim-a' }, { id: 'lim-b' }, { id: 'lim-c' }] },
    { id: 'q-old', type: 'objetiva', statement: 'Antiga', tags: ['Derivadas'], alternatives: [{ id: 'old-a' }, { id: 'old-b' }] },
    { id: 'q-essay', type: 'discursiva', statement: 'Explique', tags: [] },
  ],
  versions: [
    { id: 'v1', versionNumber: 1 },
    { id: 'v2', versionNumber: 2 },
  ],
  sheets: [
    { id: 'sheet-1', sheetNumber: 1 },
    { id: 'sheet-2', sheetNumber: 2 },
    { id: 'sheet-3', sheetNumber: 3 },
    { id: 'sheet-4', sheetNumber: 4 },
  ],
  students: [
    { id: 'student-bia', fullName: 'Beatriz Souza', registration: '2026002' },
    { id: 'student-ana', fullName: 'Ana Lima', registration: '2026001' },
  ],
}

interface CorrectionOptions {
  id: string
  sheet: string
  version?: string
  student?: string
  status?: CorrectionStatus
  limits?: { selected: string; score: number }
  old?: { selected: string; score: number }
  essay?: number
}

function correction({ id, sheet, version = 'v1', student, status = CORRECTION_STATUS.DONE, limits, old, essay }: CorrectionOptions): ReportedCorrection {
  const objectiveResults = [
    ...(limits === undefined ? [] : [{ questionId: 'q-limits', correct: limits.score > 0, score: limits.score, selectedAlternativeId: limits.selected }]),
    ...(old === undefined ? [] : [{ questionId: 'q-old', correct: old.score > 0, score: old.score, selectedAlternativeId: old.selected }]),
  ]
  const discursiveScores = essay === undefined ? [] : [{ questionId: 'q-essay', score: essay }]
  const totalScore = objectiveResults.reduce((sum, item) => sum + item.score, 0) + (essay ?? 0)
  return { id, answerSheetId: sheet, examVersionId: version, studentId: student, status, totalScore, objectiveResults, discursiveScores }
}

describe('buildApplicationReport', () => {
  it('answers zeros and empty lists for an application nobody corrected yet', () => {
    const report = buildApplicationReport({ ...SOURCE, corrections: [] })

    expect(report).toMatchObject({
      applicationId: 'app-1',
      examTitle: 'Cálculo I — Prova 1',
      className: 'Turma A',
      maximumScore: 10,
      sheets: 4,
      inProgress: 0,
      summary: { count: 0, mean: 0, median: 0, standardDeviation: 0, lowest: 0, highest: 0 },
      students: [],
      tags: [],
    })
    expect(report.distribution.every((band) => band.count === 0)).toBe(true)
  })

  /** Requirements, section 5: a correction still waiting for an open-ended score has no grade yet. */
  it('counts only finished corrections in the numbers, and the ones in progress apart', () => {
    const report = buildApplicationReport({
      ...SOURCE,
      corrections: [
        correction({ id: 'c1', sheet: 'sheet-1', student: 'student-ana', limits: { selected: 'lim-b', score: 3 }, old: { selected: 'old-a', score: 3 }, essay: 4 }),
        correction({ id: 'c2', sheet: 'sheet-2', student: 'student-bia', limits: { selected: 'lim-a', score: 0 }, old: { selected: 'old-a', score: 3 }, essay: 1 }),
        correction({ id: 'c3', sheet: 'sheet-3', status: CORRECTION_STATUS.IN_PROGRESS, limits: { selected: 'lim-a', score: 0 }, old: { selected: 'old-b', score: 0 } }),
      ],
    })

    expect(report.inProgress).toBe(1)
    expect(report.summary).toMatchObject({ count: 2, mean: 7, lowest: 4, highest: 10 })
    expect(report.distribution.reduce((sum, band) => sum + band.count, 0)).toBe(2)
    expect(report.students.map((row) => row.correctionId)).toEqual(['c1', 'c2'])
    expect(report.questions[0]?.accuracy).toMatchObject({ answered: 2, correct: 1 })
  })

  it('lists the questions in the order of the exam, numbered from 1, and counts accuracy for the multiple-choice ones', () => {
    const report = buildApplicationReport({
      ...SOURCE,
      corrections: [
        correction({ id: 'c1', sheet: 'sheet-1', student: 'student-ana', limits: { selected: 'lim-c', score: 0 }, old: { selected: 'old-a', score: 3 }, essay: 2 }),
        correction({ id: 'c2', sheet: 'sheet-2', student: 'student-bia', limits: { selected: 'lim-c', score: 0 }, old: { selected: 'old-a', score: 3 }, essay: 2 }),
      ],
    })

    expect(report.questions.map(({ questionId, number }) => [questionId, number])).toEqual([
      ['q-limits', 1],
      ['q-old', 2],
      ['q-essay', 3],
    ])
    expect(report.questions[0]?.accuracy).toEqual({ answered: 2, correct: 0, percentage: 0, mostMarkedLetter: 'C' })
    expect(report.questions[2]).not.toHaveProperty('accuracy')
  })

  /** The tag of a question deleted from the bank after printing still counts: the caller passes it. */
  it('groups accuracy by tag, including the tags of a question deleted after printing', () => {
    const report = buildApplicationReport({
      ...SOURCE,
      corrections: [correction({ id: 'c1', sheet: 'sheet-1', student: 'student-ana', limits: { selected: 'lim-b', score: 3 }, old: { selected: 'old-b', score: 0 }, essay: 4 })],
    })

    expect(report.tags).toEqual([
      { tag: 'Derivadas', answered: 1, correct: 0, percentage: 0 },
      { tag: 'Limites', answered: 1, correct: 1, percentage: 100 },
    ])
  })

  /**
   * The trap of the export (#82): version 2 printed the questions in another
   * order, and its results come in that order, yet the score of the exam's
   * question 1 must still land in column 1.
   */
  it('puts each score in the column of the exam question, whatever version the student had', () => {
    const printedFirst = correction({ id: 'c2', sheet: 'sheet-2', version: 'v2', student: 'student-bia', old: { selected: 'old-a', score: 3 }, limits: { selected: 'lim-a', score: 0 }, essay: 1.5 })
    printedFirst.objectiveResults.reverse()
    const report = buildApplicationReport({
      ...SOURCE,
      corrections: [
        correction({ id: 'c1', sheet: 'sheet-1', version: 'v1', student: 'student-ana', limits: { selected: 'lim-b', score: 3 }, old: { selected: 'old-b', score: 0 }, essay: 4 }),
        printedFirst,
      ],
    })

    expect(report.students).toEqual([
      { correctionId: 'c1', name: 'Ana Lima', registration: '2026001', versionNumber: 1, totalScore: 7, questionScores: [3, 0, 4] },
      { correctionId: 'c2', name: 'Beatriz Souza', registration: '2026002', versionNumber: 2, totalScore: 4.5, questionScores: [0, 3, 1.5] },
    ])
  })

  it('names a sheet still without a student by its number, with no registration', () => {
    const report = buildApplicationReport({ ...SOURCE, corrections: [correction({ id: 'c4', sheet: 'sheet-4', essay: 2 })] })

    expect(report.students[0]).toMatchObject({ name: 'Folha 4', registration: '', questionScores: [null, null, 2] })
  })

  it('still lists a grade whose student is gone, under a name that says so', () => {
    const report = buildApplicationReport({ ...SOURCE, corrections: [correction({ id: 'c1', sheet: 'sheet-1', student: 'student-gone', essay: 2 })] })

    expect(report.students[0]).toMatchObject({ name: 'Aluno removido', registration: '' })
  })

  it('sorts the students by name the way Portuguese does', () => {
    const report = buildApplicationReport({
      ...SOURCE,
      students: [
        { id: 's-o', fullName: 'Otávio', registration: '3' },
        { id: 's-a', fullName: 'Álvaro', registration: '1' },
        { id: 's-b', fullName: 'Bruna', registration: '2' },
      ],
      corrections: [
        correction({ id: 'c1', sheet: 'sheet-1', student: 's-o' }),
        correction({ id: 'c2', sheet: 'sheet-2', student: 's-b' }),
        correction({ id: 'c3', sheet: 'sheet-3', student: 's-a' }),
      ],
    })

    expect(report.students.map((row) => row.name)).toEqual(['Álvaro', 'Bruna', 'Otávio'])
  })
})

describe('isPendingCorrection', () => {
  it('is pending while it owes an open-ended score or a student, and done only when it owes neither', () => {
    expect(isPendingCorrection({ status: CORRECTION_STATUS.IN_PROGRESS, studentId: 's1' })).toBe(true)
    expect(isPendingCorrection({ status: CORRECTION_STATUS.DONE })).toBe(true)
    expect(isPendingCorrection({ status: CORRECTION_STATUS.DONE, studentId: 's1' })).toBe(false)
  })
})

describe('questionScoresOf', () => {
  it('leaves empty the questions a correction has no score for', () => {
    expect(
      questionScoresOf(
        { objectiveResults: [{ questionId: 'b', correct: true, score: 2 }], discursiveScores: [] },
        [
          { questionId: 'a', order: 0 },
          { questionId: 'b', order: 1 },
        ],
      ),
    ).toEqual([null, 2])
  })
})

describe('consolidated report', () => {
  const schoolClass = { id: 'class-a', name: 'Turma A', subject: 'Matemática', term: '2026/2' }

  it('carries what the filters of P19 match against, and the summary of the grades', () => {
    expect(consolidatedRowOf({ application: SOURCE.application, examTitle: 'Prova', schoolClass, scores: [4, 8] })).toEqual({
      applicationId: 'app-1',
      examTitle: 'Prova',
      classId: 'class-a',
      className: 'Turma A',
      subject: 'Matemática',
      term: '2026/2',
      date: '2026-10-05T12:00:00.000Z',
      summary: { count: 2, mean: 6, median: 6, standardDeviation: 2, lowest: 4, highest: 8 },
    })
  })

  /** An application with nothing finished has no grade to compare; it is not a row of zeros. */
  it('keeps the applications with a grade, the most recent first', () => {
    const row = (id: string, date: string, scores: number[]) =>
      consolidatedRowOf({ application: { id, date }, examTitle: id, schoolClass, scores })

    const rows = consolidatedRows([
      row('older', '2026-09-01T12:00:00.000Z', [5]),
      row('empty', '2026-12-01T12:00:00.000Z', []),
      row('newer', '2026-11-01T12:00:00.000Z', [7]),
    ])

    expect(rows.map((item) => item.applicationId)).toEqual(['newer', 'older'])
  })
})
