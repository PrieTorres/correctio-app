import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, RotateCcw, UserX } from 'lucide-react'
import { Button, Card, PageHeader, QueryBoundary, TextField } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { resetAllTours } from '@/lib/tour'
import { useCurrentUser, useSignOut } from '@/features/auth'

const CONFIRMATION = 'ANONIMIZAR'

export function ProfilePage() {
  const navigate = useNavigate()
  const { data: user, isPending, isError } = useCurrentUser()
  const signOut = useSignOut()

  const [typed, setTyped] = useState('')
  const [tourReset, setTourReset] = useState(false)

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando o perfil…">
      <div className="flex flex-col gap-6">
        <PageHeader title="Meu perfil" description="Seus dados, o tour e o encerramento da conta." />

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
          <h2 className="text-title text-primary">Tour guiado</h2>
          <p className="text-body text-ink-muted">
            Rever o tour zera o estado de todas as telas: cada uma volta a apresentar seus passos
            na próxima visita.
          </p>
          <Button
            variant="secondary"
            icon={<RotateCcw size={18} aria-hidden />}
            onClick={() => {
              resetAllTours()
              setTourReset(true)
            }}
          >
            Rever o tour
          </Button>
          {tourReset && (
            <p role="status" className="text-caption text-success">
              Pronto. O tour volta a aparecer em cada tela que você abrir.
            </p>
          )}
        </Card>

        <Card className="flex flex-col items-start gap-3 p-6">
          <h2 className="text-title text-primary">Sessão</h2>
          <p className="text-body text-ink-muted">
            Sair encerra a sessão neste navegador.
          </p>
          <Button
            variant="secondary"
            icon={<LogOut size={18} aria-hidden />}
            onClick={() => signOut.mutate(undefined, { onSuccess: () => void navigate(ROUTES.signIn) })}
          >
            Sair de todos os dispositivos
          </Button>
        </Card>

        {/*
          Typing the word rather than ticking a box: anonymising cannot be
          undone, and a confirmation that costs one click is one a tired person
          gives without reading.
        */}
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
          <Button variant="danger" icon={<UserX size={18} aria-hidden />} disabled={typed !== CONFIRMATION}>
            Anonimizar minha conta
          </Button>
        </Card>
      </div>
    </QueryBoundary>
  )
}
