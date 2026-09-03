import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the hover elevation. Only for cards that are themselves clickable. */
  interactive?: boolean
}

export function Card({ interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface',
        interactive && 'transition-shadow hover:shadow-[var(--shadow-hover)]',
        className,
      )}
      {...rest}
    />
  )
}
