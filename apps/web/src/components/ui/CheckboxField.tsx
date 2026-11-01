import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'className'> {
  /** The visible text, which is also the name of the box unless `aria-label` says more. */
  label: string
  /** Placed on the row, which is the part that takes the click. */
  className?: string
}

/**
 * A checkbox and its text on one row, the whole row toggling the box.
 *
 * The box is 16 px and the row used to be as tall as its line of text, 24 px,
 * which a finger misses (#145). The row is now 44 px tall, set once here
 * instead of in each screen: the generation screen and the exam form had
 * drifted into two copies of this same control.
 *
 * Every attribute of the box reaches the `<input>`, the `ref` of a form
 * library included.
 */
export function CheckboxField({ label, className, ...input }: Readonly<CheckboxFieldProps>) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-3', className)}>
      <input type="checkbox" className="size-4 shrink-0 accent-[var(--color-primary)]" {...input} />
      <span className="text-body text-ink">{label}</span>
    </label>
  )
}
