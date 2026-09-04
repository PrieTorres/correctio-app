import type { ReactNode } from 'react'

/**
 * Empty state carrying its own call to action, so an empty list teaches the
 * next step without needing a tour step to explain it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
        {icon}
      </div>
      <h3 className="text-title text-primary">{title}</h3>
      <p className="max-w-prose text-body text-ink-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
