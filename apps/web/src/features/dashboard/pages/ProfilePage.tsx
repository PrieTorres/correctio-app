import { useState } from 'react'
import { LogOut, UserX } from 'lucide-react'
import { Button, Card, PageHeader, QueryBoundary, SaveError, TextField } from '@/components/ui'
import { useAnonymizeAccount, useCurrentUser, useSignOutEverywhere } from '@/features/auth'

const CONFIRMATION = 'ANONIMIZAR'

/**
 * Typing the word rather than ticking a box: anonymising cannot be undone, and
 * a confirmation that costs one click is one a tired person gives without
 * reading.
 *
 * Neither way of leaving navigates by itself: once the session is gone, the
 * guard of the private screens takes the browser to the sign-in.
 */
export function ProfilePage() {
  const { data: user, isPending, isError } = useCurrentUser()
  const signOutEverywhere = useSignOutEverywhere()
  const anonymize = useAnonymizeAccount()

  const [typed, setTyped] = useState('')

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando o perfil…">
      <div className="flex flex-col gap-6">
        <PageHeader title="Meu perfil" description="Seus dados, as sessões e o encerramento da conta." />

        <Card className="flex flex-col gap-3 p-6">
          <h2 className="text-title text-primary">Dados da conta</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-label text-ink-muted">Nome</dt>
              <dd className="text-body text-ink">{user?.fullName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-label text-ink-muted">E-mail</dt>
              <dd className="text-body text-ink">{user?.email ?? '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-col items-start gap-3 p-6">
          <h2 className="text-title text-primary">Sessão</h2>
          <p className="text-body text-ink-muted">
            Encerra a sessão em todos os navegadores e celulares onde você entrou, este incluído. Use se
            esqueceu a conta aberta num computador compartilhado.
          </p>
          <SaveError error={signOutEverywhere.error} />
          <Button
            variant="secondary"
            icon={<LogOut size={18} aria-hidden />}
            disabled={signOutEverywhere.isPending}
            onClick={() => signOutEverywhere.mutate()}
          >
            Sair de todos os dispositivos
          </Button>
        </Card>

        <Card className="flex flex-col items-start gap-3 border-l-4 border-l-danger p-6">
          <h2 className="text-title text-danger">Anonimizar a conta</h2>
          <p className="text-body text-ink-muted">
            Seu nome e e-mail são substituídos por marcadores e o vínculo com você é desfeito. As
            turmas, provas e estatísticas continuam existindo. Isto não pode ser desfeito.
          </p>
          <TextField
            label={`Digite ${CONFIRMATION} para confirmar`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <SaveError error={anonymize.error} />
          <Button
            variant="danger"
            icon={<UserX size={18} aria-hidden />}
            disabled={typed !== CONFIRMATION || anonymize.isPending}
            onClick={() =>
              anonymize.mutate()
            }
          >
            {anonymize.isPending ? 'Anonimizando…' : 'Anonimizar minha conta'}
          </Button>
        </Card>
      </div>
    </QueryBoundary>
  )
}
