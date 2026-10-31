const LOCALE = 'pt-BR'

/**
 * Formats a stored timestamp for reading.
 *
 * Timestamps are kept as ISO strings because that is what the Spec defines and
 * what an API returns; the display form belongs here so no screen invents its
 * own, and so the day an exam was applied reads the same everywhere.
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** The `yyyy-MM-dd` a date input reads and writes. */
export function toDateInputValue(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

/** Turns what a date input produced back into the stored form. */
export function fromDateInputValue(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/**
 * Today as the teacher's calendar shows it, in the stored form: noon UTC of
 * that day. The current instant would not do, since after 21h in Brazil it is
 * already tomorrow in UTC, and the server compares sittings by the UTC day.
 */
export function todayAsStored(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return fromDateInputValue(`${now.getFullYear()}-${month}-${day}`)
}
