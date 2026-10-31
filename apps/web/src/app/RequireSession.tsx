import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
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

  if (isPending) return <SessionSplash />
  if (isError) return <SessionSplash failed />
  return <Outlet />
}

/**
 * What the teacher sees while the session is restored, before any screen
 * exists: the whole page, centred, with the brand as on the sign-in, instead
 * of a line of text in the corner of an empty page. A failure says so in the
 * same place and offers to try again, which reloads, since nothing else of
 * the app is on the page yet.
 */
function SessionSplash({ failed = false }: Readonly<{ failed?: boolean }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4 text-center">
      <p className="font-[family-name:var(--font-heading)] text-headline text-primary">Correctio</p>
      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-4">
          <p className="text-body text-ink-muted">Não foi possível abrir sua sessão. Confira a conexão e tente de novo.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-3 text-body text-ink-muted">
          <Loader2 size={20} aria-hidden className="motion-safe:animate-spin text-primary" />
          Abrindo sua sessão…
        </p>
      )}
    </div>
  )
}
