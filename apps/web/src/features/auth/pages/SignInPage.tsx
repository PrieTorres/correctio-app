import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextField } from '@/components/ui'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { ROUTES } from '@/app/routes'
import { signInSchema, type SignInInput } from '@/lib/schemas'
import { useSignIn } from '../hooks/useAuth'

const EMPTY: SignInInput = { email: '', password: '' }

/**
 * There is no real backend behind this: any e-mail and password combination
 * signs the same demo teacher in. This exists so the flow and the navigation
 * to the dashboard are already in place for the Firebase implementation.
 */
export function SignInPage() {
  const navigate = useNavigate()
  const signIn = useSignIn()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: EMPTY })

  const onSubmit = async (input: SignInInput) => {
    await signIn.mutateAsync(input)
    void navigate(ROUTES.dashboard)
  }

  return (
    <AuthLayout title="Entrar" description="Acesse sua conta para continuar corrigindo provas.">
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
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

        <Button variant="primary" type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

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
