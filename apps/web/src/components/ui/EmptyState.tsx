import type { ReactNode } from 'react'

/**
 * What a screen shows when it has nothing to list.
 *
 * It carries the explanation of what the area is for and the action that fills
 * it, so an empty screen teaches the next step instead of looking broken. That
 * is also why the guided tour skips empty screens: this already does the job.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
}: Readonly<{
  /** Decorative: the heading and description carry the meaning. */
  illustration: ReactNode
  title: string
  description: string
  action?: ReactNode
}>) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      {illustration}
      <div className="flex flex-col gap-2">
        <h3 className="text-title text-primary">{title}</h3>
        <p className="max-w-prose text-body text-ink-muted">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
