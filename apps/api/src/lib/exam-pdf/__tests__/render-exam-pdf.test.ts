import { describe, expect, it } from 'vitest'
import { renderExamPdf } from '../render-exam-pdf'
import { multipleChoice, openEnded, printedQuestions, sampleJob, sheetOf, versionOf } from './print-job-fixture'

/** The page objects of a PDF, which pdfkit writes uncompressed; `/Type /Pages` is the tree, not a page. */
function pageCount(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page(?!s)/g)?.length ?? 0
}

describe('renderExamPdf', () => {
  it('produces a PDF', async () => {
    const pdf = await renderExamPdf(sampleJob())

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
  })

  /** A short exam: the cover and one page of questions per sheet, already even, so no blank page. */
  it('prints every sheet, each ending on an even page', async () => {
    const pdf = await renderExamPdf(sampleJob())

    expect(pageCount(pdf)).toBe(4)
  })

  /** Twenty long questions need several pages; whatever their number, each sheet keeps an even count. */
  it('keeps an even count per sheet for an exam that runs over several pages', async () => {
    const statement = `${'Um enunciado longo, para ocupar a página inteira. '.repeat(12)}Qual é a alternativa correta?`
    const questions = printedQuestions(
      Array.from({ length: 20 }, (_, index) => [multipleChoice(`q${index}`, statement, ['primeira', 'segunda', 'terceira', 'quarta', 'quinta']), 0.5] as const),
    )
    const version = versionOf(questions, { id: 'v1', versionNumber: 1, questionOrder: [...questions.keys()] })
    const job = sampleJob({ questions, versions: [version], sheets: [sheetOf(1, 'v1'), sheetOf(2, 'v1'), sheetOf(3, 'v1')] })

    const pages = pageCount(await renderExamPdf(job))

    expect(pages % 3).toBe(0)
    expect((pages / 3) % 2).toBe(0)
    expect(pages / 3).toBeGreaterThan(2)
  })

  /**
   * Three open-ended questions fill a page, with their answer lines. Six take
   * two, so the cover makes three pages and RF44 adds the fourth.
   */
  it('adds the blank page when a sheet would end on an odd page', async () => {
    const jobWith = (count: number) => {
      const questions = printedQuestions(
        Array.from({ length: count }, (_, index) => [openEnded(`q${index}`, 'Explique o que é uma função contínua.'), 1] as const),
      )
      const version = versionOf(questions, { id: 'v1', versionNumber: 1, questionOrder: [...questions.keys()] })
      return sampleJob({ questions, versions: [version], sheets: [sheetOf(1, 'v1')] })
    }

    expect(pageCount(await renderExamPdf(jobWith(3)))).toBe(2)
    expect(pageCount(await renderExamPdf(jobWith(6)))).toBe(4)
  })

  /** The standard PDF fonts have no `→` or `x³`; the statement must print with them. */
  it('embeds its own font', async () => {
    const pdf = (await renderExamPdf(sampleJob())).toString('latin1')

    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+DejaVuSans/)
  })

  /**
   * A statement longer than a page used to be cut, and its score opened a page
   * the plan never counted, so the sheet ended on an odd page. The whole PDF is
   * refused instead, naming the question.
   */
  it('refuses a question taller than a page instead of printing past it', async () => {
    const endless = multipleChoice('q-endless', 'Um enunciado que não termina nunca. '.repeat(300), ['Sim', 'Não'])
    const questions = printedQuestions([[endless, 1]])
    const version = versionOf(questions, { id: 'v1', versionNumber: 1, questionOrder: [endless.id] })
    const job = sampleJob({ questions, versions: [version], sheets: [sheetOf(1, 'v1')] })

    await expect(renderExamPdf(job)).rejects.toMatchObject({ name: 'QuestionTooTallError', questionId: 'q-endless' })
  })

  it('refuses an application with nothing to print', async () => {
    await expect(renderExamPdf(sampleJob({ sheets: [] }))).rejects.toThrow(/no sheets/)
  })

  it('refuses a sheet whose version is not in the job', async () => {
    await expect(renderExamPdf(sampleJob({ sheets: [sheetOf(1, 'v-gone')] }))).rejects.toThrow(/version/)
  })
})
