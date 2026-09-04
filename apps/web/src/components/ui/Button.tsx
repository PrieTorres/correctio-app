import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Decorative: the label is what names the action for assistive tech. */
  icon?: ReactNode
  fullWidth?: boolean
}

/** Only one primary (gold) action per screen keeps the hierarchy readable. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface text-primary border border-primary hover:bg-surface-muted',
  ghost: 'bg-transparent text-primary hover:bg-surface-muted',
  danger: 'bg-danger-surface text-on-danger-surface hover:brightness-95',
}

export function Button({
  variant = 'secondary',
  icon,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'touch-target inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-label font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
