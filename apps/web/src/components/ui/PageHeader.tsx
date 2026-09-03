import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-headline text-primary">{title}</h1>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}
