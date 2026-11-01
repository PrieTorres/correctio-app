import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, SaveError, TextField, Tour } from '@/components/ui'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { ROUTES } from '@/app/routes'
import { signUpSchema, type SignUpInput } from '@/lib/schemas'
import { StorageError } from '@/lib/storage/errors'
import { useCurrentUser, useSignUp } from '../hooks/useAuth'

const EMPTY: SignUpInput = { fullName: '', email: '', password: '', confirmPassword: '' }

/** An address that already has an account is the e-mail field's problem, so it shows there (C2); anything else goes under the form. */
function placeSignUpError(error: Error | null): { onEmail?: string; onForm: Error | null } {
  if (error instanceof StorageError && error.code === 'conflict') return { onEmail: error.message, onForm: null }
  return { onForm: error }
}

/** Screen C2. The account is created on the API and signed in at once; the dashboard follows. */
export function SignUpPage() {
  const { data: user } = useCurrentUser()
  const signUp = useSignUp()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema), defaultValues: EMPTY })

  if (user) return <Navigate to={ROUTES.dashboard} replace />

  const failure = placeSignUpError(signUp.error)

  return (
    <AuthLayout title="Criar conta" description="Cadastre-se para começar a criar e corrigir provas.">
      <form
        onSubmit={(event) => void handleSubmit((input) => signUp.mutate(input))(event)}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label="Nome completo"
          autoComplete="name"
          placeholder="Ana Ribeiro"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@escola.edu.br"
          error={errors.email?.message ?? failure.onEmail}
          {...register('email')}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <SaveError error={failure.onForm} />

        <Button variant="primary" type="submit" fullWidth disabled={isSubmitting || signUp.isPending}>
          {signUp.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <div className="mt-6 text-center text-label text-ink-muted">
        Já tem conta?{' '}
        <Link to={ROUTES.signIn} className="link-target text-primary hover:underline">
          Entrar
        </Link>
      </div>

      <Tour screen="signUp" ready />
    </AuthLayout>
  )
}
