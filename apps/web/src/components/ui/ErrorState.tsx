import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'

/**
 * What an area shows when its data could not be read: what went wrong, what
 * to do, and a way to try again, in the place the content would be, instead
 * of a line of red text. `onRetry` reads the data again; without it the page
 * reloads, which is the retry every screen can offer. `framed` is false inside
 * a card that already frames the section.
 */
export function ErrorState({
  title = 'Não foi possível carregar os dados',
  description = 'Confira sua conexão e tente de novo. Se o problema continuar, recarregue a página daqui a pouco.',
  onRetry,
  framed = true,
}: Readonly<{ title?: string; description?: string; onRetry?: () => void; framed?: boolean }>) {
  const content = (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-surface text-on-danger-surface">
        <AlertTriangle size={28} aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-title text-primary">{title}</h2>
        <p className="max-w-prose text-body text-ink-muted">{description}</p>
      </div>
      <Button icon={<RotateCw size={16} aria-hidden />} onClick={onRetry ?? (() => window.location.reload())}>
        Tentar de novo
      </Button>
    </div>
  )
  return framed ? <Card>{content}</Card> : content
}
