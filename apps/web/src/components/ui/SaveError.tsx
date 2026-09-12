import { AlertTriangle } from 'lucide-react'

/**
 * What went wrong when a save was refused by the storage rather than by the
 * form's own validation.
 *
 * Forms showed field errors and said nothing about these, so a refused save
 * looked like a button that did not work. The message comes from the rule that
 * refused, which already says what to do about it.
 */
export function SaveError({ error }: Readonly<{ error: Error | null }>) {
  if (error === null) return null

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-surface p-3 text-caption text-on-danger-surface"
    >
      <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
      {error.message}
    </p>
  )
}
