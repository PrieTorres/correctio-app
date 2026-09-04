import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '@/components/ui'

/** Stands in for screens not built yet, so navigation is already complete. */
export function PlaceholderPage({ screen }: { screen: string }) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={screen} description="Tela ainda não construída." />
      <Card className="p-6">
        <p className="text-body text-ink-muted">
          Consulte o passo correspondente no plano de execução antes de começar.
        </p>
        <div className="mt-4">
          <Button onClick={() => void navigate(-1)}>Voltar</Button>
        </div>
      </Card>
    </div>
  )
}
