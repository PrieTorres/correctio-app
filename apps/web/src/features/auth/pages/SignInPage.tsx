import { useEffect, useRef } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, SaveError, TextField } from '@/components/ui'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { ROUTES } from '@/app/routes'
import { useServices } from '@/app/services'
import { signInSchema, type SignInInput } from '@/lib/schemas'
import { useCompleteGoogleSignIn, useCurrentUser, useSignIn, useStartGoogleSignIn } from '../hooks/useAuth'

const EMPTY: SignInInput = { email: '', password: '' }

const GOOGLE_FAILED = new Error('Não foi possível entrar com o Google. Tente de novo ou entre com e-mail e senha.')

/** What `NewPasswordPage` leaves in the navigation state after a reset. */
export interface PasswordResetDone {
  passwordReset: true
}

function isPasswordResetDone(state: unknown): state is PasswordResetDone {
  return typeof state === 'object' && state !== null && 'passwordReset' in state
}

/** Only a path of this app: a full address in the state would let a crafted link send the teacher elsewhere. */
function returnPathOf(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return ROUTES.dashboard
  const { from } = state
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : ROUTES.dashboard
}

/**
 * Google sends the browser back here with a one-time code (`?google=`), or with
 * `?erro=google`. The code leaves the address at once, so it never stays in the
 * history, and is exchanged a single time: the ref survives the second run
 * React makes of every effect in development.
 */
function useGoogleReturn() {
  const [params, setParams] = useSearchParams()
  const { mutate, error } = useCompleteGoogleSignIn()
  const exchanged = useRef<string | null>(null)
  const code = params.get('google')

  useEffect(() => {
    if (code === null || exchanged.current === code) return
    exchanged.current = code
    setParams({}, { replace: true })
    mutate(code)
  }, [code, mutate, setParams])

  return params.get('erro') === 'google' ? GOOGLE_FAILED : error
}

/**
 * Screen C1. Wrong e-mail and wrong password read the same, and a blocked
 * address gets the API's own message saying how long to wait (RNF12). Once
 * there is a session, from the form, from Google or from an earlier visit, the
 * page sends the teacher back where the guard found them.
 */
export function SignInPage() {
  const location = useLocation()
  const { auth } = useServices()
  const { data: user } = useCurrentUser()
  const signIn = useSignIn()
  const google = useStartGoogleSignIn()
  const googleError = useGoogleReturn()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: EMPTY })

  if (user) return <Navigate to={returnPathOf(location.state)} replace />

  return (
    <AuthLayout title="Entrar" description="Acesse sua conta para continuar corrigindo provas.">
      {isPasswordResetDone(location.state) && (
        <p role="status" className="mb-4 rounded-[var(--radius-control)] bg-success-surface p-3 text-caption text-ink">
          Senha redefinida. Entre com a senha nova.
        </p>
      )}

      <form
        onSubmit={(event) => void handleSubmit((input) => signIn.mutate(input))(event)}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@escola.edu.br"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        <SaveError error={signIn.error ?? googleError ?? google.error} />

        <Button variant="primary" type="submit" fullWidth disabled={isSubmitting || signIn.isPending}>
          {signIn.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      {auth.offersGoogle && (
        <Button variant="secondary" fullWidth className="mt-3" disabled={google.isPending} onClick={() => google.mutate()}>
          Entrar com o Google
        </Button>
      )}

      <div className="mt-6 flex flex-col items-center gap-2 text-label">
        <Link to={ROUTES.passwordReset} className="text-primary hover:underline">
          Esqueci minha senha
        </Link>
        <span className="text-ink-muted">
          Ainda não tem conta?{' '}
          <Link to={ROUTES.signUp} className="text-primary hover:underline">
            Criar conta
          </Link>
        </span>
      </div>
    </AuthLayout>
  )
}
