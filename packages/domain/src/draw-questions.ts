import type { Question } from './domain'

export interface DrawCriteria {
  /** A question qualifies when it carries every tag listed. Empty means any. */
  tags: string[]
  multipleChoiceCount: number
  openEndedCount: number
}

/**
 * What the draw reads of a question: its kind, its tags and whether it was
 * deleted. The screens pass the `Question` of the contract; the API passes the
 * record it loaded, whose dates are still `Date`.
 */
export type DrawableQuestion = Pick<Question, 'id' | 'type' | 'tags'> & { deletedAt?: unknown }

export interface DrawResult<Drawn extends DrawableQuestion = Question> {
  questions: Drawn[]
  /** Set when the bank could not supply everything asked for. */
  shortfall: { multipleChoice: number; openEnded: number } | null
}

/**
 * Randomness is injected so the draw can be asserted rather than sampled.
 * Callers pass `Math.random`; tests pass a sequence.
 */
export type RandomSource = () => number

function matchesCriteria(question: DrawableQuestion, tags: readonly string[]): boolean {
  return question.deletedAt === undefined && tags.every((tag) => question.tags.includes(tag))
}

/**
 * Picks `count` questions at random without repeating any.
 *
 * Selection is by removal from a working copy rather than by retrying on
 * collision: retrying degrades badly once the pool is nearly exhausted, which
 * is exactly the case a small question bank hits.
 */
function takeRandom<Drawn extends DrawableQuestion>(pool: readonly Drawn[], count: number, random: RandomSource): Drawn[] {
  const remaining = [...pool]
  const taken: Drawn[] = []

  while (taken.length < count && remaining.length > 0) {
    const index = Math.min(Math.floor(random() * remaining.length), remaining.length - 1)
    const [picked] = remaining.splice(index, 1)
    if (picked) taken.push(picked)
  }

  return taken
}

/**
 * Builds an exam selection from the bank.
 *
 * Asking for more questions than the bank holds is not an error: the draw
 * returns what it found and reports the gap, so the teacher sees a partial
 * selection and the reason rather than an empty screen.
 */
export function drawQuestions<Drawn extends DrawableQuestion>(
  bank: readonly Drawn[],
  criteria: DrawCriteria,
  random: RandomSource = Math.random,
): DrawResult<Drawn> {
  const eligible = bank.filter((question) => matchesCriteria(question, criteria.tags))
  const multipleChoice = takeRandom(
    eligible.filter((question) => question.type === 'objetiva'),
    criteria.multipleChoiceCount,
    random,
  )
  const openEnded = takeRandom(
    eligible.filter((question) => question.type === 'discursiva'),
    criteria.openEndedCount,
    random,
  )

  const missingMultipleChoice = criteria.multipleChoiceCount - multipleChoice.length
  const missingOpenEnded = criteria.openEndedCount - openEnded.length

  return {
    questions: [...multipleChoice, ...openEnded],
    shortfall:
      missingMultipleChoice > 0 || missingOpenEnded > 0
        ? { multipleChoice: missingMultipleChoice, openEnded: missingOpenEnded }
        : null,
  }
}

/** What a swap looks for: the tags of the draw, what is already chosen, and the question going out. */
export interface RedrawRequest<Drawn extends DrawableQuestion> {
  tags: readonly string[]
  alreadyChosenIds: readonly string[]
  replacing: Pick<Drawn, 'type'>
}

/**
 * Swaps one drawn question for another the teacher has not seen in this draw.
 *
 * Returns `null` when the bank has nothing else to offer, so the caller can say
 * so instead of silently leaving the same question in place.
 */
export function redrawQuestion<Drawn extends DrawableQuestion>(
  bank: readonly Drawn[],
  { tags, alreadyChosenIds, replacing }: RedrawRequest<Drawn>,
  random: RandomSource = Math.random,
): Drawn | null {
  const alternatives = bank.filter(
    (question) =>
      matchesCriteria(question, tags) &&
      question.type === replacing.type &&
      !alreadyChosenIds.includes(question.id),
  )

  return takeRandom(alternatives, 1, random)[0] ?? null
}

/**
 * Splits a total evenly, giving the remainder to the first question.
 *
 * Scores are rounded to two decimals because they are typed and read by people;
 * the remainder is handed out rather than dropped so the parts still add up to
 * the total the teacher asked for.
 */
export function distributeScore(total: number, count: number): number[] {
  if (count <= 0) return []

  const base = Math.floor((total / count) * 100) / 100
  const scores = Array.from({ length: count }, () => base)
  const remainder = Math.round((total - base * count) * 100) / 100

  if (remainder > 0 && scores[0] !== undefined) {
    scores[0] = Math.round((scores[0] + remainder) * 100) / 100
  }

  return scores
}
