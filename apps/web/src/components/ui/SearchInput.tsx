import { Search } from 'lucide-react'

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  return (
    <div className="relative flex-1">
      <Search
        size={18}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="touch-target w-full rounded-[var(--radius-control)] border border-line bg-surface pl-10 pr-3 text-body focus:outline-none focus-visible:border-primary"
      />
    </div>
  )
}
