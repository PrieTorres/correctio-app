import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextField } from '@/components/ui'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { ROUTES } from '@/app/routes'
import { signUpSchema, type SignUpInput } from '@/lib/schemas'
import { useSignUp } from '../hooks/useAuth'

const EMPTY: SignUpInput = { fullName: '', email: '', password: '', confirmPassword: '' }

/**
 * Simulated sign-up: the account is not persisted as its own record, it just
 * signs the demo teacher in under the name and e-mail typed here. Good enough
 * to show the flow end to end while there is no server to register against.
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const signUp = useSignUp()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema), defaultValues: EMPTY })

  const onSubmit = async (input: SignUpInput) => {
    await signUp.mutateAsync(input)
    void navigate(ROUTES.dashboard)
  }

  return (
    <AuthLayout title="Criar conta" description="Cadastre-se para começar a criar e corrigir provas.">
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
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
          error={errors.email?.message}
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

        <Button variant="primary" type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <div className="mt-6 text-center text-label text-ink-muted">
        Já tem conta?{' '}
        <Link to={ROUTES.signIn} className="text-primary hover:underline">
          Entrar
        </Link>
      </div>
    </AuthLayout>
  )
}
