import { useId } from 'react'

export interface FilterOption {
  value: string
  label: string
}

/**
 * A labelled select whose empty choice, "Todas", means no restriction, as the
 * filters of the consolidated report (P19) and of the applications (P11) read
 * an absent URL parameter.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: Readonly<{ label: string; value: string; options: readonly FilterOption[]; onChange: (value: string) => void }>) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="touch-target w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
      >
        <option value="">Todas</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
