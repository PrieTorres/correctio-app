import { useId, forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * Always-visible label wired to the input, with the error announced through
 * `aria-describedby` and `role="alert"`.
 *
 * `forwardRef` is required for react-hook-form's `register` to reach the DOM
 * node.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, className, ...rest },
  ref,
) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'touch-target rounded-[var(--radius-control)] border bg-surface px-3 text-body',
          'focus:outline-none focus-visible:border-primary',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
})
