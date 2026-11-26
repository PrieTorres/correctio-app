import { useEffect, useRef } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, SaveError, TextField } from '@/components/ui'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { ROUTES } from '@/app/routes'
import { useServices } from '@/app/services'
import { signInSchema, type SignInInput } from '@/lib/schemas'
import { CodeForm } from '../components/CodeForm'
import {
  pendingChallengeOf,
  useCompleteGoogleSignIn,
  useCompleteSecondFactor,
  useCurrentUser,
  useSignIn,
  useStartGoogleSignIn,
} from '../hooks/useAuth'

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
  const { mutate, error, data, reset } = useCompleteGoogleSignIn()
  const exchanged = useRef<string | null>(null)
  const code = params.get('google')

  useEffect(() => {
    if (code === null || exchanged.current === code) return
    exchanged.current = code
    setParams({}, { replace: true })
    mutate(code)
  }, [code, mutate, setParams])

  return {
    error: params.get('erro') === 'google' ? GOOGLE_FAILED : error,
    challenge: pendingChallengeOf(data),
    reset,
  }
}

/**
 * The second step of a sign-in, for an account with the authenticator app on:
 * the first step (password or Google) left a challenge, and only a current
 * code trades it for the session.
 */
function SecondFactorStep({ challenge, onBack }: Readonly<{ challenge: string; onBack: () => void }>) {
  const completion = useCompleteSecondFactor()

  return (
    <AuthLayout title="Verificação em duas etapas" description="Digite o código de 6 dígitos que o seu aplicativo autenticador mostra agora.">
      <CodeForm
        submitLabel="Verificar e entrar"
        pendingLabel="Verificando…"
        isPending={completion.isPending}
        error={completion.error}
        onSubmit={(code) => completion.mutate({ challenge, code })}
      />
      <Button variant="secondary" fullWidth className="mt-3" onClick={onBack}>
        Voltar
      </Button>
    </AuthLayout>
  )
}

function PasswordResetNotice({ state }: Readonly<{ state: unknown }>) {
  if (!isPasswordResetDone(state)) return null

  return (
    <output className="mb-4 block rounded-[var(--radius-control)] bg-success-surface p-3 text-caption text-ink">
      Senha redefinida. Entre com a senha nova.
    </output>
  )
}

/** Offered only where the app has a server to talk to Google (`AuthProvider.offersGoogle`). */
function GoogleButton({ google }: Readonly<{ google: ReturnType<typeof useStartGoogleSignIn> }>) {
  const { auth } = useServices()
  if (!auth.offersGoogle) return null

  return (
    <Button variant="secondary" fullWidth className="mt-3" disabled={google.isPending} onClick={() => google.mutate()}>
      Entrar com o Google
    </Button>
  )
}

/**
 * Screen C1. Wrong e-mail and wrong password read the same, and a blocked
 * address gets the API's own message saying how long to wait (RNF12). An
 * account with the second factor on goes on to the code step, from the form or
 * from Google alike. Once there is a session, from the form, from Google or
 * from an earlier visit, the page sends the teacher back where the guard found
 * them.
 */
export function SignInPage() {
  const location = useLocation()
  const navigationState: unknown = location.state
  const { data: user } = useCurrentUser()
  const signIn = useSignIn()
  const googleStart = useStartGoogleSignIn()
  const googleReturn = useGoogleReturn()
  const challenge = pendingChallengeOf(signIn.data) ?? googleReturn.challenge

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: EMPTY })

  if (user) return <Navigate to={returnPathOf(location.state)} replace />
  if (challenge !== null) {
    return (
      <SecondFactorStep
        challenge={challenge}
        onBack={() => {
          signIn.reset()
          googleReturn.reset()
        }}
      />
    )
  }

  return (
    <AuthLayout title="Entrar" description="Acesse sua conta para continuar corrigindo provas.">
      <PasswordResetNotice state={navigationState} />

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

        <SaveError error={signIn.error ?? googleReturn.error ?? googleStart.error} />

        <Button variant="primary" type="submit" fullWidth disabled={isSubmitting || signIn.isPending}>
          {signIn.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <GoogleButton google={googleStart} />

      <div className="mt-4 flex flex-col items-center text-label">
        <Link to={ROUTES.passwordReset} className="link-target text-primary hover:underline">
          Esqueci minha senha
        </Link>
        <span className="flex flex-wrap items-center justify-center gap-x-1 text-ink-muted">
          Ainda não tem conta?{' '}
          <Link to={ROUTES.signUp} className="link-target text-primary hover:underline">
            Criar conta
          </Link>
        </span>
      </div>
    </AuthLayout>
  )
}
