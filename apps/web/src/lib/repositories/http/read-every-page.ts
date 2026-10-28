import type { Page } from '../types'

/**
 * The largest page the API serves (`MAX_PAGE_SIZE` in
 * `apps/api/src/lib/pagination.ts`). One request usually brings the whole
 * list; a longer one takes more requests rather than losing items.
 */
export const LARGEST_PAGE = 1000

/**
 * Every item of a list the API pages, for the screens that need all of it,
 * such as the students of a class or the sheets of an application. The first
 * page says how many there are, and any further page is asked for at once.
 */
export async function readEveryPage<T>(readPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await readPage(1)
  const pageCount = Math.ceil(first.total / LARGEST_PAGE)
  const pagesLeft = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2)
  const rest = await Promise.all(pagesLeft.map(readPage))
  return [first, ...rest].flatMap((page) => page.items)
}
