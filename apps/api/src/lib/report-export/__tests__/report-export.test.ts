import { buildApplicationReport, consolidatedRowOf, NO_REPORT_FILTERS, type ApplicationReportSource } from '@correctio/domain'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { renderReport } from '..'
import { neutralizeFormula, renderCsv } from '../csv'
import { renderPdf } from '../pdf'
import { applicationReportTable, consolidatedReportTable, type ReportTable } from '../report-table'
import { renderXlsx } from '../xlsx'

/**
 * Two versions of a three-question exam: version 2 printed `q-essay` first,
 * and its results come in that order. Sheet 3 was read without a student.
 */
const SOURCE: ApplicationReportSource = {
  application: { id: 'app-1', date: '2026-10-05T12:00:00.000Z' },
  examTitle: 'Cálculo I — Prova 1',
  className: 'Turma A',
  examQuestions: [
    { questionId: 'q-limits', order: 0, score: 3 },
    { questionId: 'q-old', order: 1, score: 3 },
    { questionId: 'q-essay', order: 2, score: 4 },
  ],
  questions: [
    { id: 'q-limits', type: 'objetiva', statement: 'Limite', tags: [], alternatives: [{ id: 'a' }, { id: 'b' }] },
    { id: 'q-old', type: 'objetiva', statement: 'Antiga', tags: [], alternatives: [{ id: 'c' }, { id: 'd' }] },
    { id: 'q-essay', type: 'discursiva', statement: 'Explique', tags: [] },
  ],
  versions: [
    { id: 'v1', versionNumber: 1 },
    { id: 'v2', versionNumber: 2 },
  ],
  sheets: [
    { id: 's1', sheetNumber: 1 },
    { id: 's2', sheetNumber: 2 },
    { id: 's3', sheetNumber: 3 },
  ],
  students: [
    { id: 'ana', fullName: 'Ana Lima', registration: '2026001' },
    { id: 'bia', fullName: '=HYPERLINK("http://x")', registration: '+55' },
  ],
  corrections: [
    {
      id: 'c1',
      answerSheetId: 's1',
      examVersionId: 'v1',
      studentId: 'ana',
      status: 'DONE',
      totalScore: 9.5,
      objectiveResults: [
        { questionId: 'q-limits', correct: true, score: 3, selectedAlternativeId: 'b' },
        { questionId: 'q-old', correct: true, score: 3, selectedAlternativeId: 'c' },
      ],
      discursiveScores: [{ questionId: 'q-essay', score: 3.5 }],
    },
    {
      id: 'c2',
      answerSheetId: 's2',
      examVersionId: 'v2',
      studentId: 'bia',
      status: 'DONE',
      totalScore: 4,
      discursiveScores: [{ questionId: 'q-essay', score: 1 }],
      objectiveResults: [
        { questionId: 'q-old', correct: true, score: 3, selectedAlternativeId: 'c' },
        { questionId: 'q-limits', correct: false, score: 0, selectedAlternativeId: 'a' },
      ],
    },
    {
      id: 'c3',
      answerSheetId: 's3',
      examVersionId: 'v1',
      status: 'DONE',
      totalScore: 2,
      objectiveResults: [],
      discursiveScores: [{ questionId: 'q-essay', score: 2 }],
    },
  ],
}

const REPORT = buildApplicationReport(SOURCE)

const SIMPLE: ReportTable = {
  title: 'Relatório',
  details: [],
  columns: [
    { header: 'Aluno', kind: 'TEXT', weight: 3 },
    { header: 'Nota', kind: 'NUMBER', weight: 1 },
  ],
  rows: [
    ['João; "Jota"', 7.5],
    ['=SUM(A1:A9)', null],
  ],
}

function csvLines(table: ReportTable): string[] {
  return renderCsv(table).toString('utf8').replace(/^\uFEFF/, '').split('\r\n')
}

/** The page objects of a PDF, which pdfkit writes uncompressed; `/Type /Pages` is the tree, not a page. */
function pageCount(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page(?!s)/g)?.length ?? 0
}

describe('applicationReportTable', () => {
  /** The columns of the issue while the client has not validated them (#69). */
  it('has name, registration, version, one column per question of the exam and the total', () => {
    expect(applicationReportTable(REPORT).columns.map((column) => column.header)).toEqual(['Aluno', 'Matrícula', 'Versão', 'Q1', 'Q2', 'Q3', 'Total'])
  })

  /** Version 2 printed the questions in another order, and each score still lands under its exam question. */
  it('puts each score under the question of the exam, whatever the version', () => {
    const rows = applicationReportTable(REPORT).rows

    expect(rows).toContainEqual(['Ana Lima', '2026001', 1, 3, 3, 3.5, 9.5])
    expect(rows).toContainEqual(['=HYPERLINK("http://x")', '+55', 2, 0, 3, 1, 4])
  })

  it('names a sheet without a student by its number, with the registration empty', () => {
    expect(applicationReportTable(REPORT).rows).toContainEqual(['Folha 3', '', 1, null, null, 2, 2])
  })

  it('says in the details what the numbers cover', () => {
    const { title, details } = applicationReportTable({ ...REPORT, inProgress: 2 })

    expect(title).toBe('Cálculo I — Prova 1')
    expect(details).toEqual([
      'Turma: Turma A',
      'Data: 05/10/2026',
      'Corrigidas: 3 de 3 folhas · 2 em andamento, fora das contas',
      'Média 5,17 · Mediana 4 · Desvio padrão 3,17 · Menor 2 · Maior 9,5',
    ])
  })
})

