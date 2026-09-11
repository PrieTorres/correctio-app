import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-hover text-ink-muted',
  info: 'bg-primary-fixed text-on-primary-fixed',
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-on-warning-surface',
  danger: 'bg-danger-surface text-on-danger-surface',
}

/** `outline` reads as metadata rather than state, for tags beside a status. */
export function Badge({
  tone = 'neutral',
  outline = false,
  icon,
  children,
}: Readonly<{ tone?: BadgeTone; outline?: boolean; icon?: ReactNode; children: ReactNode }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption',
        outline ? 'border border-line text-ink-muted' : TONE_CLASSES[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}
