import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryBoundary } from '@/components/ui'
import { useCurrentUser } from '@/features/auth'
import { ROUTES } from './routes'

/** Where the sign-in sends the teacher back to, carried in the navigation state. */
export interface SignInState {
  from?: string
}

/**
 * The gate of every private screen. Without a session, including one whose
 * refresh the API refused, the screen is never rendered: the browser goes to
 * the sign-in, which returns here afterwards. The server refuses the data
 * anyway; this only keeps a stranger from seeing empty screens.
 *
 * A session that ends while the teacher is inside (sign-out, everywhere,
 * anonymize, or revoked elsewhere) also sends the browser to the sign-in, but
 * without a page to return to: whoever signs in next on this computer starts
 * at the dashboard, not where the last person was. Whether there was a session
 * is remembered from an earlier render, the way React keeps information from
 * previous renders.
 */
export function RequireSession() {
  const { data: user, isPending, isError } = useCurrentUser()
  const [hadSession, setHadSession] = useState(false)
  const location = useLocation()

  if (user && !hadSession) setHadSession(true)

  if (!isPending && !isError && user === null) {
    const state: SignInState | undefined = hadSession ? undefined : { from: `${location.pathname}${location.search}` }
    return <Navigate to={ROUTES.signIn} replace state={state} />
  }

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Abrindo sua sessão…">
      <Outlet />
    </QueryBoundary>
  )
}
