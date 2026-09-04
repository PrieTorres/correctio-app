import { cn } from '@/lib/utils'

export interface Segment<T extends string> {
  value: T
  label: string
}

/** Two-or-three-way filter; `aria-pressed` conveys the state to screen readers. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
}: {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-[var(--radius-control)] border border-line bg-surface p-1"
    >
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          onClick={() => onChange(segment.value)}
          aria-pressed={value === segment.value}
          className={cn(
            'touch-target rounded-[var(--radius-chip)] px-4 text-label',
            value === segment.value
              ? 'bg-primary-container text-on-primary'
              : 'text-ink-muted hover:bg-surface-muted',
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
