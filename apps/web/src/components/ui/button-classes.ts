import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** Only one primary (gold) action per screen keeps the hierarchy readable. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface text-primary border border-primary hover:bg-surface-muted',
  ghost: 'bg-transparent text-primary hover:bg-surface-muted',
  danger: 'bg-danger-surface text-on-danger-surface hover:brightness-95',
}

export interface ButtonLook {
  variant?: ButtonVariant
  fullWidth?: boolean
  className?: string
}

/**
 * How a button is drawn, shared by `Button` and `ButtonLink`: a link that
 * reads as a button follows the same rules, 44 px target included, and cannot
 * drift from them as the buttons change.
 */
export function buttonClasses({ variant = 'secondary', fullWidth = false, className }: ButtonLook = {}): string {
  return cn(
    'touch-target inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-label font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASSES[variant],
    fullWidth && 'w-full',
    className,
  )
}
