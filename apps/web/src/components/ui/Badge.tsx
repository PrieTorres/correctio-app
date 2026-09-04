import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-hover text-ink-muted',
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-on-warning-surface',
  danger: 'bg-danger-surface text-on-danger-surface',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-chip)] px-2 py-0.5 text-caption',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
