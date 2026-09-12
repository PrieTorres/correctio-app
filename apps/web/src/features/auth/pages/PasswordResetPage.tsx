import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button, Card, TextField } from '@/components/ui'
import { ROUTES } from '@/app/routes'

/**
 * Answers the same way whether or not the address has an account.
 *
 * Saying "este e-mail não existe" turns the form into a way of discovering who
 * has an account here, which is information the person asking has no claim to.
 */
export function PasswordResetPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <div>
        <h1 className="text-headline text-primary">Recuperar senha</h1>
        <p className="mt-1 text-body text-ink-muted">
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
        </p>
      </div>

      {sent ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck size={28} aria-hidden className="text-success" />
          <p role="status" className="text-body text-ink">
            Se houver uma conta com esse e-mail, o link de recuperação chega em instantes.
          </p>
          <p className="text-caption text-ink-subtle">
            Nesta fase o envio é simulado: não há servidor de e-mail ainda.
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-6">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setSent(true)
            }}
            noValidate
          >
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button variant="primary" type="submit" disabled={email.trim() === ''}>
              Enviar link de recuperação
            </Button>
          </form>
        </Card>
      )}

      <Link to={ROUTES.signIn} className="text-center text-label text-primary underline">
        Voltar para entrar
      </Link>
    </div>
  )
}
