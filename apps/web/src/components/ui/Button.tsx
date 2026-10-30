import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClasses, type ButtonVariant } from './button-classes'

export type { ButtonVariant }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Decorative: the label is what names the action for assistive tech. */
  icon?: ReactNode
  fullWidth?: boolean
}

/** An action on this screen. One that goes to another screen is a `ButtonLink`, never a link inside this. */
export function Button({
  variant = 'secondary',
  icon,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: Readonly<ButtonProps>) {
  return (
    <button type={type} className={buttonClasses({ variant, fullWidth, className })} {...rest}>
      {icon}
      {children}
    </button>
  )
}
