import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { Button, Card, SaveError, TextField } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/schemas'
import { useRequestPasswordReset } from '../hooks/useAuth'

const EMPTY: ForgotPasswordInput = { email: '' }

/**
 * Screen C3, first step. Answers the same way whether or not the address has
 * an account, and so does the API, down to how long it takes.
 *
 * Saying "este e-mail não existe" turns the form into a way of discovering who
 * has an account here, which is information the person asking has no claim to.
 */
export function PasswordResetPage() {
  const request = useRequestPasswordReset()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: EMPTY })

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <div>
        <h1 className="text-headline text-primary">Recuperar senha</h1>
        <p className="mt-1 text-body text-ink-muted">
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
        </p>
      </div>

      {request.isSuccess ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck size={28} aria-hidden className="text-success" />
          <p role="status" className="text-body text-ink">
            Se houver uma conta com esse e-mail, o link de recuperação chega em instantes. Ele vale por 30 minutos e
            uma única vez.
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-6">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => void handleSubmit(({ email }) => request.mutate(email))(event)}
            noValidate
          >
            <TextField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <SaveError error={request.error} />
            <Button variant="primary" type="submit" disabled={request.isPending}>
              {request.isPending ? 'Enviando…' : 'Enviar link de recuperação'}
            </Button>
          </form>
        </Card>
      )}

      <Link to={ROUTES.signIn} className="link-target justify-center text-label text-primary underline">
        Voltar para entrar
      </Link>
    </div>
  )
}