describe('consolidatedReportTable', () => {
  const row = consolidatedRowOf({
    application: { id: 'app-1', date: '2026-10-05T12:00:00.000Z' },
    examTitle: 'Prova',
    schoolClass: { id: 'class-a', name: 'Física II', subject: 'Física', term: '2026/2' },
    scores: [6, 8],
  })

  it('has the columns of the screen, one row per application', () => {
    const table = consolidatedReportTable([row], NO_REPORT_FILTERS, new Date('2026-10-30T15:00:00.000Z'))

    expect(table.columns.map((column) => column.header)).toEqual(['Prova', 'Turma', 'Data', 'Corrigidas', 'Média', 'Menor', 'Maior'])
    expect(table.rows).toEqual([['Prova', 'Física II', '05/10/2026', 2, 7, 6, 8]])
    expect(table.details).toEqual(['Gerado em 30/10/2026'])
  })

  it('says which filters narrowed the rows, naming the class', () => {
    const table = consolidatedReportTable([row], { ...NO_REPORT_FILTERS, classId: 'class-a', from: '2026-10-01' }, new Date('2026-10-30T15:00:00.000Z'))

    expect(table.details).toContain('Filtros: turma Física II, de 01/10/2026')
  })
})

describe('renderCsv', () => {
  it('starts with the byte order mark and keeps the accents in UTF-8, so Excel reads them', () => {
    const csv = renderCsv(applicationReportTable(REPORT))

    expect([...csv.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(csv.toString('utf8')).toContain('Matrícula')
  })

  it('separates the columns with semicolons and writes the decimal comma, as Excel in Portuguese reads them', () => {
    expect(csvLines(applicationReportTable(REPORT))[0]).toBe('Aluno;Matrícula;Versão;Q1;Q2;Q3;Total')
    expect(csvLines(applicationReportTable(REPORT))).toContain('Ana Lima;2026001;1;3;3;3,5;9,5')
  })

  it('quotes a cell with a separator or a quote, doubling the quote', () => {
    expect(csvLines(SIMPLE)[1]).toBe('"João; ""Jota""";7,5')
  })

  /** A name that arrives by import must never run as a formula on the teacher's computer. */
  it('keeps a cell starting with =, +, - or @ from becoming a formula', () => {
    expect(csvLines(SIMPLE)[2]).toBe("'=SUM(A1:A9);")
    expect(csvLines(applicationReportTable(REPORT))).toContain(`"'=HYPERLINK(""http://x"")";'+55;2;0;3;1;4`)
    for (const start of ['=', '+', '-', '@', '\t', '\r']) expect(neutralizeFormula(`${start}1+1`)).toBe(`'${start}1+1`)
    expect(neutralizeFormula('Ana')).toBe('Ana')
  })

  it('ends every line the way Excel writes them', () => {
    expect(renderCsv(SIMPLE).toString('utf8').endsWith('\r\n')).toBe(true)
  })
})

describe('renderXlsx', () => {
  async function workbook(table: ReportTable): Promise<Record<string, string>> {
    const files = unzipSync(new Uint8Array(await renderXlsx(table)))
    return Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strFromU8(content)]))
  }

  it('produces a workbook Excel opens, with the header and the accents', async () => {
    const files = await workbook(applicationReportTable(REPORT))

    expect(Object.keys(files)).toContain('xl/workbook.xml')
    expect(Object.values(files).join('')).toContain('Matrícula')
  })

  /** A typed text cell is shown as the text it is, so no apostrophe is needed in the spreadsheet. */
  it('writes a cell starting with = as text, never as a formula', async () => {
    const files = await workbook(SIMPLE)
    const sheet = Object.entries(files).find(([name]) => name.startsWith('xl/worksheets/'))?.[1] ?? ''

    expect(sheet).not.toContain('<f>')
    expect(Object.values(files).join('')).toContain('=SUM(A1:A9)')
  })

  it('writes the numbers as numbers', async () => {
    const files = await workbook(SIMPLE)
    const sheet = Object.entries(files).find(([name]) => name.startsWith('xl/worksheets/'))?.[1] ?? ''

    expect(sheet).toContain('<v>7.5</v>')
  })
})

describe('renderPdf', () => {
  it('produces a PDF with the fonts the exam PDF embeds, so the accents print', async () => {
    const pdf = await renderPdf(applicationReportTable(REPORT))

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1')).toContain('DejaVuSans')
    expect(pageCount(pdf)).toBe(1)
  })

  /** A long class runs over several pages, each with the header again. */
  it('breaks a long list into pages', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => [`Aluno ${index}`, index])

    expect(pageCount(await renderPdf({ ...SIMPLE, rows }))).toBeGreaterThan(2)
  })
})

describe('renderReport', () => {
  it('names the file by the report and its day, and gives the type of each format', async () => {
    const table = applicationReportTable(REPORT)

    expect(await renderReport(table, 'csv', 'relatorio-aplicacao-2026-10-05')).toMatchObject({ filename: 'relatorio-aplicacao-2026-10-05.csv', contentType: 'text/csv; charset=utf-8' })
    expect(await renderReport(table, 'xlsx', 'r')).toMatchObject({ filename: 'r.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    expect(await renderReport(table, 'pdf', 'r')).toMatchObject({ filename: 'r.pdf', contentType: 'application/pdf' })
  })
})
