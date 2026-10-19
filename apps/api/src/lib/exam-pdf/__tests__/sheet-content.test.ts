import { describe, expect, it } from 'vitest'
import { coverContent, formatDate, formatScore, qrPayload, sheetQuestions } from '../sheet-content'
import { CONTINUITY, DERIVATIVE, itemAt, LIMITS, printedQuestions, sampleJob, sheetOf, versionOf } from './print-job-fixture'

describe('qrPayload', () => {
  /** The address printed on paper is the public lookup of the web app, `/r/:code`. */
  it('points at the public lookup of the sheet', () => {
    expect(qrPayload('https://correctio-app.web.app', 'ABC')).toBe('https://correctio-app.web.app/r/ABC')
  })

  it('never doubles the slash when the origin ends with one', () => {
    expect(qrPayload('https://correctio-app.web.app/', 'ABC')).toBe('https://correctio-app.web.app/r/ABC')
  })
})

describe('formatDate', () => {
  /** Stored at noon UTC, the day must not move in Brazil's time zone. */
  it('prints the day of the application as the teacher chose it', () => {
    expect(formatDate('2026-10-05T12:00:00.000Z')).toBe('05/10/2026')
    expect(formatDate('2026-10-05T00:30:00.000Z')).toBe('05/10/2026')
  })
})

describe('formatScore', () => {
  it('writes the value with a decimal comma, in the plural', () => {
    expect(formatScore(2.5)).toBe('2,5 pontos')
    expect(formatScore(0)).toBe('0 pontos')
  })

  it('uses the singular for one point', () => {
    expect(formatScore(1)).toBe('1 ponto')
  })
})

describe('sheetQuestions', () => {
  const job = sampleJob()
  const first = itemAt(job.versions, 0)
  const second = itemAt(job.versions, 1)

  it('follows the question order of the version and numbers from 1', () => {
    const questions = sheetQuestions(second, job.questions)

    expect(questions.map((question) => [question.number, question.id])).toEqual([
      [1, CONTINUITY.id],
      [2, DERIVATIVE.id],
      [3, LIMITS.id],
    ])
  })

  /** The letters are the positions of `printedOrder`, which the answer card and the correction read. */
  it('letters the alternatives in the printed order of the version', () => {
    const limits = sheetQuestions(second, job.questions).find((question) => question.id === LIMITS.id)

    expect(limits?.alternatives).toEqual([
      { letter: 'A', text: 'Infinito' },
      { letter: 'B', text: 'Não existe' },
      { letter: 'C', text: '1' },
      { letter: 'D', text: '0' },
    ])
  })

  it('prints what each question is worth in this exam', () => {
    expect(sheetQuestions(first, job.questions).map((question) => question.scoreLabel)).toEqual([
      '(2,5 pontos)',
      '(1 ponto)',
      '(4 pontos)',
    ])
  })

  it('gives an open-ended question no alternatives', () => {
    const continuity = sheetQuestions(first, job.questions).find((question) => question.id === CONTINUITY.id)

    expect(continuity).not.toHaveProperty('alternatives')
  })

  it('refuses a layout naming a question the job does not carry', () => {
    const questions = printedQuestions([[LIMITS, 1]])
    const version = versionOf(questions, { id: 'v', versionNumber: 1, questionOrder: [LIMITS.id, 'q-gone'] })

    expect(() => sheetQuestions(version, questions)).toThrow(/q-gone/)
  })

  it('refuses a printed order naming an alternative the question does not have', () => {
    const questions = printedQuestions([[LIMITS, 1]])
    const version = versionOf(questions, { id: 'v', versionNumber: 1, questionOrder: [LIMITS.id] })
    itemAt(version.layout.alternativeOrder, 0).printedOrder.push('q-limits-9')

    expect(() => sheetQuestions(version, questions)).toThrow(/q-limits-9/)
  })
})

describe('coverContent', () => {
  const job = sampleJob()
  const first = itemAt(job.versions, 0)
  const sheet = itemAt(job.sheets, 0)

  it('names the exam, the class and the sitting', () => {
    const cover = coverContent(job, sheet, first)

    expect(cover.title).toBe('Cálculo I — Prova 1')
    expect(cover.classLine).toBe('Turma: Cálculo I — Noturno · Matemática · 2026/2')
    expect(cover.sittingLine).toBe('Data: 05/10/2026 · Versão 1 · Folha 1')
    expect(cover.sheetLabel).toBe('Folha 1 · Versão 1')
  })

  it('prints the student when the application identifies them', () => {
    expect(coverContent(job, sheet, first).identity).toEqual({
      kind: 'STUDENT',
      text: 'Aluno: Ana Beatriz Moreira · Matrícula 202601',
    })
  })

  /** A sheet without identification is anonymous on purpose: the student writes their own name. */
  it('leaves the name blank when the application does not identify the students', () => {
    const anonymous = { ...first, withStudentIdentification: false }

    expect(coverContent(job, sheet, anonymous).identity).toEqual({ kind: 'BLANK' })
    expect(coverContent(job, sheetOf(3, first.id), first).identity).toEqual({ kind: 'BLANK' })
  })

  it('carries the address of the public lookup and the code beside it', () => {
    const cover = coverContent(job, sheet, first)

    expect(cover.qrPayload).toBe(`https://correctio-app.web.app/r/${'A'.repeat(26)}`)
    expect(cover.codeLabel).toBe(`Código ${'A'.repeat(26)}`)
  })

  it('has one card row per question, open-ended ones without bubbles', () => {
    expect(coverContent(job, sheet, first).rows.map((row) => row.bubbles)).toEqual([4, 2, 0])
  })

  it('explains where open-ended questions are answered only when the exam has one', () => {
    const questions = printedQuestions([[LIMITS, 1]])
    const objectiveOnly = versionOf(questions, { id: 'v', versionNumber: 1, questionOrder: [LIMITS.id] })
    const withOpenEnded = coverContent(job, sheet, first).instructions
    const without = coverContent({ ...job, questions }, sheet, objectiveOnly).instructions

    expect(withOpenEnded).toHaveLength(without.length + 1)
    expect(withOpenEnded.at(-1)).toMatch(/discursivas/)
  })
})
