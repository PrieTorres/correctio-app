import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { buttonClasses, type ButtonVariant } from './button-classes'

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  /** Decorative: the label is what names the destination for assistive tech. */
  icon?: ReactNode
  fullWidth?: boolean
}

/**
 * A link drawn as a button, for an action that opens another screen.
 *
 * A `<button>` around a `<Link>`, or a `<Link>` around a `<button>`, puts one
 * control inside another: only the text navigated, the border and the icon did
 * nothing, and the keyboard stopped on it twice, the first time for nothing
 * (#141). This is the link itself, so the whole button navigates, Tab stops
 * once and Enter follows it.
 *
 * Every other attribute reaches the `<a>`, `data-tour` included, which is
 * where the guided tour looks for what to point at.
 */
export function ButtonLink({
  variant = 'secondary',
  icon,
  fullWidth = false,
  className,
  children,
  ...rest
}: Readonly<ButtonLinkProps>) {
  return (
    <Link className={buttonClasses({ variant, fullWidth, className })} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
