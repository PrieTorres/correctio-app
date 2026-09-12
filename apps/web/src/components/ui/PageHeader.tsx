import type { ReactNode } from 'react'
import { HelpButton } from './HelpButton'

/**
 * The title of a screen, its one-line explanation, and its actions.
 *
 * `help` puts the question mark next to the title rather than in the menu:
 * someone who does not know what a screen is for looks at the screen, not at
 * the navigation.
 */
export function PageHeader({
  title,
  description,
  actions,
  help = false,
}: Readonly<{
  title: string
  description?: string
  actions?: ReactNode
  help?: boolean
}>) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-headline text-primary">{title}</h1>
          {help && <HelpButton />}
        </div>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}
