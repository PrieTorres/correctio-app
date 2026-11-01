import type { ReactNode } from 'react'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

interface QueryBoundaryProps {
  isPending: boolean
  isError: boolean
  children: ReactNode
  /** What is loading, announced to screen readers; on screen the loading is an animation. */
  pendingLabel?: string
  /** Reads the data again; without it, "Tentar de novo" reloads the page. */
  onRetry?: () => void
}

/**
 * Renders the loading and error branches of a query in one place, so screens
 * do not each invent their own wording and markup for the same two states:
 * an animation in the middle while the data arrives, and an explained error
 * with a way to try again when it does not.
 */
export function QueryBoundary({ isPending, isError, children, pendingLabel = 'Carregando…', onRetry }: Readonly<QueryBoundaryProps>) {
  if (isPending) return <LoadingState label={pendingLabel} />
  if (isError) return <ErrorState onRetry={onRetry} />
  return <>{children}</>
}
