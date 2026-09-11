import type { Question } from '@/types/domain'

export interface DrawCriteria {
  /** A question qualifies when it carries every tag listed. Empty means any. */
  tags: string[]
  multipleChoiceCount: number
  openEndedCount: number
}

export interface DrawResult {
  questions: Question[]
  /** Set when the bank could not supply everything asked for. */
  shortfall: { multipleChoice: number; openEnded: number } | null
}

/**
 * Randomness is injected so the draw can be asserted rather than sampled.
 * Callers pass `Math.random`; tests pass a sequence.
 */
export type RandomSource = () => number

function matchesCriteria(question: Question, tags: string[]): boolean {
  return question.deletedAt === undefined && tags.every((tag) => question.tags.includes(tag))
}

/**
 * Picks `count` questions at random without repeating any.
 *
 * Selection is by removal from a working copy rather than by retrying on
 * collision: retrying degrades badly once the pool is nearly exhausted, which
 * is exactly the case a small question bank hits.
 */
function takeRandom(pool: readonly Question[], count: number, random: RandomSource): Question[] {
  const remaining = [...pool]
  const taken: Question[] = []

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
export function drawQuestions(
  bank: readonly Question[],
  criteria: DrawCriteria,
  random: RandomSource = Math.random,
): DrawResult {
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

/**
 * Swaps one drawn question for another the teacher has not seen in this draw.
 *
 * Returns `null` when the bank has nothing else to offer, so the caller can say
 * so instead of silently leaving the same question in place.
 */
export function redrawQuestion(
  bank: readonly Question[],
  criteria: Pick<DrawCriteria, 'tags'>,
  alreadyChosenIds: readonly string[],
  replacing: Question,
  random: RandomSource = Math.random,
): Question | null {
  const alternatives = bank.filter(
    (question) =>
      matchesCriteria(question, criteria.tags) &&
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
