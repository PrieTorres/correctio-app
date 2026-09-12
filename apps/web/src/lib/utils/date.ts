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
