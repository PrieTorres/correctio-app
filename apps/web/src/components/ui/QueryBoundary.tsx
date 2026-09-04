import type { ReactNode } from 'react'
import { Card } from './Card'

interface QueryBoundaryProps {
  isPending: boolean
  isError: boolean
  children: ReactNode
  pendingLabel?: string
}

/**
 * Renders the loading and error branches of a query in one place, so screens
 * do not each invent their own wording and markup for the same two states.
 */
export function QueryBoundary({
  isPending,
  isError,
  children,
  pendingLabel = 'Carregando…',
}: QueryBoundaryProps) {
  if (isPending) return <p className="text-body text-ink-muted">{pendingLabel}</p>

  if (isError) {
    return (
      <Card className="p-6">
        <p role="alert" className="text-body text-danger">
          Não foi possível carregar os dados. Recarregue a página.
        </p>
      </Card>
    )
  }

  return <>{children}</>
}
