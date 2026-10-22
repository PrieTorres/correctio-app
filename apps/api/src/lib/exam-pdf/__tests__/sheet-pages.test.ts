import { describe, expect, it } from 'vitest'
import type { PrintedQuestionContent } from '../sheet-content'
import {
  measureQuestion,
  planSheetPages,
  QUESTION,
  QuestionTooTallError,
  STYLE,
  TEXT_WIDTH,
  USABLE_HEIGHT,
  type Measure,
  type MeasuredQuestion,
} from '../sheet-pages'

/** What `run` throws, so the test can look at the error's fields as well as its class. */
function thrownBy(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

/** Every text is one line of 10 points tall, whatever it says: enough to check how the parts add up. */
const oneLine: Measure = () => 10

const objective: PrintedQuestionContent = {
  id: 'q1',
  number: 1,
  statement: 'Qual é o valor de lim(x→0) sen(x)/x?',
  scoreLabel: '(1 ponto)',
  alternatives: [
    { letter: 'A', text: '0' },
    { letter: 'B', text: '1' },
  ],
}

const openEnded: PrintedQuestionContent = { id: 'q2', number: 2, statement: 'Explique.', scoreLabel: '(2 pontos)' }

describe('measureQuestion', () => {
  it('stacks the statement, the score and every alternative, with their gaps', () => {
    const measured = measureQuestion(objective, oneLine)

    expect(measured.alternativeHeights).toEqual([10, 10])
    expect(measured.height).toBe(10 + QUESTION.gap + 10 + QUESTION.gap + 2 * (10 + QUESTION.alternativeGap) + QUESTION.spacing)
  })

  it('gives an open-ended question its ruled answer area instead of alternatives', () => {
    const measured = measureQuestion(openEnded, oneLine)

    expect(measured.alternativeHeights).toEqual([])
    expect(measured.height).toBe(
      10 + QUESTION.gap + 10 + QUESTION.gap + QUESTION.answerLines * QUESTION.answerLinePitch + QUESTION.spacing,
    )
  })

  /** Measured exactly as drawn: same style, same width, with the letter in front. */
  it('measures each part in the style and width it is drawn with', () => {
    const calls: [string, string, number][] = []
    measureQuestion(objective, (text, style, width) => {
      calls.push([text, style.font, width])
      return 10
    })

    expect(calls).toEqual([
      [objective.statement, STYLE.body.font, TEXT_WIDTH],
      ['(1 ponto)', STYLE.small.font, TEXT_WIDTH],
      ['A) 0', STYLE.body.font, TEXT_WIDTH],
      ['B) 1', STYLE.body.font, TEXT_WIDTH],
    ])
  })
})

function question(id: string, height: number): MeasuredQuestion {
  return { content: { ...openEnded, id }, statementHeight: 0, scoreHeight: 0, alternativeHeights: [], height }
}

const kinds = (pages: ReturnType<typeof planSheetPages>) =>
  pages.map((page) => (page.kind === 'QUESTIONS' ? page.questions.map((item) => item.content.id) : page.kind))

describe('planSheetPages', () => {
  it('puts the cover alone on the first page', () => {
    const pages = planSheetPages([question('a', 100)])

    expect(kinds(pages)).toEqual(['COVER', ['a']])
  })

  /** RF43: what does not fit goes whole to the next page. */
  it('never splits a question across two pages', () => {
    const tall = USABLE_HEIGHT * 0.6
    const pages = planSheetPages([question('a', tall), question('b', tall), question('c', 50)])

    expect(kinds(pages)).toEqual(['COVER', ['a'], ['b', 'c'], 'BLANK'])
  })

  /** RF44: the cover counts, so cover plus two pages of questions gets the blank page that makes four. */
  it('adds a blank page when the sheet would end on an odd page', () => {
    const pages = planSheetPages([question('a', USABLE_HEIGHT), question('b', USABLE_HEIGHT)])

    expect(kinds(pages)).toEqual(['COVER', ['a'], ['b'], 'BLANK'])
  })

  it('adds nothing when the sheet already ends on an even page', () => {
    expect(kinds(planSheetPages([question('a', 100), question('b', 100)]))).toEqual(['COVER', ['a', 'b']])
  })

  /** Paper cannot scroll: printed anyway, the statement would be cut and the rest would open a page the plan never counted. */
  it('refuses a question taller than a page, naming it', () => {
    const error = thrownBy(() => planSheetPages([question('a', 100), question('b', USABLE_HEIGHT + QUESTION.spacing + 1), question('c', 10)]))

    expect(error).toBeInstanceOf(QuestionTooTallError)
    expect(error).toMatchObject({ questionId: 'b' })
  })

  /** The space after a question only separates it from the next one, so it never makes a question too tall. */
  it('prints a question that fills a page exactly', () => {
    const pages = planSheetPages([question('a', USABLE_HEIGHT + QUESTION.spacing)])

    expect(kinds(pages)).toEqual(['COVER', ['a']])
  })

  it('prints the cover and its blank page for an exam with no questions', () => {
    expect(kinds(planSheetPages([]))).toEqual(['COVER', 'BLANK'])
  })
})
