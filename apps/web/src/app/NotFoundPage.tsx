import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, SearchIllustration } from '@/components/ui'
import { ROUTES } from './routes'

/**
 * Where a mistyped or outdated address lands.
 *
 * It offers the way back rather than only stating the problem: someone who
 * arrives here followed a link that no longer works, and leaving them with a
 * number is leaving them stuck.
 */
export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Card>
      <EmptyState
        illustration={<SearchIllustration />}
        title="Página não encontrada"
        description="O endereço não existe ou mudou de lugar. Volte à página anterior ou comece pelo painel."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => void navigate(-1)}>
              Voltar
            </Button>
            <Button variant="primary">
              <Link to={ROUTES.dashboard}>Ir para o painel</Link>
            </Button>
          </div>
        }
      />
    </Card>
  )
}
