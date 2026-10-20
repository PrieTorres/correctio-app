import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { pageWindow } from './page-window'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/**
 * Moves through a list whose paging runs on the server, so nothing past the
 * first page is ever hidden without a way to reach it.
 *
 * With everything on one page it renders nothing: "página 1 de 1" only takes
 * room from the list.
 */
export function Pagination({ page, pageSize, total, onPageChange }: Readonly<PaginationProps>) {
  const { first, last, pageCount } = pageWindow({ page, pageSize, total })
  if (pageCount <= 1) return null

  return (
    <nav aria-label="Paginação" className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-caption text-ink-muted" aria-live="polite">
        Mostrando {first}–{last} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          icon={<ChevronLeft size={16} aria-hidden />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-caption text-ink-subtle">
          Página {page} de {pageCount}
        </span>
        <Button variant="ghost" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Próxima
          <ChevronRight size={16} aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
