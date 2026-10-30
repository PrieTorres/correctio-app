import { ANSWER_CARD } from '@correctio/domain'
import { describe, expect, it, vi } from 'vitest'
import { measurerFor } from '../draw'
import { drawCover, HEADER_BOTTOM, planHeader, qrLabelPositions, qrModules, type HeaderBlock } from '../draw-cover'
import { createDocument, PAGE_OPTIONS } from '../render-exam-pdf'
import { coverContent, qrPayload, type CoverContent } from '../sheet-content'
import { mm, STYLE, type Measure, type TextStyle } from '../sheet-pages'
import { itemAt, sampleJob, sheetOf } from './print-job-fixture'

const { qr, frame } = ANSWER_CARD

/** A page of a real document: only the fonts the PDF embeds measure what the paper will have. */
function pageOfRealDocument(): PDFKit.PDFDocument {
  const doc = createDocument('Teste')
  doc.addPage(PAGE_OPTIONS)
  return doc
}

/** `text` repeated up to exactly `length` characters, the limit a schema accepts. */
function atLength(text: string, length: number): string {
  return text.repeat(Math.ceil(length / text.length)).slice(0, length)
}

function coverOf(job: ReturnType<typeof sampleJob>): CoverContent {
  return coverContent(job, itemAt(job.sheets, 0), itemAt(job.versions, 0))
}

/**
 * The longest texts the schemas accept (title 200, class and subject 120,
 * term 40, student 160 and registration 40), written in W, the widest letter,
 * so that no real text can wrap into more lines. The first version has an
 * open-ended question, so the cover carries all four instructions.
 */
function longestCover(): CoverContent {
  return coverOf(
    sampleJob({
      examTitle: atLength('W', 200),
      className: atLength('W', 120),
      subject: atLength('W', 120),
      term: atLength('W', 40),
      sheets: [sheetOf(1, 'v1', { fullName: atLength('W', 160), registration: atLength('W', 40) })],
    }),
  )
}

function blockWith(blocks: readonly HeaderBlock[], text: string): HeaderBlock {
  const block = blocks.find((item) => item.text.includes(text))
  if (block === undefined) throw new Error(`No block of the header has "${text}"`)
  return block
}

const heightOf = ({ box }: HeaderBlock) => box.bottom - box.y

/** How tall `lines` lines of `style` are across the header. */
function linesTall(measure: Measure, style: TextStyle, lines: number): number {
  return measure(Array.from({ length: lines }, () => 'X').join('\n'), style, mm(frame.width))
}

describe('planHeader', () => {
  /** The review of #124 found the instructions gone under a long title: they were cut at the card without a word. */
  it('keeps every instruction whole above the card with the longest texts the schemas accept', () => {
    const measure = measurerFor(pageOfRealDocument())
    const cover = longestCover()
    const { blocks, bottom } = planHeader(cover, measure)

    expect(bottom).toBeLessThanOrEqual(HEADER_BOTTOM)
    for (const instruction of cover.instructions) {
      const block = blockWith(blocks, instruction)
      expect(heightOf(block)).toBeGreaterThanOrEqual(measure(block.text, block.style, block.box.width))
    }
  })

  /** The name on the sheet is how the paper finds its student, so it is never the part that gets cut. */
  it('prints the whole name and registration of the student', () => {
    const measure = measurerFor(pageOfRealDocument())
    const cover = longestCover()
    const identity = blockWith(planHeader(cover, measure).blocks, 'Aluno:')

    expect(heightOf(identity)).toBeGreaterThanOrEqual(measure(identity.text, identity.style, identity.box.width))
  })

  it('cuts a long title at two lines and the class line at one', () => {
    const measure = measurerFor(pageOfRealDocument())
    const cover = longestCover()
    const { blocks } = planHeader(cover, measure)

    expect(heightOf(blockWith(blocks, cover.title))).toBeLessThan(linesTall(measure, STYLE.title, 3))
    expect(heightOf(blockWith(blocks, cover.classLine))).toBeLessThan(linesTall(measure, STYLE.body, 2))
  })

  it('keeps a title and a class line that fit as they are', () => {
    const measure = measurerFor(pageOfRealDocument())
    const cover = coverOf(sampleJob())
    const { blocks } = planHeader(cover, measure)

    for (const [text, style] of [[cover.title, STYLE.title], [cover.classLine, STYLE.body]] as const) {
      expect(heightOf(blockWith(blocks, text))).toBeGreaterThanOrEqual(measure(text, style, mm(frame.width)))
    }
  })
})

describe('qrLabelPositions', () => {
  /** The addresses the code may carry: production, the pre-release link and a longer custom domain. */
  const payloads = [
    qrPayload('https://correctio-app.web.app', 'A'.repeat(26)),
    qrPayload('https://correctio-app-preview.web.app', 'A'.repeat(26)),
    qrPayload('https://provas.departamento-de-matematica.universidade.edu.br', 'A'.repeat(26)),
  ]

  it.each(payloads)('keeps both labels four modules clear of the QR code, and inside the card, for %s', (payload) => {
    const modules = qrModules(payload).size
    const { quietZone, sheetLabelBottom, codeTop } = qrLabelPositions(modules)

    expect(quietZone).toBeCloseTo((4 * qr.size) / modules)
    expect(codeTop - (qr.y + qr.size)).toBeGreaterThan(quietZone)
    expect(qr.y - sheetLabelBottom).toBeGreaterThan(quietZone)
    expect(codeTop + 5).toBeLessThan(frame.y + frame.height)
    expect(sheetLabelBottom - 6).toBeGreaterThan(frame.y)
  })
})

describe('drawCover', () => {
  /** What the cover writes, and where: the page itself is binary, so the calls are what can be checked. */
  function writtenTexts(cover: CoverContent): Map<string, number> {
    const doc = pageOfRealDocument()
    const written = new Map<string, number>()
    const write = doc.text.bind(doc)
    vi.spyOn(doc, 'text').mockImplementation(((text: string, x?: number, y?: number, options?: PDFKit.Mixins.TextOptions) => {
      written.set(text, y ?? Number.NaN)
      return write(text, x, y, options)
    }) as typeof doc.text)
    drawCover(doc, cover)
    return written
  }

  /** A label inside the quiet zone can stop a phone from finding the code, which is how the student gets the grade. */
  it('draws the sheet label and the code outside the quiet zone of the QR code', () => {
    const cover = coverOf(sampleJob())
    const written = writtenTexts(cover)
    const quietZone = mm((4 * qr.size) / qrModules(cover.qrPayload).size)
    const labelHeight = measurerFor(pageOfRealDocument())(cover.sheetLabel, STYLE.sheetLabel, mm(qr.size))

    expect(written.get(cover.codeLabel)).toBeGreaterThan(mm(qr.y + qr.size) + quietZone)
    expect((written.get(cover.sheetLabel) ?? Number.NaN) + labelHeight).toBeLessThan(mm(qr.y) - quietZone)
  })

  it('writes every instruction of the longest cover', () => {
    const cover = longestCover()
    const written = writtenTexts(cover)

    for (const instruction of cover.instructions) {
      expect(written.get(`•  ${instruction}`)).toBeLessThan(HEADER_BOTTOM)
    }
  })
})
