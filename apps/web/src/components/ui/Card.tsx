import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Adds the hover lift, for a card that leads somewhere. It also becomes the
   * hover group, so the link inside it can answer to the whole card.
   */
  interactive?: boolean
}

export function Card({ interactive = false, className, ...rest }: Readonly<CardProps>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface',
        interactive && 'card-interactive group',
        className,
      )}
      {...rest}
    />
  )
}
