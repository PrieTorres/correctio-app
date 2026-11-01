import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Card, SaveError, TextField } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas'
import { useResetPassword } from '../hooks/useAuth'
import type { PasswordResetDone } from './SignInPage'

const EMPTY: ResetPasswordInput = { password: '', confirmPassword: '' }

/**
 * The code of the e-mail link, read once when the page opens. It then leaves
 * the address bar, so it is not kept in the history nor sent along as the
 * `Referer` of anything the page loads.
 */
function useLinkCode(): string | null {
  const [params, setParams] = useSearchParams()
  const [code] = useState(() => params.get('codigo'))

  useEffect(() => {
    if (params.has('codigo')) setParams({}, { replace: true })
  }, [params, setParams])

  return code
}

/**
 * Screen C3, second step, opened from the reset e-mail. A link already used or
 * expired says so and offers a new one; a successful reset goes to the
 * sign-in, which confirms it.
 */
export function NewPasswordPage() {
  const navigate = useNavigate()
  const code = useLinkCode()
  const reset = useResetPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: EMPTY })

  const onSubmit = ({ password }: ResetPasswordInput) => {
    if (code === null) return
    const done: PasswordResetDone = { passwordReset: true }
    reset.mutate({ code, password }, { onSuccess: () => void navigate(ROUTES.signIn, { replace: true, state: done }) })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <div>
        <h1 className="text-headline text-primary">Redefinir senha</h1>
        <p className="mt-1 text-body text-ink-muted">Escolha a senha nova da sua conta.</p>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        {code === null ? (
          <p role="alert" className="text-body text-danger">
            Este endereço não traz o código do e-mail. Abra o link da mensagem de novo ou peça outro.
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
            <TextField
              label="Senha nova"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <TextField
              label="Confirmar senha nova"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <SaveError error={reset.error} />
            <Button variant="primary" type="submit" disabled={reset.isPending}>
              {reset.isPending ? 'Redefinindo…' : 'Redefinir senha'}
            </Button>
          </form>
        )}
      </Card>

      <Link to={ROUTES.passwordReset} className="link-target justify-center text-label text-primary underline">
        Pedir um link novo
      </Link>
    </div>
  )
}
