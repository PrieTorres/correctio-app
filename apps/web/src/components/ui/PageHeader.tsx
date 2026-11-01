import type { ReactNode } from 'react'
import { HelpButton } from './HelpButton'

/**
 * The title of a screen, its one-line explanation, and its actions.
 *
 * `help` puts the question mark next to the title rather than in the menu:
 * someone who does not know what a screen is for looks at the screen, not at
 * the navigation.
 *
 * An action never breaks its label over two lines: beside a long description
 * the actions were squeezed until "Nova aplicação" wrapped inside its button
 * at 1366 px (#141). From 1280 px the actions also keep their full width and
 * the description wraps instead; below that, where four buttons beside a title
 * would not fit, they may still stack, one per line, rather than push the page
 * sideways.
 */
export function PageHeader({
  title,
  description,
  actions,
  status,
  help = false,
}: Readonly<{
  title: string
  description?: string
  actions?: ReactNode
  /** The state of what the screen shows, such as a badge saying a class is archived, read right after its name. */
  status?: ReactNode
  help?: boolean
}>) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <h1 className="text-headline text-primary">{title}</h1>
          {help && <HelpButton />}
          {status !== undefined && <span className="ml-2">{status}</span>}
        </div>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 *:whitespace-nowrap xl:shrink-0">{actions}</div>}
    </div>
  )
}
