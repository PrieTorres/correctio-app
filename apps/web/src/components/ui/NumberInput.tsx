import { useState } from 'react'
import { cn } from '@/lib/utils'

interface NumberInputProps {
  value: number
  onValueChange: (value: number) => void
  /** Accessible name. The visible text beside it is usually shorter. */
  label: string
  min?: number
  max?: number
  step?: string
  className?: string
}

/**
 * Number field that survives being typed into.
 *
 * A browser reports `<input type="number">` as empty whenever its content is
 * not yet a valid number — while "2." is on its way to "2.5", and for the
 * instant after the field is cleared. Feeding that straight back through a
 * controlled value rewrites the field to the number so far, so the next
 * keystroke lands beside it: "2.5" comes out as "25", and clearing before
 * typing "2" leaves "20".
 *
 * Keeping the text being typed here and reporting upwards only what parses
 * lets someone type the number they meant. An empty field reports nothing at
 * all rather than a zero nobody asked for, and is put back on the way out.
 */
export function NumberInput({
  value,
  onValueChange,
  label,
  min = 0,
  max,
  step = '1',
  className,
}: Readonly<NumberInputProps>) {
  const [draft, setDraft] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)

  if (value !== lastValue) {
    setLastValue(value)
    if (Number(draft) !== value) setDraft(String(value))
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (next !== '' && Number.isFinite(Number(next))) onValueChange(Number(next))
      }}
      onBlur={() => {
        if (draft === '' || !Number.isFinite(Number(draft))) setDraft(String(value))
      }}
      aria-label={label}
      className={cn(
        'rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-body',
        'focus:outline-none focus-visible:border-primary',
        className,
      )}
    />
  )
}
