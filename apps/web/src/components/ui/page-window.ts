export interface PageWindow {
  /** Position of the first item on the page, counting from 1; 0 when the list is empty. */
  first: number
  /** Position of the last item on the page. */
  last: number
  /** At least 1, so an empty list is still "page 1 of 1" rather than "of 0". */
  pageCount: number
}

/**
 * What a page of a server-paged list covers, for the "Mostrando 51–73 de 73"
 * line and for knowing whether there is a next page.
 */
export function pageWindow({ page, pageSize, total }: { page: number; pageSize: number; total: number }): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  return { first, last: Math.min(page * pageSize, total), pageCount }
}
