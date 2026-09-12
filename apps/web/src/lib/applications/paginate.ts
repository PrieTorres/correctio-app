export interface PageBlock {
  /** Identifies what was laid out, so the caller can render it. */
  id: string
  /** In the same unit as the usable page height. */
  height: number
}

export interface PaginationResult {
  /** Blocks per page, in order. A blank page is an empty array. */
  pages: PageBlock[][]
  /** Set when a page was added only to keep the total even. */
  blankPageAdded: boolean
}

/**
 * Distributes blocks over pages without ever splitting one.
 *
 * RF43: a question that does not fit in what is left of a page goes to the next
 * one whole, even if that leaves the previous page half empty. A question split
 * across a fold is one a student has to turn the page to finish reading, which
 * is how an answer gets missed.
 *
 * RF44: an exam ending on an odd number of pages gets a blank one, so that
 * printing several double-sided does not start the next exam on the back of the
 * last page of this one.
 *
 * Kept free of any PDF concern on purpose: it takes heights and gives back a
 * distribution, so the rule can be tested without rendering anything. The
 * renderer that arrives in N2 measures the blocks and calls this.
 */
export function paginate(
  blocks: readonly PageBlock[],
  usablePageHeight: number,
): PaginationResult {
  if (usablePageHeight <= 0) return { pages: [], blankPageAdded: false }

  const pages: PageBlock[][] = []
  let current: PageBlock[] = []
  let remaining = usablePageHeight

  for (const block of blocks) {
    const fits = block.height <= remaining

    if (!fits && current.length > 0) {
      pages.push(current)
      current = []
      remaining = usablePageHeight
    }

    current.push(block)
    remaining -= block.height
  }

  if (current.length > 0) pages.push(current)

  /**
   * A block taller than a whole page still occupies one of its own: refusing
   * to place it would drop a question from the exam, which is worse than a
   * page that overflows and can be seen and fixed.
   */
  const blankPageAdded = pages.length > 0 && pages.length % 2 === 1
  if (blankPageAdded) pages.push([])

  return { pages, blankPageAdded }
}
